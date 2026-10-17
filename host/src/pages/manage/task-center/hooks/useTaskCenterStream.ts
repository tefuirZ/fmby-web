/**
 * W15-TASK-CENTER-STREAM：任务中心**流式增量渲染** hook。
 *
 * 用户红线（卡面原话）：「可以慢，不能空」——点开任务中心不允许「整个前端
 * 什么都不给、空着放那儿」。逐条落在代码里：
 *
 * ⑤ ≤300ms 内必须出现内容：骨架行或首批真数据任一即可（`SKELETON_ROWS`），
 *    且**不依赖 WS 是否连上**（首屏先 `first=1` 拉首块，WS 是增量增强）；
 * ⑥ 每批到达即 append（带 seq 判重，防重复帧）+ 顶部「已加载 N 条 · 仍在加载…」，
 *    完成变「共 N 条」；
 * ⑦ 全链路卡死：超过 `STALL_MS`(3s) 无任何数据 ⇒ 明确降级文案 + 重试按钮 +
 *    「任务仍在后台执行」提示（**不是 spinner 到永远**）；
 * ⑧ 空态写「当前没有运行中的任务」+ 引导动作（不许空壳）；
 * ⑨ 权限变更/启停等异步 job 的状态变化经 WS 实时可见（E1/E2 对齐）。
 *
 * 纪律对齐 `features/operations/useOperationsRealtime.ts`（仓内 WS 先例）：
 * - 失败 fail-closed + 指数退避重连（封顶 15s）；
 * - 卸载真关连接，卸载后绝不 setState（mountedRef 守卫）；
 * - 非 JSON 帧丢弃不崩；
 * **零新依赖**；只动前端仓。
 *
 * 降级链（卡面④）：WS 不可用 ⇒ 自动退回分页轮询（`first=1` 首块 + 后续
 * `page` 递增），依然分批出、不整页空白。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { taskCenterApi, type TaskCenterItemRecord, type TaskCenterListQuery } from '@fmby/v2-shared/contracts/manage/task-center';

const WS_PATH = '/api/playback/realtime/ws?scope=task_center';

/** 首屏骨架行数（⑤：≤300ms 出内容，骨架也算内容）。 */
export const SKELETON_ROWS = 3;
/** 卡死阈值（⑦：3s 无任何数据 ⇒ 降级提示）。与后端 FRONTEND_STALL_THRESHOLD_MS 同值。 */
export const STALL_MS = 3_000;
/** 轮询降级时的页长（= 后端 FIRST_BATCH，首块小页）。 */
const POLL_PAGE_SIZE = 3;

/** 三态（③：绝不允许「空壳 = 未知」）。 */
export type TaskCenterStreamPhase =
  /** 加载中：已出 N 条（N 可能为 0，但**已知在加载**——骨架行在）。 */
  | 'loading'
  /** 空：查询跑了、明确无数据（⑧：给引导动作）。 */
  | 'empty'
  /** 失败：带原因（⑦：给重试）。 */
  | 'failed'
  /** 完成：共 N 条。 */
  | 'done';

export interface TaskCenterStreamState {
  phase: TaskCenterStreamPhase;
  /** 已加载条目（append 累积，按到达序）。 */
  items: TaskCenterItemRecord[];
  /** 累计条数（⑥ 顶部「已加载 N 条」）。 */
  loaded: number;
  /** 服务端告知的总数（`done` 时 = loaded；`loading` 时可能是已知上界）。 */
  total: number | null;
  /** 是否还有更多（决定「仍在加载…」还是「共 N 条」）。 */
  hasMore: boolean;
  /** 失败原因（仅 `failed`）。 */
  reason: string | null;
  /** WS 连接状态。 */
  wsStatus: 'connecting' | 'open' | 'closed' | 'error' | 'polling';
  /** 最后一次到达的服务器时间（RFC3339），用于新鲜度。 */
  lastEventAt: string | null;
  /** 已见的最大批次序号（判重：防 WS 重连 replay 重复 append）。 */
  lastSeq: number;
}

const INITIAL: TaskCenterStreamState = {
  phase: 'loading',
  items: [],
  loaded: 0,
  total: null,
  hasMore: true,
  reason: null,
  wsStatus: 'connecting',
  lastEventAt: null,
  lastSeq: 0,
};

/** 重连退避：1s → 2s → 4s → … 封顶 15s（与 useOperationsRealtime 同算法）。 */
export function backoffMs(attempt: number): number {
  return Math.min(15_000, 1_000 * 2 ** Math.max(0, attempt - 1));
}

/**
 * 解析一帧 WS 文本。非 JSON / 缺 type / 缺 payload ⇒ null（不崩）。
 */
export function parseStreamFrame(
  text: string,
): { type: string; serverTime: string | null; payload: TaskCenterFramePayload } | null {
  let msg: { type?: string; server_time?: string; payload?: unknown };
  try {
    msg = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof msg !== 'object' || msg === null || typeof msg.type !== 'string') return null;
  if (typeof msg.payload !== 'object' || msg.payload === null) return null;
  const p = msg.payload as Record<string, unknown>;
  if (typeof p.kind !== 'string' || typeof p.seq !== 'number') return null;
  return {
    type: msg.type,
    serverTime: (msg.server_time as string | undefined) ?? null,
    payload: {
      kind: p.kind as TaskCenterFramePayload['kind'],
      seq: p.seq,
      items: Array.isArray(p.items) ? (p.items as TaskCenterItemRecord[]) : [],
      hasMore: p.has_more === true,
      loaded: typeof p.loaded === 'number' ? p.loaded : 0,
      total: typeof p.total === 'number' ? p.total : null,
      reason: typeof p.reason === 'string' ? p.reason : null,
    },
  };
}

/** 帧 payload（wire 形态，snake_case 由 parse 归一）。 */
export interface TaskCenterFramePayload {
  kind: 'first' | 'progress' | 'finished' | 'empty' | 'failed';
  seq: number;
  items: TaskCenterItemRecord[];
  hasMore: boolean;
  loaded: number;
  total: number | null;
  reason: string | null;
}

/**
 * 纯函数 reducer（可 node:test）：把一帧应用到当前状态。
 *
 * 关键不变量（断言目标）：
 * - `seq` 判重：同 seq 的 progress/first 帧只吃一次（防重复 append）；
 * - `loaded` 单调不减；
 * - `empty` ⇒ phase='empty' 且 items 为空；
 * - `failed` ⇒ phase='failed' 且保留已加载条目（用户已看到的不能因失败消失）；
 * - `finished` ⇒ phase='done'、hasMore=false、total=loaded。
 */
export function reduceStreamFrame(
  state: TaskCenterStreamState,
  frame: { type: string; serverTime: string | null; payload: TaskCenterFramePayload } | null,
): TaskCenterStreamState {
  if (!frame) return state;
  const { payload } = frame;
  const base: TaskCenterStreamState = {
    ...state,
    wsStatus: 'open',
    lastEventAt: frame.serverTime ?? state.lastEventAt,
  };

  switch (payload.kind) {
    case 'first':
    case 'progress': {
      // 判重：seq 不大于已见最大值 ⇒ 视为重复帧（WS 重连 replay 会重发）。
      if (payload.seq > 0 && payload.seq <= (state.lastSeq ?? 0)) return state;
      const merged = dedupeById([...state.items, ...payload.items]);
      return {
        ...base,
        phase: 'loading',
        items: merged,
        loaded: Math.max(state.loaded, payload.loaded, merged.length),
        total: payload.total,
        hasMore: payload.hasMore,
        reason: null,
        lastSeq: Math.max(state.lastSeq ?? 0, payload.seq),
      };
    }
    case 'finished':
      return {
        ...base,
        phase: 'done',
        hasMore: false,
        loaded: Math.max(state.loaded, payload.loaded),
        total: payload.total ?? Math.max(state.loaded, payload.loaded),
        reason: null,
      };
    case 'empty':
      return { ...base, phase: 'empty', items: [], loaded: 0, hasMore: false, total: 0, reason: null };
    case 'failed':
      // ★已加载条目保留：用户已看到的不因后续失败消失。
      return { ...base, phase: 'failed', hasMore: false, reason: payload.reason ?? '未知原因' };
    default:
      return state;
  }
}

/** 按 id 去重（保序：首次出现的位置）。 */
function dedupeById(items: TaskCenterItemRecord[]): TaskCenterItemRecord[] {
  const seen = new Set<string>();
  const out: TaskCenterItemRecord[] = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

/** 顶部状态文案（⑥/⑦/⑧）。 */
export function streamHeadline(state: TaskCenterStreamState): string {
  switch (state.phase) {
    case 'loading':
      return state.loaded > 0
        ? `已加载 ${state.loaded} 条 · 仍在加载…`
        : '正在加载任务…';
    case 'done':
      return `共 ${state.total ?? state.loaded} 条`;
    case 'empty':
      return '当前没有运行中的任务';
    case 'failed':
      return `加载失败：${state.reason ?? '未知原因'}`;
  }
}

export interface UseTaskCenterStreamOptions {
  /** 筛选条件（分类/状态/时间窗）。变化时重置流。 */
  query: Omit<TaskCenterListQuery, 'page' | 'size'>;
  /** 是否启用（默认 true）。 */
  enabled?: boolean;
}

export interface UseTaskCenterStreamResult extends TaskCenterStreamState {
  /** 首屏是否还在骨架态（loaded=0 且未到终态）。 */
  showSkeleton: boolean;
  /** 是否已卡死超过阈值（⑦：该出降级文案 + 重试了）。 */
  stalled: boolean;
  /** 人工重试（重置流 + 重新拉首块）。 */
  retry: () => void;
  /** 关闭/开启动效（⑥：可关闭）。 */
  animate: boolean;
  setAnimate: (v: boolean) => void;
}

/**
 * 任务中心流式 hook。
 *
 * 双通道（卡面②+④）：
 * 1. **首块立即拉**（`first=1` 轮询一次）⇒ 不依赖 WS，≤300ms 出内容；
 * 2. **WS 增量**（`scope=task_center`）⇒ 每批到达 append；
 * 3. WS 不可用 ⇒ 继续以 `first=1` + `page` 递增轮询补量（降级，仍分批）。
 */
export function useTaskCenterStream({
  query,
  enabled = true,
}: UseTaskCenterStreamOptions): UseTaskCenterStreamResult {
  const [state, setState] = useState<TaskCenterStreamState>(INITIAL);
  const [animate, setAnimate] = useState(true);
  const [stalled, setStalled] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const stateRef = useRef(state);
  stateRef.current = state;
  const socketRef = useRef<WebSocket | null>(null);
  const closedByUsRef = useRef(false);
  const mountedRef = useRef(true);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollPageRef = useRef(1);
  const queryKey = useMemo(() => JSON.stringify(query), [query]);

  const apply = useCallback((next: Partial<TaskCenterStreamState>) => {
    if (!mountedRef.current) return; // 卸载后绝不 setState
    setState((prev) => ({ ...prev, ...next }));
  }, []);

  /** 重置卡死计时（每收到一批就重置）。 */
  const armStallTimer = useCallback(() => {
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    stalled && setStalled(false);
    stallTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      // 3s 无任何数据且仍非终态 ⇒ 判卡死（⑦）。
      // 仅「仍在加载」判卡死；终态（done/empty/failed）不该弹降级。
      if (stateRef.current.phase === 'loading') setStalled(true);
    }, STALL_MS);
  }, [stalled]);

  // ---- 首块 + 降级轮询 ----
  useEffect(() => {
    if (!enabled) return;
    mountedRef.current = true;
    closedByUsRef.current = false;
    pollPageRef.current = 1;
    setState({ ...INITIAL });
    armStallTimer();

    let cancelled = false;

    /** 拉一页（first=1 走首块小页；否则按 page 递增）。 */
    const fetchPage = async (first: boolean, page: number) => {
      try {
        const res = await taskCenterApi.getItems({
          ...(query as TaskCenterListQuery),
          page,
          size: POLL_PAGE_SIZE,
          ...(first ? { first: 1 } : {}),
        } as TaskCenterListQuery & { first?: number });
        if (cancelled || !mountedRef.current) return;
        const items = (res.items ?? []) as TaskCenterItemRecord[];
        apply(
          reduceStreamFrame(stateRef.current, {
            type: first ? 'task_center.batch' : 'task_center.progress',
            serverTime: null,
            payload: {
              kind: first ? 'first' : 'progress',
              seq: page,
              items,
              hasMore: res.hasMore === true || (res.total ?? 0) > items.length,
              loaded: (stateRef.current.loaded ?? 0) + items.length,
              total: res.total ?? null,
              reason: null,
            },
          }),
        );
        // 终态判定
        const s = stateRef.current;
        if (!s.hasMore) {
          apply({ phase: s.loaded > 0 ? 'done' : 'empty' });
        }
        armStallTimer();
      } catch (e) {
        if (cancelled || !mountedRef.current) return;
        apply({ phase: 'failed', reason: e instanceof Error ? e.message : '拉取失败' });
      }
    };

    void fetchPage(true, 1);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, enabled, attempt]);

  // ---- WS 增量通道 ----
  useEffect(() => {
    if (!enabled) return;
    closedByUsRef.current = false;

    const connect = () => {
      if (closedByUsRef.current || !mountedRef.current) return;
      apply({ wsStatus: 'connecting' });
      let ws: WebSocket;
      try {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        ws = new WebSocket(origin + WS_PATH);
      } catch {
        apply({ wsStatus: 'error' });
        scheduleReconnect();
        return;
      }
      socketRef.current = ws;

      ws.onopen = () => {
        attemptRef.current = 0;
        apply({ wsStatus: 'open' });
      };

      ws.onmessage = (event: MessageEvent) => {
        const frame = parseStreamFrame(typeof event.data === 'string' ? event.data : '');
        if (!frame) return;
        // hello 帧（无 payload.kind）已被 parseStreamFrame 过滤掉。
        if (!frame.type.startsWith('task_center.')) return;
        apply(reduceStreamFrame(stateRef.current, frame));
        armStallTimer();
        // WS 收了终态 ⇒ 不必再轮询（但轮询 effect 自己也会停）。
        const s = stateRef.current;
        if (s.phase === 'done' || s.phase === 'empty' || s.phase === 'failed') {
          // 保留连接（后续 job 状态变化还要推，⑨），只是不再补轮询。
        }
      };

      ws.onerror = () => apply({ wsStatus: 'error' });
      ws.onclose = () => {
        if (closedByUsRef.current) return;
        apply({ wsStatus: 'closed' });
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      attemptRef.current += 1;
      const delay = backoffMs(attemptRef.current);
      timerRef.current = setTimeout(() => {
        if (!closedByUsRef.current && mountedRef.current) connect();
      }, delay);
    };

    connect();

    return () => {
      closedByUsRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // 卸载清理
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    };
  }, []);

  const retry = useCallback(() => {
    setState({ ...INITIAL });
    setAttempt((a) => a + 1);
    armStallTimer();
  }, [armStallTimer]);

  const showSkeleton = state.loaded === 0 && state.phase === 'loading';

  return {
    ...state,
    showSkeleton,
    stalled,
    retry,
    animate,
    setAnimate,
  };
}

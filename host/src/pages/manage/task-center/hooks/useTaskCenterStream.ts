/**
 * E3 前端半边：任务中心「可以慢，不能空」流式装配（只动 fmby-web）。
 *
 * 卡面红线（用户原话）：**可以慢，不能空** ✗ —— 用户点开什么也看不到 = 必被骂。
 * 本 hook 把「一次性等整页」改成「首块尽快出 + 按批 append + 卡死降级」：
 *
 *   status 六态（卡面 §3：绝不允许「空壳 = 未知」）：
 *     loading    首块未到（骨架期，≤300ms 即有骨架行）
 *     streaming   已出 N 条且 hasMore（顶部「已加载 N 条 · 仍在加载…」）
 *     stalled     超过 STALL_THRESHOLD_MS 仍无任何数据（降级文案 + 重试 + 后台提示）
 *     done        末批 hasMore=false（顶部「共 N 条」）
 *     empty       后端明确返回 0 条（「当前没有运行中的任务」+ 引导动作）
 *     error       取数失败（透传原因，不吞成空）
 *
 * ★与 WS 的关系（卡面 §9，本轮诚实的边界）：
 *   后端 `PlaybackRealtimeEventType`（crates/fmby-v2-application/src/playback/
 *   realtime.rs:37）当前只有 7 类 playback 事件，**无 task-center 事件** ⇒
 *   本轮前端不连 WS（连了也只会在 3s 后走进降级，反而是骗人）。
 *   `subscribeBatches` 做成**注入式 seam**：真页面注入轮询适配器（每批即一页），
 *   后端补了 task-center 事件后换注入 WS 适配器即可，**本 hook 与 UI 零改动**。
 *   降级路径（卡面 §4）已由 seam 覆盖：注入的订阅器返回 unsubscribe，
 *   页面据此回到轮询，UI 侧无感。
 *
 * ★纯函数与 React 分离：mergeBatch / nextStatusAfterBatch / buildStreamStatusText
 *   不碰 React，node:test 直跑（见 task-center-streaming.unit.test.ts）。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TaskCenterItemRecord } from '@fmby/v2-shared/contracts/manage/task-center';

/** 卡面 §7 给定：超过 3s 无任何数据 ⇒ 降级。 */
export const STALL_THRESHOLD_MS = 3000;

/** 卡面 §5：≤300ms 必须出内容 ⇒ 骨架行数（真 DOM 断言用）。 */
export const SKELETON_ROWS = 3;

/** 未启用流时的初值（页面走分页 REST，不用流式壳）。 */
const IDLE_STATE: TaskCenterStreamState = {
  status: 'done',
  items: [],
  total: 0,
  hasMore: false,
  errorMessage: null,
};

/** 流已启用但首批未到 ⇒ loading（骨架期）。 */
const LOADING_STATE: TaskCenterStreamState = {
  status: 'loading',
  items: [],
  total: 0,
  hasMore: false,
  errorMessage: null,
};

export type TaskCenterStreamStatus =
  | 'loading'
  | 'streaming'
  | 'stalled'
  | 'done'
  | 'empty'
  | 'error';

export interface TaskCenterStreamBatch {
  items: TaskCenterItemRecord[];
  total: number;
  hasMore: boolean;
}

export interface TaskCenterStreamState {
  status: TaskCenterStreamStatus;
  items: TaskCenterItemRecord[];
  total: number;
  hasMore: boolean;
  errorMessage: string | null;
}

export interface TaskCenterStreamOptions {
  /** 取首批（页面注入 taskCenterApi.getItems；探针注入可控延迟的假 loader）。 */
  loadFirstBatch: () => Promise<TaskCenterStreamBatch>;
  /**
   * 订阅后续批次；返回 unsubscribe。
   * 页面注入轮询适配器（每批 = 拉下一页）；后端有 task-center WS 事件后换 WS 适配器。
   */
  subscribeBatches: (
    onBatch: (batch: TaskCenterStreamBatch) => void,
    onDone: () => void,
  ) => () => void;
  /** 卡面 §7 的 3s 阈值（可注入以便测试加速；默认 3000）。 */
  stallThresholdMs?: number;
  /**
   * 是否启用本条流（默认 true）。
   * 页面在第 2 页及以后走**分页 REST**（既有翻页语义），此时不该再流式重拉首页
   * —— 否则用户翻到第 3 页时后台还在灌第 1 页，两份数据打架。
   */
  enabled?: boolean;
  /**
   * 重置键：变了就从头重开一条流（筛选/分页口径变化）。
   * ★为什么需要：options 走 ref（避开 setState-in-effect 无限循环），
   *   所以不能靠 options 身份变化触发重启；筛选一变必须重新流，否则会看到
   *   上一个筛选的旧行与新筛选批次混在一起。
   */
  resetKey?: string;
}

/**
 * §6 顶部文案：三态可辨（进行中 / 完成 / 空），且**必须看 status**。
 *
 * ★为什么 status 是必填参数而不是只看 loaded/hasMore：只按「loaded=0 且 hasMore=false」
 *   判空，会在**首帧**（items 还没到、状态还是 loading）就报「当前没有运行中的任务」
 *   —— 骨架行正在显示、任务可能还在跑，这句话就是谎报（与 FE-UI-2 P0-① 同一病灶，
 *   本卡自查轨迹实测抓到：n=0 那一格文案正是「当前没有运行中的任务」）。
 *   「没有任务」只能由后端明确返回 0 条（status=empty）来说。
 */
export function buildStreamStatusText({
  status,
  loaded,
  total = loaded,
}: {
  status: TaskCenterStreamStatus;
  loaded: number;
  /** 后端口径总数（缺省视为与 loaded 相同）。 */
  total?: number;
}): string {
  switch (status) {
    case 'loading':
      return '正在装载任务…';
    case 'stalled':
      return '装载受阻 · 可重试';
    case 'error':
      return '装载失败';
    case 'empty':
      return '当前没有运行中的任务';
    case 'streaming':
      return `已加载 ${loaded} 条 · 仍在加载…`;
    case 'done':
    default:
      if (loaded > 0) return `共 ${loaded} 条`;
      // ★loaded=0 但后端 total>0（首页空、总数非空）⇒ 不能说「没有运行中的任务」，
      //   那与后端自己报的 total 自相矛盾。如实说「没取回」。
      return total > 0 ? `未取回任务数据（后端口径共 ${total} 条）` : '当前没有运行中的任务';
  }
}

/** 合并一批：保序 append + 按 id 去重（WS 重连重放是真实场景）。 */
export function mergeBatch(
  state: TaskCenterStreamState,
  incoming: TaskCenterStreamBatch,
): TaskCenterStreamState {
  // ★fail-loud：批次形状不对（传了裸数组 / 缺 items）直接抛，**不静默当空批吞掉**。
  //   本仓踩过：探针把批次写成 `[[row]]` 而非 `{items:[row]}` ⇒ incoming.items=undefined
  //   ⇒ append 永远不生效、UI 卡在首块，而测试只报「没等到 4 条」这种模糊症状。
  //   把错提到数据进来那一刻，比让调用方猜布局问题便宜得多。
  if (!Array.isArray(incoming?.items)) {
    throw new Error(
      `mergeBatch 收到非法批次形状（期望 {items,total,hasMore}，实得 ${typeof incoming}）`,
    );
  }
  const seen = new Set(state.items.map((i) => `${i.category}:${i.id}`));
  const appended = incoming.items.filter((i) => {
    const key = `${i.category}:${i.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const items = [...state.items, ...appended];
  return {
    ...state,
    items,
    total: incoming.total,
    hasMore: incoming.hasMore,
    status: nextStatusAfterBatch(state, incoming),
  };
}

/**
 * 三态机（自洽，不依赖调用方先合并）：按「合并后的条数」判状态。
 *   首块未到（本批 0 条且 hasMore）⇒ loading（骨架期）
 *   有条且 hasMore                        ⇒ streaming
 *   末批 hasMore=false 且有条             ⇒ done
 *   末批 hasMore=false 且 0 条             ⇒ empty（明确无数据，非卡死）
 */
export function nextStatusAfterBatch(
  state: TaskCenterStreamState,
  incoming: TaskCenterStreamBatch,
): TaskCenterStreamStatus {
  const seen = new Set(state.items.map((i) => `${i.category}:${i.id}`));
  const nextItemCount =
    state.items.length + incoming.items.filter((i) => !seen.has(`${i.category}:${i.id}`)).length;
  if (incoming.hasMore) return nextItemCount > 0 ? 'streaming' : 'loading';
  return nextItemCount > 0 ? 'done' : 'empty';
}

export interface TaskCenterStreamResult extends TaskCenterStreamState {
  loadedCount: number;
  /** 卡面 §7 的重试入口（重新走首块 + 订阅）。 */
  retry: () => void;
}

export function useTaskCenterStream(
  options: TaskCenterStreamOptions,
): TaskCenterStreamResult {
  const stallMs = options.stallThresholdMs ?? STALL_THRESHOLD_MS;
  // ★初值必须按 enabled 分叉，不能一律 IDLE_STATE：
  //   IDLE 的 status='done' + loaded=0 会让**首帧**文案变成「当前没有运行中的任务」——
  //   骨架还没跑完就替后端断言「没有任务」，正是 P0-① 的谎报同型病灶
  //   （本卡自查轨迹实测抓到：n=0 那一格就是这句）。
  const [state, setState] = useState<TaskCenterStreamState>(() =>
    options.enabled === false ? IDLE_STATE : LOADING_STATE,
  );
  // 轮次令牌：retry / 卸载后旧批到达一律丢弃（不对已卸载视图 setState）。
  const runRef = useRef(0);
  const mountedRef = useRef(true);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 当前这条流的退订函数（retry / 重开筛选时先切断上一条，避免两条流写同一个 state）。 */
  const unsubscribeRef = useRef<(() => void) | null>(null);
  // ★options 走 ref：调用方每次 render 都传新对象字面量（页面里就是这样），
  //   若把 options 直接列进 useCallback 依赖 ⇒ effect 每次 render 重跑 ⇒
  //   setState-in-effect 无限循环（实测 React 报 "Maximum update depth exceeded"）。
  //   ref 让 start 的身份稳定，同时仍读到最新注入的 loader/subscriber。
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runRef.current += 1;
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, []);

  const start = useCallback(() => {
    const { loadFirstBatch, subscribeBatches } = optionsRef.current;
    // enabled=false：不取数、不起定时器，状态置 done（调用方此时不渲染流式壳）。
    if (optionsRef.current.enabled === false) {
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      setState(IDLE_STATE);
      return () => {};
    }
    const run = runRef.current + 1;
    runRef.current = run;
    // 重开前切断上一条订阅：retry() 直接调 start（没有 effect cleanup 接手），
    // 不切断会让上一条轮询定时器继续跑 ⇒ 两条流写同一个 state、行会交错。
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    setState({ status: 'loading', items: [], total: 0, hasMore: false, errorMessage: null });

    // 卡面 §7：首块迟迟不来 ⇒ stallMs 后进 stalled（带降级文案 + 重试 + 后台提示）。
    stallTimerRef.current = setTimeout(() => {
      if (!mountedRef.current || runRef.current !== run) return;
      setState((prev) => (prev.status === 'loading' ? { ...prev, status: 'stalled' } : prev));
    }, stallMs);

    void loadFirstBatch()
      .then((first) => {
        if (!mountedRef.current || runRef.current !== run) return;
        if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
        setState((prev) => mergeBatch(prev, first));
      })
      .catch((err: unknown) => {
        if (!mountedRef.current || runRef.current !== run) return;
        if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
        setState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: err instanceof Error ? err.message : String(err),
        }));
      });

    const unsubscribe = subscribeBatches(
      (batch) => {
        if (!mountedRef.current || runRef.current !== run) return;
        if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
        setState((prev) => (prev.status === 'stalled' ? { ...prev, status: 'streaming' } : prev));
        setState((prev) => mergeBatch(prev, batch));
      },
      () => {
        if (!mountedRef.current || runRef.current !== run) return;
        if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
        setState((prev) =>
          prev.hasMore && prev.items.length > 0 ? { ...prev, hasMore: false, status: 'done' } : prev,
        );
      },
    );
    unsubscribeRef.current = unsubscribe;
    return unsubscribe;
  }, [stallMs, options.resetKey, options.enabled]);

  useEffect(() => {
    const unsubscribe = start();
    return () => {
      unsubscribe?.();
    };
  }, [start]);

  const retry = useCallback(() => {
    start();
  }, [start]);

  return { ...state, loadedCount: state.items.length, retry };
}

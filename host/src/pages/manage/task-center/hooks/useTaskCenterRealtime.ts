/**
 * E3 前端半边：任务中心分批推送消费（复用既有 WS 通道）。
 *
 * 后端已落地（w06 仓）：`/api/playback/realtime/ws?scope=admin` 推
 * `task.center.batch` 帧（batch_seq 单调 / batch_index / has_more / items）。
 * 本 hook 只消费这一种事件；断线退避照 `useOperationsRealtime` 同款（指数封顶）。
 *
 * 纪律：
 * - **丢帧检测**：`batch_seq` 跳号 ⇒ `seqGapped = true` ⇒ 调用方全量重拉
 *   （既有分页端点 `/api/manage/task-center/items`）——这是「降级分页轮询」的落点；
 * - **append 计数正确**：`applyTaskCenterBatch` 纯函数返回追加条数与合并后列表；
 * - 非本事件帧安全丢弃（不崩）；零新依赖。
 */

import { useEffect, useRef, useState } from 'react';

/** 与后端 `TaskCenterBatchItem` 的 wire 形状对齐（snake_case 由 WS 直接透传）。 */
export interface TaskCenterBatchItemWire {
  category: string;
  id: string;
  status: string;
  bucket: 'pending' | 'active' | 'terminal';
  title?: string | null;
  updated_at?: string | null;
}

export interface TaskCenterBatchWire {
  batch_seq: number;
  batch_index: number;
  has_more: boolean;
  total_hint: number;
  items: TaskCenterBatchItemWire[];
}

/** 解析一帧文本为 task.center.batch；非 JSON / 非本事件 / 缺字段 ⇒ null（不崩）。 */
export function parseTaskCenterBatch(text: string): TaskCenterBatchWire | null {
  let msg: { type?: string; payload?: Partial<TaskCenterBatchWire> };
  try {
    msg = JSON.parse(text);
  } catch {
    return null;
  }
  if (
    typeof msg !== 'object' ||
    msg === null ||
    msg.type !== 'task.center.batch' ||
    typeof msg.payload !== 'object' ||
    msg.payload === null ||
    typeof msg.payload.batch_seq !== 'number' ||
    !Array.isArray(msg.payload.items)
  ) {
    return null;
  }
  return msg.payload as TaskCenterBatchWire;
}

/** 列表行的最小形状（与 `TaskCenterItemRecord` 的可写字段对齐）。 */
export interface TaskCenterRow {
  category: string;
  id: string;
  status: string;
}

/**
 * 把一批变化合并进当前列表（纯函数，可测）。
 *
 * 合并语义（last-write-wins，与后端 coalesce 同口径）：
 * - 同 `(category, id)` 已存在 ⇒ **原地更新**该行 status；
 * - 不存在 ⇒ **头部插入**（新事件最新在前，与列表 `updated_at DESC` 排序一致）。
 *
 * 返回 `{ rows, appended, updated }`：
 * - `appended` = 新插入条数（卡面「每批 append 计数正确」的断言对象）；
 * - `updated` = 原地更新条数。
 */
export function applyTaskCenterBatch(
  rows: TaskCenterRow[],
  batch: TaskCenterBatchWire,
): { rows: TaskCenterRow[]; appended: number; updated: number } {
  let appended = 0;
  let updated = 0;
  const next = [...rows];
  for (const item of batch.items) {
    const idx = next.findIndex(
      (r) => r.category === item.category && r.id === item.id
    );
    if (idx >= 0) {
      next[idx] = { ...next[idx], status: item.status };
      updated += 1;
    } else {
      next.unshift({ category: item.category, id: item.id, status: item.status });
      appended += 1;
    }
  }
  return { rows: next, appended, updated };
}

/** 连接状态（与 useOperationsRealtime 同词表）。 */
export type TaskCenterRealtimeStatus = 'connecting' | 'open' | 'closed' | 'error';

export interface TaskCenterRealtimeState {
  status: TaskCenterRealtimeStatus;
  /** 最近一次收到的 batch_seq（null = 尚未收到）。 */
  lastBatchSeq: number | null;
  /** 累计 append 条数（卡面 ② 的断言对象：每批 append 计数正确）。 */
  totalAppended: number;
  /** 累计原地更新条数。 */
  totalUpdated: number;
  /** batch_seq 跳号（丢帧）⇒ 调用方必须全量重拉。 */
  seqGapped: boolean;
  /** 最近一批的 items（调用方合并进列表）。 */
  lastBatch: TaskCenterBatchWire | null;
}

const INITIAL: TaskCenterRealtimeState = {
  status: 'connecting',
  lastBatchSeq: null,
  totalAppended: 0,
  totalUpdated: 0,
  seqGapped: false,
  lastBatch: null,
};

/** 重连退避（与 useOperationsRealtime 同款：1s→2s→…封顶 15s）。 */
export function taskCenterBackoffMs(attempt: number): number {
  return Math.min(15_000, 1000 * 2 ** Math.max(0, attempt - 1));
}

function wsUrl(origin: string): string {
  return `${origin}/api/playback/realtime/ws?scope=admin`;
}

/**
 * 任务中心分批推送消费 hook（管理面 only；`scope=admin` 由 WS 路径携带）。
 *
 * 返回实时状态 + 最近一批 items；调用方（页面）负责把 `lastBatch` 合并进
 * react-query 缓存/本地列表，并在 `seqGapped === true` 时全量重拉。
 */
export function useTaskCenterRealtime(
  enabled = true
): TaskCenterRealtimeState {
  const [state, setState] = useState<TaskCenterRealtimeState>(INITIAL);
  const stateRef = useRef(state);
  stateRef.current = state;
  const socketRef = useRef<WebSocket | null>(null);
  const closedByUsRef = useRef(false);
  const mountedRef = useRef(true);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      closedByUsRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    closedByUsRef.current = false;

    const connect = () => {
      if (closedByUsRef.current || !mountedRef.current) return;
      let ws: WebSocket;
      try {
        ws = new WebSocket(
          wsUrl(typeof window !== 'undefined' ? window.location.origin : '')
        );
      } catch {
        if (mountedRef.current) setState((p) => ({ ...p, status: 'error' }));
        scheduleReconnect();
        return;
      }
      socketRef.current = ws;
      ws.onopen = () => {
        attemptRef.current = 0;
        if (mountedRef.current) setState((p) => ({ ...p, status: 'open' }));
      };
      ws.onmessage = (event: MessageEvent) => {
        const text = typeof event.data === 'string' ? event.data : '';
        const batch = parseTaskCenterBatch(text);
        if (!batch || !mountedRef.current) return;
        setState((prev) => {
          const prevSeq = prev.lastBatchSeq;
          // 丢帧检测：非首次且 seq 不连续 ⇒ 标记跳号（调用方全量重拉）。
          const gapped = prevSeq !== null && batch.batch_seq > prevSeq + 1;
          const applied = applyTaskCenterBatch(
            [],
            batch
          );
          return {
            ...prev,
            status: 'open',
            lastBatchSeq: batch.batch_seq,
            totalAppended: prev.totalAppended + applied.appended,
            totalUpdated: prev.totalUpdated + applied.updated,
            seqGapped: prev.seqGapped || gapped,
            lastBatch: batch,
          };
        });
      };
      ws.onerror = () => {
        if (mountedRef.current) setState((p) => ({ ...p, status: 'error' }));
      };
      ws.onclose = () => {
        if (closedByUsRef.current) return;
        if (mountedRef.current) setState((p) => ({ ...p, status: 'closed' }));
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      attemptRef.current += 1;
      const delay = taskCenterBackoffMs(attemptRef.current);
      timerRef.current = setTimeout(connect, delay);
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
  }, [enabled]);

  return state;
}

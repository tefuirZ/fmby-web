/**
 * W5-E 卡 1（FE-OPS-REALTIME-WS）：运营看板实时通道。
 *
 * 后端已有等价 WS：`GET /api/playback/realtime/ws`（crates/fmby-v2-http/src/routes/playback.rs:264），
 * 推 `playback.active_snapshot` / `playback.source_load_snapshot` 两种快照（事件名与 V1 逐字一致）。
 * 本 hook 只消费这两个事件，无 SSE、无新端点。
 *
 * 纪律（卡面红线）：
 * - 失败 fail-closed + **重连退避**（指数退避封顶，不无限快速重连）；
 * - 卸载时**真关**连接，且卸载后不再 setState（用 ref 守卫，避免泄漏/告警）；
 * - 非 JSON 帧直接丢弃，不崩；
 * - 零新依赖；只动前端仓。
 *
 * 映射复用既有契约 mapper（snake→camel），与 REST 读法完全一致，不造第二套。
 */

import { useEffect, useRef, useState } from 'react';
import { operationsApi } from '@fmby/v2-shared/contracts/manage/operations';

const WS_PATH = '/api/playback/realtime/ws?scope=admin';

export interface OperationsRealtimeSnapshot {
  activePlayback: import('@fmby/v2-shared/contracts/manage/operations').OperationsActivePlaybackResponse | null;
  mountLoad: import('@fmby/v2-shared/contracts/manage/operations').OperationsMountLoadResponse | null;
  /** 最近一次成功接收快照的服务器时间（RFC3339），用于 UI 呈现「实时」新鲜度。 */
  lastEventAt: string | null;
  /** 连接状态：connecting / open / closed / error（fail-closed 时不抛，仅记为 error）。 */
  status: 'connecting' | 'open' | 'closed' | 'error';
}

const INITIAL: OperationsRealtimeSnapshot = {
  activePlayback: null,
  mountLoad: null,
  lastEventAt: null,
  status: 'connecting',
};

/** 重连退避：1s → 2s → 4s → … 封顶 15s，避免断线时无限快速重连打爆后端。 */
export function backoffMs(attempt: number): number {
  const base = 1000;
  const cap = 15000;
  return Math.min(cap, base * 2 ** Math.max(0, attempt - 1));
}

function wsUrl(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return origin + WS_PATH;
}

/**
 * 解析一帧文本。非 JSON / 未知事件 / 缺 type 一律安全返回 null（不崩）。
 */
function parseFrame(text: string): { type: string; serverTime: string | null; payload: unknown } | null {
  let msg: { type?: string; server_time?: string; payload?: unknown };
  try {
    msg = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof msg !== 'object' || msg === null || typeof msg.type !== 'string') {
    return null;
  }
  return { type: msg.type, serverTime: msg.server_time ?? null, payload: msg.payload ?? null };
}

/**
 * W5-E（纯函数，可单测）：把一帧已解析的事件应用到当前快照。
 * - `playback.active_snapshot` / `playback.source_load_snapshot` 映射到既有域类型（复用契约 mapper）；
 * - 非 JSON / 未知事件 / 映射失败 → 返回原 state（不崩、不丢连接）；
 * - 不碰 React，便于在 node:test 下用真实输入断言「UI 真更新」。
 */
export function reduceRealtimeFrame(
  state: OperationsRealtimeSnapshot,
  frame: { type: string; serverTime: string | null; payload: unknown } | null,
): OperationsRealtimeSnapshot {
  if (!frame) return state; // 非 JSON / 缺 type：原样返回，不崩
  try {
    if (frame.type === 'playback.active_snapshot') {
      const mapped = operationsApi.fromActiveSnapshotEvent(
        frame.payload as Parameters<typeof operationsApi.fromActiveSnapshotEvent>[0],
      );
      return { ...state, activePlayback: mapped, lastEventAt: frame.serverTime, status: 'open' };
    }
    if (frame.type === 'playback.source_load_snapshot') {
      const mapped = operationsApi.fromMountLoadEvent(
        frame.payload as Parameters<typeof operationsApi.fromMountLoadEvent>[0],
      );
      return { ...state, mountLoad: mapped, lastEventAt: frame.serverTime, status: 'open' };
    }
    // hello / session_* 等其它事件：忽略，返回原 state
    return state;
  } catch {
    return state; // 单帧映射失败不影响连接
  }
}

export function useOperationsRealtime(enabled = true): OperationsRealtimeSnapshot {
  const [snapshot, setSnapshot] = useState<OperationsRealtimeSnapshot>(INITIAL);
  const snapshotRef = useRef<OperationsRealtimeSnapshot>(INITIAL);
  snapshotRef.current = snapshot;
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
    if (!enabled) {
      return;
    }
    closedByUsRef.current = false;

    const apply = (next: Partial<OperationsRealtimeSnapshot>) => {
      if (!mountedRef.current) return; // 卸载后绝不 setState
      setSnapshot((prev) => ({ ...prev, ...next }));
    };

    const connect = () => {
      if (closedByUsRef.current || !mountedRef.current) return;
      apply({ status: 'connecting' });
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl());
      } catch {
        apply({ status: 'error' });
        scheduleReconnect();
        return;
      }
      socketRef.current = ws;

      ws.onopen = () => {
        attemptRef.current = 0;
        apply({ status: 'open' });
      };

      ws.onmessage = (event: MessageEvent) => {
        const frame = parseFrame(typeof event.data === 'string' ? event.data : '');
        if (!frame) return; // 非 JSON / 未知帧：丢弃，不崩
        // 卸载后绝不 setState（mountedRef 守卫在 apply 内）
        apply(reduceRealtimeFrame(snapshotRef.current, frame));
      };
      ws.onerror = () => {
        apply({ status: 'error' });
      };

      ws.onclose = () => {
        if (closedByUsRef.current) return;
        apply({ status: 'closed' });
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

  return snapshot;
}

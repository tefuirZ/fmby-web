/**
 * Skin 实时状态源（WEB-C1 ④：实时显示必须有——接口先行 + 轮询兜底）。
 *
 * 当前形态：host 统一控制的轮询（按 interval 触发 listener + 刷新时间戳）。
 * TODO(realtime)：后端实时推送面（SSE/WebSocket）就绪后，在此切换为
 * 订阅通道（isLive = true），轮询保留为断线兜底；主题侧契约
 * `SkinRealtime` 不变，主题永远不自建定时器/连接。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SkinRealtime } from '@fmby/v2-shared/theme';

/** 轮询兜底默认间隔（ms）。实时面接入后此值仅作断线重连兜底节奏。 */
export const SKIN_REALTIME_POLL_INTERVAL_MS = 15_000;

/**
 * 提供一个 SkinRealtime 句柄：`subscribe` 在轮询节拍（或未来推送事件）上触发。
 *
 * 轮询仅在存在订阅者时运行（引用计数），避免无主题 skin 挂载时空转。
 */
export function useSkinRealtime(intervalMs = SKIN_REALTIME_POLL_INTERVAL_MS): SkinRealtime {
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const listenersRef = useRef(new Set<() => void>());

  useEffect(() => {
    if (subscriberCount === 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setLastRefreshedAt(Date.now());
      for (const listener of listenersRef.current) {
        listener();
      }
    }, intervalMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [intervalMs, subscriberCount]);

  // ponytail: 订阅身份恒定（空依赖）——主题的 useEffect 依赖它，故每次推送
  // 不得换引用，否则皮肤 effect 全量重建（#290）。升级路径：真有需要换订阅
  // 句柄时（如按域隔离通道）再引入显式 channel key。
  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    // 首个订阅者进入 → 立即触发一次（不等下一拍）。
    setLastRefreshedAt(Date.now());
    setSubscriberCount(listenersRef.current.size);
    return () => {
      listenersRef.current.delete(listener);
      setSubscriberCount(listenersRef.current.size);
    };
  }, []);

  return useMemo<SkinRealtime>(
    () => ({
      lastRefreshedAt,
      // TODO(realtime)：推送通道接入前恒 false（轮询兜底形态，诚实标注）。
      isLive: false,
      subscribe,
    }),
    [lastRefreshedAt, subscribe],
  );
}

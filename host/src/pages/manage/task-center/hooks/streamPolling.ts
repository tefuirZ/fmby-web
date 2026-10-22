/**
 * E3 前端半边：把分页 REST 端点包成「按批到达」的流（卡面 §4 的降级形态）。
 *
 * 为什么需要它：后端 WS（`/api/playback/realtime/ws`）当前只推 playback 七类事件
 * （crates/fmby-v2-application/src/playback/realtime.rs:37 `PlaybackRealtimeEventType`），
 * **没有 task-center 事件** ⇒ 前端不能假装有推送。卡面 §4 明确授权降级：
 * 「WS 不可用时自动退回分页轮询 ✓ 依然分批出 ✓ 不出现整页空白 ✗」。
 * 本模块就是那条降级路：逐页拉 ⇒ 每页作为一批交给订阅器，UI 侧与 WS 形态同构
 * （都是 `TaskCenterStreamBatch`），后端补了事件只换 `subscribeBatches` 的实现。
 *
 * 批次语义（对齐卡面「一次 2–3 条也行」）：
 *   首批 = page 1；之后每 batchDelayMs 推下一页；累计到 total 或某页空 ⇒ onDone。
 *   hasMore 由「累计条数 < 后端 total 且本页非空」推得 ⇒ 末批一定 hasMore=false
 *   （否则顶部永远挂「仍在加载…」，就是卡面禁的无限转圈）。
 */

import type { TaskCenterItemRecord } from '@fmby/v2-shared/contracts/manage/task-center';
import type { TaskCenterStreamBatch } from './useTaskCenterStream';

export interface PollingStreamOptions {
  /** 拉一页（页面侧注入 taskCenterApi.getItems，带自己的筛选口径）。 */
  fetchPage: (page: number) => Promise<{ items: TaskCenterItemRecord[]; total: number }>;
  /** 批间隔：让「一批批冒出来」在 UI 上真的可见（默认 600ms）。 */
  batchDelayMs?: number;
  /**
   * 最多推几页（默认 5 = 100 条量级）。
   * ★为什么必须封顶：不封顶时 5000 条 = 250 页 × 600ms ≈ 2.5 分钟的空转，
   *   用户既等不到「共 N 条」也停不下来 ⇒ 反而制造「无限转圈」（卡面 ✗ 项）。
   *   封顶后走 done，面板文案如实写「已加载 N 条（后端口径共 M 条）」——
   *   两个数都给，不假装显示完了。
   */
  maxPages?: number;
}

export interface PollingStream {
  loadFirstBatch: () => Promise<TaskCenterStreamBatch>;
  subscribeBatches: (
    onBatch: (batch: TaskCenterStreamBatch) => void,
    onDone: () => void,
  ) => () => void;
}

/** 每页之间默认留一拍，使增量肉眼可见（而不是瞬间全到 = 等价于整页加载）。 */
export const DEFAULT_BATCH_DELAY_MS = 600;

/** 默认最多推 5 页（≈100 条）后收口，避免大列表下变成分钟级空转。 */
export const DEFAULT_MAX_STREAM_PAGES = 5;

export function createPollingStream(options: PollingStreamOptions): PollingStream {
  const batchDelayMs = options.batchDelayMs ?? DEFAULT_BATCH_DELAY_MS;
  const maxPages = options.maxPages ?? DEFAULT_MAX_STREAM_PAGES;
  // 同一实例内共享进度：首批记下累计数，订阅器从下一页接着推。
  let accumulated = 0;
  let total = 0;
  let nextPage = 2;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const batchOf = (items: TaskCenterItemRecord[], stillMore: boolean): TaskCenterStreamBatch => ({
    items,
    total,
    hasMore: stillMore,
  });

  return {
    loadFirstBatch: async () => {
      const first = await options.fetchPage(1);
      total = first.total;
      accumulated = first.items.length;
      nextPage = 2;
      // ★重开一条流要清 stopped：否则「取消订阅 → 重试」这条路会因残留的
      //   stopped=true 让 pump 首行直接 return，**一条批也不推、UI 永远停在首块**
      //   （实测踩过：retry 后什么都不来，且不报错，正是卡面禁的「空着放那儿」）。
      stopped = false;
      // 首批也要吃 maxPages 封顶（否则 maxPages=1 时首批仍报 hasMore=true ⇒ 订阅器接着推）。
      const stillMore =
        2 <= maxPages && accumulated < first.total && first.items.length > 0;
      return { items: first.items, total: first.total, hasMore: stillMore };
    },
    subscribeBatches: (onBatch, onDone) => {
      stopped = false;
      const pump = async () => {
        if (stopped) return;
        // 已取完或后端 total 已覆盖 ⇒ 收口（onDone），不再空转。
        if (accumulated >= total) {
          stopped = true;
          onDone();
          return;
        }
        let page;
        try {
          page = await options.fetchPage(nextPage);
        } catch {
          // 单页失败不吞成「没有更多」：交给 hook 的批次回调之外，这里直接收口，
          // 已由累计条数呈现的内容保持可见（不塌回白屏）。
          stopped = true;
          onDone();
          return;
        }
        if (stopped) return;
        nextPage += 1;
        accumulated += page.items.length;
        // 封顶或取满 ⇒ 收口（stillMore=false），done 文案负责把「没显示完」说清楚。
        const withinCap = nextPage <= maxPages;
        const stillMore = withinCap && accumulated < total && page.items.length > 0;
        onBatch(batchOf(page.items, stillMore));
        if (!stillMore) {
          stopped = true;
          onDone();
          return;
        }
        timer = setTimeout(pump, batchDelayMs);
      };
      timer = setTimeout(pump, batchDelayMs);
      return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
      };
    },
  };
}

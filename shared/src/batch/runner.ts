/**
 * 批量操作状态机（FE-OPT-04）——纯函数/纯类型，无 React 依赖。
 *
 * 设计前提（后端现状，见本卡 evidence）：管理面**无批量端点**（`/manage/users/batch/*`
 * 等为 501 stub），只有部分域有真实**逐条**端点（mounts / collections 删除）。
 * 因此批量 = **客户端编排**：对选中项逐条调用既有单条 API，逐条采集状态
 * （pending/running/ok/fail），失败项可单条重试。本模块是该编排的纯内核，
 * 便于 node:test 直接断言而不依赖浏览器。
 */

/** 单项批量状态。 */
export type BatchItemStatus = 'pending' | 'running' | 'ok' | 'fail';

/** 单项批量状态快照。 */
export interface BatchItemState {
  /** 项稳定 id（列表行 id）。 */
  id: string;
  /** 展示标签（失败项列表用）。 */
  label: string;
  status: BatchItemStatus;
  /** 失败原因（status='fail' 时非空）。 */
  error?: string;
}

/** 单次批量运行汇总。 */
export interface BatchRunSummary {
  total: number;
  ok: number;
  fail: number;
  /** 被中断（abort）时未处理的项数。 */
  skipped: number;
}

/** 从状态列表派生汇总（纯函数）。 */
export function summarize(items: readonly BatchItemState[]): BatchRunSummary {
  let ok = 0;
  let fail = 0;
  let pending = 0;
  for (const item of items) {
    if (item.status === 'ok') ok++;
    else if (item.status === 'fail') fail++;
    else pending++;
  }
  return { total: items.length, ok, fail, skipped: pending };
}

/** 失败项（供"重试失败项"）。 */
export function failedItems(items: readonly BatchItemState[]): BatchItemState[] {
  return items.filter((item) => item.status === 'fail');
}

/** 是否仍有未完成项（running/pending）——决定进度面板是否还在跑。 */
export function isBatchRunning(items: readonly BatchItemState[]): boolean {
  return items.some((item) => item.status === 'running' || item.status === 'pending');
}

/** 批量运行选项。 */
export interface RunBatchOptions {
  /** 并发度（默认 1 = 串行；后端逐条端点无批量语义，串行避免压垮 + 状态可读）。 */
  concurrency?: number;
  /** 每项状态变化回调（UI 增量渲染）。 */
  onUpdate?: (item: BatchItemState) => void;
  /** 单项完成回调（含 ok/fail）。 */
  onItemDone?: (item: BatchItemState) => void;
  /** 中断信号：置 true 后不再派发新项（在飞项跑完）。 */
  shouldAbort?: () => boolean;
}

/**
 * 逐条执行批量操作（串行或限定并发），返回最终状态快照。
 *
 * `runOne` 抛错 → 该项 `fail`（错误消息入 `error`），不中断其余项——这是
 * "部分成功 + 失败可重试"的语义基础（批量删除里一条 404 不该回滚其余）。
 *
 * 纯编排：不直接碰 React/queryClient；调用方在 `onUpdate` 里写状态即可。
 */
export async function runBatch(
  items: readonly Pick<BatchItemState, 'id' | 'label'>[],
  runOne: (id: string) => Promise<void>,
  options: RunBatchOptions = {},
): Promise<BatchItemState[]> {
  const concurrency = Math.max(1, options.concurrency ?? 1);
  const states: BatchItemState[] = items.map((item) => ({
    id: item.id,
    label: item.label,
    status: 'pending',
  }));
  const emit = (state: BatchItemState) => options.onUpdate?.({ ...state });
  // 初始 pending 广播
  for (const state of states) emit(state);

  let cursor = 0;
  const worker = async () => {
    while (cursor < states.length) {
      if (options.shouldAbort?.()) return;
      const index = cursor++;
      const state = states[index];
      state.status = 'running';
      emit(state);
      try {
        await runOne(state.id);
        state.status = 'ok';
        state.error = undefined;
      } catch (error) {
        state.status = 'fail';
        state.error = error instanceof Error ? error.message : String(error);
      }
      emit(state);
      options.onItemDone?.({ ...state });
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, states.length) }, () => worker());
  await Promise.all(workers);
  return states;
}

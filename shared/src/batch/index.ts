/**
 * 批量操作体感内核（FE-OPT-04）
 *
 * - `selection.ts`：全选 / 反选 / 范围选（shift）纯函数；
 * - `runner.ts`：逐条执行 + 状态（pending/running/ok/fail）+ 失败可重试纯编排。
 *
 * 设计前提：管理面**无批量端点**（见 evidence），批量 = 客户端对既有单条 API
 * 的**逐条编排**；故内核不依赖 React/后端批量语义，可被 node:test 直接断言。
 */

export {
  toggleOne,
  selectAll,
  clearVisible,
  invertVisible,
  toggleRange,
  headerCheckState,
  pruneSelection,
} from './selection';
export type { ToggleRangeArgs } from './selection';

export {
  runBatch,
  summarize,
  failedItems,
  isBatchRunning,
} from './runner';
export type {
  BatchItemStatus,
  BatchItemState,
  BatchRunSummary,
  RunBatchOptions,
} from './runner';

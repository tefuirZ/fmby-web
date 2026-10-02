// runtime 日志呈现：桶入口。
// FE-COMPONENT-SPLIT-B2 按职责拆为 runtimeLogLabels / runtimeLogFormatters / runtimeLogFields，
// 本文件仅保留兼容 re-export，确保既有 import 路径（../runtimeLogPresentation）行为不变。
export type { RuntimeLogFieldView, RuntimeLogView } from './runtimeLogFields';
export {
  buildRuntimeLogView,
  extractStructuredFields,
  formatRuntimeTargetLabel,
} from './runtimeLogFields';

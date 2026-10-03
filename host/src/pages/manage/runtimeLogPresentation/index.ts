/**
 * 运行日志展示——**对外门面（barrel）**（FE-COMPONENT-SPLIT-B2）。
 *
 * 原 `runtimeLogPresentation.ts` 506 行超 500 硬红线，按 FE-MOUNT-AGGREGATE 范式
 * 拆为 `labels` / `format` / `view` 三桶（目录 + barrel + 子模块）。
 *
 * ★**导出面逐字保住**（拆分前后对外完全一致，仅此 5 项对消费方可见）：
 *   - `RuntimeLogFieldView`、`RuntimeLogView`（接口）
 *   - `buildRuntimeLogView`、`extractStructuredFields`、`formatRuntimeTargetLabel`
 * 消费方 `import ... from '.../runtimeLogPresentation'` 无需改动。
 */

export type { RuntimeLogFieldView, RuntimeLogView } from './view';
export {
  buildRuntimeLogView,
  extractStructuredFields,
  formatRuntimeTargetLabel,
} from './view';

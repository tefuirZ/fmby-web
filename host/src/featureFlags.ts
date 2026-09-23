/**
 * Vite Feature Flags
 *
 * 开发态启用：在 apps/web/.env.development.local 中添加：
 *   VITE_FEATURE_PAN115_IMGHOST=1
 *
 * 生产构建默认关闭，Vite 的静态替换 + Tree-shake 保证相关模块不进主 bundle。
 */

export const PAN115_IMGHOST_ENABLED =
  import.meta.env.VITE_FEATURE_PAN115_IMGHOST === '1';

/**
 * 付费能力判定（照 V1 `shared/featureFlags.ts` 的 `canUsePaidFeature` 对位）。
 *
 * 实现对位在 Vite-free 模块 `@/pages/manage/license/licenseAccess`（顶层含
 * `import.meta.env` 的模块无法被 node:test 导入）；判定用**真** `summary.visibility`，
 * 绝不是 env 开关。
 */
export { canUsePaidFeature, isPaidFeatureEnabled } from '@/pages/manage/license/licenseAccess';

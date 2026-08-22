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

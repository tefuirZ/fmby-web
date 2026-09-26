/**
 * 页面域类型（WEB-C1 粗粒度定版，ADR-001 §3）。
 *
 * 粗粒度原则：域内子页（如 manage 下的媒体/用户/安全）由主题在同一 skin 内
 * 自行重排——host 不按子路由细分 domain，避免 skins 键爆炸与主题碎片化。
 *
 * 说明（FE-MOD-P2-BATCH ② FE-BARREL-CYCLE）：本类型自 `./index` 下沉到本叶子
 * 模块，因 `./capabilities` 需要 `PageDomain` 而 `./index` 又 re-export
 * `./capabilities`，形成 `index → capabilities → index` 环。定义在叶子后
 * index 与 capabilities 同向引它，环消除；`@fmby/v2-shared/theme` 的导出面不变
 * （index 仍 re-export `PageDomain`）。
 */
export type PageDomain =
  | 'browse.home'
  | 'browse.library'
  | 'browse.item'
  | 'browse.play'
  | 'manage'
  | 'settings'
  | 'observability';

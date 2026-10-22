/**
 * 免费基线能力清单（前端侧）——**与后端 `domain::license::FREE_BASELINE_FEATURES` 同源**。
 *
 * 用途：当服务端以 `license_feature_denied` 拒绝时，判断被拒的能力**是不是用户已被
 * 承诺免费的那 12 项**。若是，后端文案「请购买/升级授权」对用户就是**错的**——
 * 那会让人以为自己要掏钱买一个承诺免费的功能。
 *
 * ★口径来源：用户 2026-10-20 裁定（免费 12 项）。后端单源在
 * `crates/fmby-v2-domain/src/license.rs`；本表是它的前端镜像，改一边必须同步另一边。
 * 有对拍测试（`docs` 侧提醒 + PR 说明）；漂移风险已知并接受（前端不引 Rust 常量）。
 */
export const FREE_BASELINE_FEATURES: readonly string[] = [
  'feature.storage.local', // 本地数据源
  'feature.metadata.scrape', // 基础刮削
  'feature.compat.emby', // Emby 兼容层
  'feature.storage.pan115.provider', // 115 普通网盘
  'feature.storage.pan115.share', // 115 分享挂载
  'feature.storage.microsoft.provider', // 微软 SharePoint
  'feature.storage.alist.provider', // AList
  'feature.storage.openlist.provider', // OpenList
  'feature.upstream.apple_cms', // AppleCMS 导入
  'feature.open_api', // Open API
  'feature.metadata.advanced_scrape', // 高级刮削
  'feature.probe.remote', // 远程探测
];

/** 该能力键是否属**免费基线**（= 用户已承诺免费，不该提示「需购买」）。 */
export function isFreeBaselineFeature(key: string): boolean {
  return FREE_BASELINE_FEATURES.includes(key);
}

/**
 * 从后端错误文案里抽出能力键。
 *
 * 后端原文形如：`当前授权不包含能力 feature.compat.emby（请购买/升级授权）`。
 * 抽不到（文案改版 / 未带键）⇒ `null`，调用方按原样展示（不猜）。
 */
export function extractFeatureKeyFromMessage(message: string): string | null {
  const match = message.match(/\bfeature\.[a-z0-9_.]+/i);
  return match ? match[0] : null;
}

/** 免费能力被拒时的**如实**文案（不写"需购买"）。 */
export function freeBaselineDeniedMessage(featureKey: string): string {
  return (
    `该功能（${featureKey}）属于免费承诺能力，当前实例暂不可用——` +
    `这是服务端授权判定的问题，我们正在修；你的授权无需任何变更。`
  );
}

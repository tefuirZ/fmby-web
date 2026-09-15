/**
 * 模板主题入口（`_template`）——**第三方主题完整样板**。
 *
 * 复制本目录即可起步你自己的主题。这里演示了两件事：
 * 1. **tokens.css**：设计 token 层（换肤根基）；
 * 2. **L3 域皮肤**：`src/skins/ItemSkin.ts` ——一个**真实可用**的 `browse.item`
 *    皮肤（不是空骨架），连同 `skins/item.css` 的版式与五态样式。
 *
 * ── 起步三处改名（复制后）──────────────────────────────────────────
 * | 位置 | 改成 |
 * |---|---|
 * | `package.json` 的 `name` | `@fmby/v2-theme-<你的 id>` |
 * | `theme.manifest.json` 的 `id` | `"<你的 id>"`（与 package name 一致） |
 * | `theme.manifest.json` 的 `label` | `"<切换器显示名>"` |
 *
 * ── 铁律（ADR-001 §3，`pnpm verify` 强制）──────────────────────────
 * 主题是**纯外观**：不得自带 API client / 取数 / 权限判断 / 路由字面量 /
 * 业务数据预加载（`preload` 恒 `false`）。数据一律由 host 经 `SkinProps` 注入。
 *
 * 完整步骤见同目录 `README.md` 与 `docs/theme-guide/`。
 */

import type {
  ThemeCapabilitiesDeclaration,
  ThemeEntryModule,
  ThemeManifest,
} from '@fmby/v2-shared/theme';
import { ItemSkin } from './skins/ItemSkin';
import manifestRaw from '../theme.manifest.json';

const manifest = manifestRaw as unknown as ThemeManifest;

/**
 * 能力面声明（ADR-001 §3 / WEB-GOV ④）。
 *
 * 门禁规则「**声明即负责**」：本主题在 `manifest.skins` 声明了 `browse.item`，
 * 就必须覆盖该域要求的四项能力面——`check-theme-parity.mjs` 据此校验。
 * `ItemSkin` 已逐项落实：
 * - `realtime`：挂载即 `realtime.subscribe(...)`（host 轮询兜底）；
 * - `mobile`：`skins/item.css` 的 `<768px` 单列媒体查询；
 * - `timezone`：不自行做时间偏移（时间派生统一走 shared，主题不碰）；
 * - `authorization`：`forbidden` 态有独立 DOM 输出（权限由 host 判定）。
 *
 * 若你的主题暂不声明任何域皮肤，可整段省略（门禁对未声明的域不校验）。
 */
const capabilities: ThemeCapabilitiesDeclaration = {
  global: ['realtime', 'mobile', 'timezone', 'authorization'],
};

const theme: ThemeEntryModule = {
  manifest,
  // L3 域皮肤映射：键 = PageDomain，值 = 组件。声明这里 + 同步 manifest.skins。
  domainSkins: {
    'browse.item': ItemSkin,
  },
  capabilities,
};

export default theme;

# 主题开发指南 · 一：从零做一个主题（getting-started）

> 面向读者：第一次给 FMBY v2 做主题的前端开发者。
> 前置阅读：契约仓 [skin-package 总览](https://github.com/tefuirZ/fmby-ui-contract-v2/tree/main/skin-package)与
> [API 契约](https://github.com/tefuirZ/fmby-ui-contract-v2/tree/main/api)（fmby-ui-contract-v2——主题可见的全部端点与包结构契约）。
>
> 本文所有命令与字段均对照前端仓 `fmby-web`（基线 web/main `64a589e`，v0.1.109 同源）实测（darkroom / _template 两主题即按此路径产出）。

---

## 0. 一分钟总览

FMBY v2 主题 = **纯外观包**：`tokens.css`（颜色变量）+ 可选 L3 域皮肤（React 组件）。

```
themes/<你的主题 id>/
├── package.json            # 包名 @fmby/v2-theme-<id>（workspace 成员）
├── theme.manifest.json     # 主题清单（host 启动时最先拉取，红线 < 2KB）
├── tokens.css              # 设计 token（:root 变量，全站换肤的根基）
├── [extra.css]             # 可选附加样式层（如环境光层）
├── tsconfig.json           # 复制 _template
└── src/
    └── index.ts            # 入口（默认导出 ThemeEntryModule）
```

三条铁律（ADR-001 §3，门禁强制）：

1. **纯外观**：禁止 API client / mapper / query keys / 权限判断 / 预加载业务数据（`preload` 恒 `false`）；
2. **体量红线**：单主题 ts ≤ 3000 行、dist ≤ 1.5MB（`check-theme-budget.mjs`）；
3. **首屏零主题**：主题产物必须是独立 async chunk，首屏不加载（`check-frontend-size.mjs` [5][6] 断言）。

---

## 1. 复制脚手架 `_template`

模板主题在仓内 `themes/_template/`（CSS-only 起手样板，含注册指引）：

```bash
# 在前端仓（fmby-web）根目录执行
cp -r themes/_template themes/mytheme
```

然后完成三处改名（模板入口注释里有同款清单）：

| 位置 | 改成 | 注意 |
|---|---|---|
| `themes/mytheme/package.json` 的 `name` | `@fmby/v2-theme-mytheme` | 与 manifest `id` 保持一致 |
| `theme.manifest.json` 的 `id` | `"mytheme"` | host 注册表按 id 登记 |
| `theme.manifest.json` 的 `label` | `"我的主题"` | 切换器里显示的中文名 |

---

## 2. manifest 字段（逐字段对照）

`theme.manifest.json` 是 host 启动时最先拉取的唯一主题资源，红线 **< 2048 字节**。字段与
`@fmby/v2-shared/theme` 的 `ThemeManifest` 类型一一对应：

```jsonc
{
  "id": "mytheme",                    // 稳定 id，等于 package.json name 去掉前缀
  "version": "0.1.109",               // 随主发布线版本号统一升版（check-versions 门禁）
  "label": "我的主题",                 // 切换器显示名
  "tokens": {
    "cssFile": "tokens.css",          // 必填：palette token 文件
    "extraCssFiles": ["aurora.css"]   // 可选：附加样式层（darkroom 的环境光层即此）
  },
  "entry": {
    "mount": "index.ts"               // 入口模块（相对 src/；默认 index.ts）
  },
  "skins": {},                        // L3 域皮肤映射（见《l3-skin.md》，可先留空）
  "nav": { "items": [] },             // 主题导航贡献（可空）
  "preload": false                    // 恒 false：禁止主题预加载业务数据（门禁强制）
}
```

**形态校验**：host 拉取后先跑 `isValidThemeManifest()`（shared `theme/index.ts`）再应用；
字段缺失或 `preload !== false` 会被拒收。

---

## 3. tokens.css 变量语言

token 是全站换肤的唯一通道：**host 的 CSS Module 全部消费变量名，不写死颜色**。
变量清单以 host 的 `defaults.css` 为准（变量名清单 + 兜底值都在那里），主题只改取值。

darkroom（暗房）的设计语言供参考——**兼容旧版全部变量名，仅改变取值**：

```css
:root {
  /* 画布：纯黑 */
  --bg-base: #000000;
  /* 没有卡片/毛玻璃/渐变——层级靠极细线 + 微提亮 */
  /* 品牌色不固定：浏览态由封面主色驱动（--content-accent） */
  /* 管理态用暗房安全灯琥珀（--safelight） */
  /* 圆角接近直角，投影只用于把海报从黑底「托」起来 */
}
```

对照模板 `_template/tokens.css`（石板蓝画布）：

```css
:root {
  --bg-base: #14161c;   /* 与 darkroom 的 #000000 形成「切主题可见」的对照 */
}
```

> **技巧**：让两个主题的 `--bg-base` 拉开差距（如 `#000` vs `#14161c`），
> 切换主题时画布颜色立变，是自检「tokens 热替换是否生效」最快的信号。

---

## 4. registry 登记

主题包建好后，需要在 host 的注册表里登记一行（`host/src/theme/registry.ts`）：

```ts
// 1) ?url 取资产生成地址（字符串常量，不加载、不执行任何主题字节）
import mythemeManifestUrl from '@fmby/v2-theme-mytheme/theme.manifest.json?url';
import mythemeTokensUrl from '@fmby/v2-theme-mytheme/tokens.css?url';

// 2) 注册表加一项：loadEntry 用动态 import()（产物独立 async chunk）
export const THEME_REGISTRY: Record<string, ThemeRegistration> = {
  // ...darkroom / template 既有项...
  mytheme: {
    id: 'mytheme',
    manifestUrl: mythemeManifestUrl,
    assets: { 'tokens.css': mythemeTokensUrl },
    loadEntry: () => import('@fmby/v2-theme-mytheme').then((m) => m.default),
  },
};
```

纪律（同 darkroom 先例）：

- 对主题包**只做两件事**：`?url` 取地址 + 动态 `import()` 声明懒入口；
- **不静态 import 主题代码**（否则主题进首屏，`check-frontend-size` [5] 直接红）。

---

## 5. verify 门禁清单（逐条，命令均可直接跑）

门禁脚本在前端仓 `scripts/`（WEB-GOV-3 后为**权威单源**，主仓（FMBY-V2）apps/ 过渡期副本已退役（WEB-GOV-3））。
提交前一键全链：

```bash
# 在前端仓（fmby-web）根目录
pnpm install
pnpm verify        # 全链九步门禁（任一步失败即停）
```

逐条单独跑（`node scripts/<脚本>` 形态，与仓内 scripts/ 目录一致）：

```bash
pnpm typecheck                   # 四包 tsc 全绿（shared + 2 themes + host）
pnpm build                       # vite build（产物层断言需要 dist）
pnpm test                        # 前端单测（node:test）

node scripts/check-frontend-size.mjs          # [1]-[4] 首屏体积/分包红线 + [5][6] 主题隔离断言
node scripts/check-frontend-dupes.mjs         # 主题纯度扫描（禁 API client/query keys/权限判断）
node scripts/check-theme-budget.mjs           # 主题体量：ts ≤ 3000 行 / dist ≤ 1.5MB
node scripts/check-theme-parity.mjs           # 声明了 domain skin → 四项能力面必须齐备
pnpm e2e                                      # Playwright（无 Rust server 二进制时整组 skip）
```

| 门禁 | 红线 | 失败时看什么 |
|---|---|---|
| size [1]-[4] | 首屏 JS ≤ 300KB gzip；主题资产 ≤ 400KB；manifest < 2KB | 输出逐 chunk 数字 |
| size [5] | 主题 chunk 必须是独立 async chunk 且不在首屏闭包 | `[FAIL] 主题 chunk 被首屏闭包引用` |
| size [6] | `dist/index.html` 直接引用脚本不得含 `LibrarySkin/DomainSkin/SkinProps` | `[FAIL] 首屏脚本含主题/skin 代码` |
| dupes | 主题内禁 API client / mapper / query keys / 权限判断 | 指出违规文件与行 |
| theme-budget | ts ≤ 3000 行 / dist ≤ 1.5MB | 超限并列出 Top5 膨胀文件 |
| theme-parity | 声明了 domain skin → 实时/移动端/时区/授权四项齐备 | 列出缺失的能力项 |

---

## 6. 最小可用清单（checklist）

- [ ] 复制 `_template` 并完成三处改名
- [ ] `theme.manifest.json` 七个必填字段齐、`preload: false`
- [ ] `tokens.css` 覆盖 host 的 `defaults.css` 的全部变量名（只改值）
- [ ] registry 登记一行（`?url` 资产 + 动态 `import()` 入口）
- [ ] `pnpm verify` 全绿
- [ ] 切换到自己的主题，画布颜色立变（tokens 热替换生效的最快自检）

到这里你拥有一个 **CSS-only 主题**（切换器可选、tokens 热替换）。想接管整个页面的
布局与交互（L3 域皮肤），继续读 [《二：L3 域皮肤开发》](./l3-skin.md)。

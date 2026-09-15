# FE-OPT-03 无障碍（a11y）系统化（w3 交付 · 前端仓 w/fe-opt-03）

> 基线：fmby-web main @ `61ec4fd`（含 WEB-E2E-FULL）。真实栈：真实 fmby-v2-server
> （debug，含取流路由修复）+ 真实 SQLite 三库 + 真实 HTTP + 真实浏览器（Playwright chromium）。
> 工具：`@axe-core/playwright` 4.13.0（WCAG 2.1 A/AA tag 集）。

## 八行报告

- **任务结论**：① 全站 **28 页** axe 扫描零违规（管理面 18 + 用户面 7 + 登录），覆盖对比度 / select-name / aria-prohibited-attr 等；② 键盘导航与焦点系统化（Tab 顺序、焦点可见、Esc、Ctrl+K、弹层自动聚焦、菜单 aria 语义）；③ 语义标签核查（landmark / 可访问名 / 装饰图标 aria-hidden）；④ 对比度达 WCAG AA（三套 token 上调）；⑤ **顺带修复 3 个阻碍 a11y 测量的 main 上真实回归**（主题激活链断裂）。
- **修改范围**：`host/e2e/a11y.spec.ts`(新)、`host/tests/theme-globals.test.ts`(新)、`host/src/theme/themeGlobals.ts`(新)、`host/src/theme/registry.ts`、`host/e2e/start.mjs`、`host/playwright.config.ts`、`host/vite.config.ts`、`host/package.json`、`host/src/styles/defaults.css`、`host/src/pages/browse/{LibrariesPage,LibraryDetailPage}.tsx`、`themes/darkroom/{tokens.css,src/skins/ItemSkin.ts}`、`themes/_template/{tokens.css,package.json}`。
- **测试**：`pnpm verify` 11 闸全绿；**Playwright 全量 77 passed / 0 failed**（a11y.spec 38 新 + 既有 39）；host node:test 14（含新 globals 回归 2）；shared 49；darkroom 14。
- **门禁**：axe WCAG2.1 A/AA 全页 0 违规；size/dupes/contracts/theme-budget/theme-parity 全 PASS。
- **Review**：a11y 测量的前提是**主题真实激活**——本卡先发现并修复了 main 上 3 个主题链回归（否则对比度只能测到 fallback 假色）。axe 集成零 mock，全部真实栈。
- **风险登记**：① axe 自动扫描覆盖 ~57% WCAG 条款（屏幕阅读器实读未做，见"未覆盖"）；② `--text-4` 上移使"最弱文本"层级差收窄（0.94/0.74/0.64/0.56），设计需知悉；③ 主题全局桥当前只绑 React 三件套，`FmbyShared` 未绑（见下）。
- **对主代理依赖**：无（3 个回归在同卡内修复，已登记）。
- **兼容性确认**：token 语义键名不变（仅取值上调）；`SkinProps` 契约零改动；主题 IIFE/`FmbyTheme` 单槽语义不变。

## 一、axe 全页面扫描结果（WCAG 2.1 A/AA）

真实栈下逐页 `new AxeBuilder().withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()`：

| 页 | 路由 | 修复前 | 修复后 |
| --- | --- | --- | --- |
| 登录 | `/login` | 0 | 0 |
| 首页 | `/` | **22**（对比度） | 0 |
| 观看历史 | `/history` | **3** | 0 |
| 媒体库列表 | `/libraries` | **2** + select-name×1 | 0 |
| 媒体库详情 | `/libraries/1` | **16** + select-name×4 | 0 |
| 条目详情 | `/item/101` | **6** + aria-prohibited-attr×1 | 0 |
| 设置·资料 | `/settings/profile` | **13** | 0 |
| 设置·播放 | `/settings/playback` | **15** | 0 |
| 设置·外观 | `/settings/appearance` | **17** | 0 |
| 管理首页 | `/manage` | **4** | 0 |
| 媒体来源 | `/manage/media/mounts` | **7** | 0 |
| 媒体库管理 | `/manage/media/libraries` | **6** | 0 |
| 收藏合集 | `/manage/collections` | **3** | 0 |
| 任务中心 | `/manage/task-center` | **4** | 0 |
| 探测任务 | `/manage/media/probe-tasks` | **4** | 0 |
| 命名刮削 | `/manage/media/naming-scrape` | **4** | 0 |
| 注册码 | `/manage/site/users/registration-codes` | **4** | 0 |
| 用户管理 | `/manage/site/users/accounts` | **4** | 0 |
| 权限模板 | `/manage/site/users/role-templates` | **4** | 0 |
| 积分与签到 | `/manage/site/rewards` | **5** | 0 |
| 会话管理 | `/manage/site/security/sessions` | **4** | 0 |
| 审计日志 | `/manage/site/security/audit-logs` | **4** | 0 |
| 运行日志 | `/manage/site/security/runtime-logs` | **4** | 0 |
| 站点设置 | `/manage/site/settings` | **5** | 0 |
| 授权与订阅 | `/manage/site/license` | **5** | 0 |
| Telegram 配置 | `/manage/site/telegram` | **5** | 0 |
| 密钥链管理 | `/manage/site/secrets` | **5** | 0 |
| 高级维护 | `/manage/site/advanced` | **4** | 0 |
| **合计** | 28 页 | **~170 节点违规** | **0** |

自动扫描锁定于 `host/e2e/a11y.spec.ts`（每页一条断言）。

## 二、修复项（a11y 违规）

### 2.1 对比度（color-contrast，serious）— 三套 token

**根因**：暗色主题的"弱文本"层级过暗。实测（axe data）`--text-4` 在真实画布上仅
**2.08–2.35:1**（AA 需 4.5:1）；`--text-3` 3.39–3.59:1 亦不达。

| token | 旧值 | 新值 | 最差对比度（修复后） |
| --- | --- | --- | --- |
| darkroom `--text-2` | `rgba(255,255,255,.62)` | `.74` | 8.1:1 |
| darkroom `--text-3` | `rgba(255,255,255,.38)` | `.64` | 6.1:1 |
| darkroom `--text-4` | `rgba(255,255,255,.26)` | `.56` | 4.7:1 |
| defaults `--text-4` | `#63666f` | `#858b95` | 4.87:1 |
| `_template` `--text-4` | `#666d7e` | `#8b92a2` | 4.78:1 |

判定口径：对主题**最亮有效画布**（raised-strong + surface overlay 叠亮）取最小值 ≥4.5:1。
`--text-1/--text-2` 维持原值（本就达标），仅上调 `--text-3/4`。禁用态（WCAG 1.4.3 豁免）
不依赖这些 token 的"暗"（其用 `--surface-3` 底）。

### 2.2 select-name（critical）— 媒体库筛选器

`LibrariesPage` 的类型筛选、`LibraryDetailPage` 的 4 个筛选 `<select>` 为裸元素、无
可访问名 → 屏幕阅读器读作"组合框"。补 `aria-label`：`媒体库类型筛选` /
`媒体类型筛选` / `分辨率筛选` / `观看状态筛选` / `排序方式`。

### 2.3 aria-prohibited-attr（serious）— darkroom ItemSkin 装饰 div

`themes/darkroom/src/skins/ItemSkin.ts` 的 `poster-frame` 是**纯装饰**空 div
（渐变占位、无内容；标题已由 `<h1>` 宣布），却带 `aria-label` → 无 role 元素禁带。
改为 `aria-hidden="true"`（装饰元素对 AT 应不可见）。

## 三、顺带修复：main 上主题激活链 3 处回归（a11y 测量前提）

**发现经过**：本卡首次真实栈跑 `theme-switch.spec.ts` 竟**恒红**（WEB-E2E-FULL 时通过）。
深挖定位到 THEME-BUILD-01 起主题改为运行时外挂后的 3 处断裂——它们的共同后果是
**主题从未真正激活**（`data-theme` 恒 null），于是不仅 `theme-switch` 红，且**对比度只
能测到 fallback（defaults.css）假色**，a11y 结论不可信。三处逐一修复：

### 3.1 E2E 启动器未组装主题产物（harness 缺口）

THEME-BUILD-01 把主题改为运行时外挂：host registry 从 `/themes/<id>/*` 拉取，后端静态面
映射 `${FMBY_DATA_DIR}/themes/<id>/dist/<rest>`（`crates/fmby-v2-server/src/themes.rs`）。
但 `host/e2e/start.mjs` 从未组装 `data/themes/`，也（产物模式下）未代理 `/themes` →
assets 落到 SPA HTML 回退 → 主题激活失败。

**修复**：`start.mjs` 新增步骤 ①b——把 `themes/<dir>/dist/**` 复制到
`${workDir}/data/themes/<id>/dist/**`；**id 以产物 manifest 的 `id` 为准**
（目录名 `_template` ≠ 运行时 id `template`）。`vite.config.ts` 的 `preview.proxy`
补 `/themes` → 后端。

### 3.2 主题 IIFE 缺宿主全局桥（产品回归）

FE-OPT-01 把主题产物从 ESM 改为 **IIFE + output.globals**（`})(React)`），其设计文档
（`docs/FE-OPT-01.md` §关键设计说明）明确要求"**宿主以 `window.React/ReactDOM/FmbyShared`
提供依赖**"——**但该桥从未实现**（全仓 grep 零命中）。后果：主题入口抛
`React is not defined`，`data-theme` 恒不设置。

**修复**：新增 `host/src/theme/themeGlobals.ts`（幂等挂载宿主**同一份**
React/ReactDOM/ReactJSXRuntime 到 window；不引第二份 react），在
`registry.ts::loadIifeThemeEntry` 注入脚本前调用。附 `host/tests/theme-globals.test.ts`
（回归守卫：挂载 + 幂等 + 不覆盖已存在全局）。

> 连带修复：IIFE 的 `var FmbyTheme` 在 window 上是**不可配置**属性，
> 原 `delete win.FmbyTheme` 抛 `Cannot delete property` → 改为赋值 `undefined`。

### 3.3 `_template` 构建脚本丢失静态资源拷贝（产品回归）

THEME-BUILD-01（`39e001e`）给 `_template` 的 `build` 脚本加了 manifest/tokens 拷贝，
但后续 `b970f6f`（版本四层化）**将其回退为裸 `vite build`** → `themes/_template/dist/`
只有 `index.js`，无 `theme.manifest.json`/`tokens.css` → `/themes/template/*` 404 →
热切换到 template 失败。

**修复**：`themes/_template/package.json` 的 `build` 恢复为与 darkroom 同款
（vite build + 拷贝 manifest/tokens/aurora/skins 进 dist）。

**验证**：修复后 `theme-switch.spec.ts` 2/2 通过；`data-theme` 正确切到 `darkroom`/`template`。

## 四、键盘导航与语义（断言固化于 `a11y.spec.ts`）

| 项 | 断言 |
| --- | --- |
| 登录 Tab 顺序 | 用户名 → 密码 → 显示密码 → 登录，无焦点陷阱 |
| 焦点可见 | 连按 Tab 8 次，每个焦点元素有 outline 或 box-shadow |
| 全局搜索 | Ctrl+K 打开 → 输入框自动聚焦 → 弹层内 axe 0 违规 → Esc 关闭 |
| 用户菜单 | `aria-haspopup="menu"` + `aria-expanded` true/false + Esc 关闭并复位 |
| landmark | `banner` / `main` / `navigation[name=主导航]` 在场 |
| 管理面导航 | `navigation[name=管理中心导航]` 具名 |
| 表单可访问名 | 登录两输入 + 显示密码 + 登录按钮均有名 |
| 筛选器可访问名 | 媒体库列表/详情 select 具名（select-name 回归） |

## 五、门禁记录

| 闸 | 结果 |
| --- | --- |
| `pnpm versions` | PASS |
| `pnpm typecheck`（shared/host/themes） | PASS |
| `pnpm build` / `pnpm build:themes` | PASS |
| `pnpm test`（host 14 + shared 49 + darkroom 14） | PASS |
| `pnpm size`（179KB<300KB + [3b] 反查 + [3c] IIFE） | PASS |
| `pnpm dupes` / `contracts` / `theme-budget` / `theme-parity` | PASS |
| Playwright 全量（真实栈，非 skip） | **77 passed / 0 failed** |

## 六、未覆盖 / 登记

1. **屏幕阅读器实读**：自动化只做 axe + 语义断言，未做 NVDA/VoiceOver 实读流程
   （CI 无音频设备）。已由"landmark + 可访问名 + 装饰隐藏"三项语义断言近似覆盖，
   完整 SR 流程建议后续卡（需人工/录制）。
2. **axe 覆盖边界**：axe 自动可测约 57% WCAG 条款；键盘可达性、焦点顺序、语义正确性
   由本卡手工断言补足，但**不构成合规认证**。
3. **主题全局桥范围**：`themeGlobals.ts` 只绑 React 三件套。当前主题对 `@fmby/v2-shared`
   仅**类型引用**（`import type`，构建期擦除），无运行时消费，故 `FmbyShared` 未绑
   （预绑会把 shared 根 barrel 拉进首屏）。第三方主题若需运行时消费 shared，应扩展该桥
   ——已注释登记。
4. **对比度层级差收窄**：`--text-4` 从 0.26→0.56 后，text-3/text-4 视觉层级差变小
   （设计取舍：可达性优先于极弱层级）。
5. **`_template` 无 test 脚本**：`pnpm -r test` 报 "2 of 5"（`_template` 无测试），
   非本卡引入，登记。

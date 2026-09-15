# BUG-SKIN-NAV-01 —— darkroom 主题卡片不可导航 Handoff

## 八行报告
- 任务：BUG-SKIN-NAV-01 darkroom 主题卡片不可导航（major，E2E 真跑发现）。Owner：zcode-writer1（w1）。
- 仓库/分支：前端仓 `fmby-web`，worktree `fmby-web-skin-nav`，分支 `w/bug-skin-nav`（基线 main `61ec4fd`）。因共享 checkout 被另一写手切到 `w/fe-opt-02`，本卡独立开 worktree 隔离交付。
- ①契约：`shared/src/theme/index.ts` 新增 `SkinActions` 类型（`SkinProps.actions` 由裸 `Record<string,...>` 改为 `SkinActions`），MINOR 兼容新增语义键 `openItem?(id)`。**另加必配孪生键 `itemHref?(id)`**（见 §裁决 T1）。
- ②host 注入：`host/src/theme/skins/loaders.ts` 新增 `useSkinNavigationActions()`，经 `useNavigate` 注入 `openItem = navigate(\`/item/${id}\`)` + `itemHref = (id) => \`/item/${id}\``；browse.library 与 browse.item 两个装配器各 `...navigation` 汇入 actions。
- ③皮肤：`themes/darkroom/src/skins/LibrarySkin.ts` 卡墙卡片 + `ItemSkin.ts` 剧集带卡片接注入面——两键齐全渲染真实 `<a href>`（点击 preventDefault 走 SPA），仅 openItem 退 `<button>`，都无退静态展示；**主题零路由字面量**（href 也由 host 构造，纯度不破）。
- ④E2E：`host/e2e/browse.spec.ts` 移除 `test.fail(true,'PRODUCT-DEFECT-01')` 标注，用例改为断言 `a[href^="/item/"]` ≥ 1 + role=link 点击跳 `/item/101`。
- 门禁：**`pnpm verify` 11 闸全绿（exit 0）**；shared 49 pass / darkroom 19 pass（+5 新测试）。
- 状态：**功能链已 end-to-end 实证**（见 §实测证据），但**被 main 上一个前置 P0 阻断**（FE-OPT-01 主题 IIFE 契约缺失，非本卡范围），需主代理裁决合并顺序。单一 green commit 已落。

## 实测证据（A/B，真实栈）
真实栈：主仓 `fmby-v2-server`（w3 e2e 修复版，debug）+ `fmby-e2e-seed` + 前端 `host/dist` 产物 + 真实 SQLite 三库。
探针 `document.querySelectorAll` 实测：

| 主题 | `data-theme` | 卡墙 article | `a[href^="/item/"]` | card-open 锚点 | hrefs |
|---|---|---|---|---|---|
| **darkroom（修复前，main 基线）** | `null` | 0 | **0** | 0 | — |
| **darkroom（本卡修复后）** | `darkroom` | 6 | **6** | 6 | `/item/101,201,202,203,204,205` |

`browse.spec.ts` 4/4 passed（含原 `test.fail` 用例真通过）。
> 探针与临时启动器（`_abprobe.spec.ts` / `start-skin-nav.mjs` / `playwright.skin-nav.config.ts` / 临时 vite.config `/themes` 代理 / main.tsx globals / registry.ts delete→assign）**均已删除，未进 commit**——它们是 §阻断 的临时绕行，非交付物。

## ⚠️ 阻断：main 前置 P0 —— 主题激活在 main 上整体失效（非本卡引入，需裁决）
**症状**：main（`61ec4fd`）上任何主题皮肤都不激活——`document.documentElement.dataset.theme` 恒为 null，`console` 报 `React is not defined`。`theme-switch.spec.ts`（未改动、pristine）在 main 上 2/2 恒红。

**根因链**（已逐环实证）：
1. FE-OPT-01（`c9c84a7`，已合入 main）把主题产物从 **ESM 改为 IIFE + `output.globals`**：产物结尾为 `})(React)`，要求宿主提供 `window.React/ReactDOM/ReactJSXRuntime/FmbyShared`。
2. 该**宿主全局桥从未实现**——全仓（含所有分支）无任何 `window.React =` 赋值；`host/src/main.tsx` 从不暴露它们。
3. → 主题 IIFE 执行即抛 `React is not defined` → `loadIifeThemeEntry` reject → `ThemeProvider` 走 error 分支 → `data-theme` 不设置、`domainSkins` 永不挂载。

**次生缺陷**：`host/src/theme/registry.ts` 的 `delete win[THEME_GLOBAL_NAME]` 对 `var FmbyTheme`（不可配置属性）抛 `Cannot delete property 'FmbyTheme' of #<Window>`（严格模式）。

**本卡仅在其中一环**：即使皮肤代码正确，只要主题不激活，darkroom skin 就不会渲染——所以**缺陷并非仅「卡片断链」，还有「主题整体不激活」的更前置一层**。这正是 w3 在 `w/e2e-full`（**不含 FE-OPT-01**，用旧 ESM 形态）能测出 darkroom 卡墙 6 图，而 main 上现在连卡墙都没有的原因：`w/e2e-full` 的 `registry.ts` 走 `import('@fmby/v2-theme-darkroom')` ESM 动态导入（无需 globals），main 换成 IIFE 后桥缺失。

**已识别并行的修复**：`w/fe-opt-03`（写手 a11y 卡）已新增 `host/src/theme/themeGlobals.ts`（`exposeThemeGlobals()`）+ registry `delete→assign` + start.mjs 主题产物组装 + vite preview `/themes` 代理（四项正是本卡实测所需的完整绕行）。**建议主代理把该 infra 修复先合入 main，再合本卡**（否则本卡在 main 上无法独立验证皮肤链；本卡代码本身已证明与该修复协同后完全生效，见上表）。

## 裁决登记
| # | 事项 | 决定 | 依据 |
|---|---|---|---|
| T1 | 卡面只要求 `openItem(id)`（void 回调），但④验收要求 `a[href^="/item/"]` ≥1 + `role=link` | **加必配孪生键 `itemHref(id)`**（同样 MINOR 可选键） | void 回调无法产出 `href`；要真实锦点语义（可访问性/中键/右键）与「主题不碰路由」两个约束同时满足，href 必须由唯一持有路由的 host 注入。两键均可选，旧 skin 不传不崩 |
| T2 | `start.mjs` 未组装 `data/themes/` + vite preview 缺 `/themes` 代理 | **不在本卡修**（登记） | 属 E2E 启动器/构建基础设施，非本卡 Owned；`w/fe-opt-03` 已实现，避免重复改同一文件冲突 |

## 4+1 自审
1. **需求覆盖**：①契约键 ✓（+孪生键 T1）②host 注入 ✓ ③两皮肤卡片接回调 ✓（LibrarySkin 卡墙 + ItemSkin 剧集带，均两键守卫）④移除 test.fail ✓ ⑤回归：darkroom itemLinks 6 ≥1 ✓ / template 不受影响 ✓（host 回落路径本就是 7 链接，未动）/ verify 全绿 ✓。
2. **错误覆盖**：`openItem`/`itemHref` 均可选——旧 host（不注入）下皮肤退静态展示或 `<button>`，不抛错、不伪造链接；新测试覆盖三种注入形态（两键齐/仅回调/都无）。
3. **安全覆盖**：href 由 host 单源构造；`onClick` preventDefault 后走 SPA navigate，保留 href 供原生语义；主题侧无路由字面量、无取数（dupes 纯度闸 0 violations）。
4. **边界覆盖**：改动仅 10 文件（shared 2 / host 2 / darkroom 4 / 测试 2）；禁碰面（路由表、viewmodel、api client）零改；新增测试 5 例（LibrarySkin 3 + ItemSkin 2）。
5. **反事实检查**：若皮肤未接 `itemHref`，则无 `<a href>` → 新增测试断言 `<a[^>]*card-open` 会失败；若未接 `openItem`，点击无导航 → `waitForURL(/item/101)` 超时；若契约改动破坏了旧键，shared 49 测试中 `SkinProps` 用例会连带失败。

## 门禁原文
- `pnpm verify`（= versions && typecheck && build && build:themes && test && size && dupes && contracts && theme-budget && theme-parity）：**exit 0，11 闸全绿**。
- `pnpm -r typecheck`：shared / host / darkroom / _template 全 Done。
- `pnpm -r test`：shared **49 pass / 0 fail**；themes/darkroom **19 pass / 0 fail**（原 14 + 新增 5）。
- 关键闸：dupes **0 violations**（主题纯度保持）/ contracts **0 violations** / size PASS / theme-budget PASS / theme-parity PASS（darkroom 两域四项能力面齐备）。
- E2E（非 verify 内、本卡真跑）：`browse.spec.ts` 4/4 passed；darkroom A/B 实测见上表。

## 修改文件（10）
- `shared/src/theme/index.ts`（`SkinActions` + `openItem`/`itemHref`）
- `shared/src/contracts/theme/index.ts`（barrel 导出 `SkinActions`）
- `host/src/theme/skins/loaders.ts`（`useSkinNavigationActions` 注入 + 两装配器汇入）
- `host/e2e/browse.spec.ts`（移除 test.fail + 真断言）
- `themes/darkroom/src/skins/LibrarySkin.ts`（卡墙卡片导航）
- `themes/darkroom/src/skins/ItemSkin.ts`（剧集带卡片导航）
- `themes/darkroom/skins/library.css`、`skins/item.css`（导航面样式 + focus-visible）
- `themes/darkroom/tests/LibrarySkin.test.ts`、`tests/ItemSkin.test.ts`（+5 导航测试）
- `docs/BUG-SKIN-NAV-01.md`（本文件）

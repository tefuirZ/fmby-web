# 交接 · FE-A11Y-KEYBOARD-AUDIT（前端可访问性/键盘导航审计）

仓库 `/home/tefuir/rustproject/fmby-web`，分支 `w/fe2b/fe-a11y-keyboard-audit`（基于 `origin/main`）。
本卡用 **ponytail**（只补属性、不引依赖、不改视觉与交互语义）；找符号只用 **codegraph**。

---

## 1. 先取证：审计矩阵（面 × 项 × 结论）

| 面 | 承载 | Tab/Esc | 焦点归还 | role/label | 结论 |
|---|---|---|---|---|---|
| 抽屉类（MountDrawer / UserDrawer / LibraryDrawer / TaskCenter… 共 40+ 文件） | **共享 `shared/src/ui/common/SideDrawer.tsx`，基于 `@radix-ui/react-dialog`** | ✅ Radix 原生 | ✅ Radix 原生（回到触发元素） | ✅ `Dialog.Title` + 关闭按钮 `aria-label` | **合规（取证，非缺陷）** ⇒ 不逐个改 40+ 文件 |
| 检索浮层 `SearchOverlay` | 自绘 | ✅ Esc | ⚠️ 见「待裁」 | ✅ `role="dialog"` + `aria-label` | 基本合规 |
| 播放侧栏 `PlaybackSidebar` | 自绘 | ⚠️ 无 Esc | — | ✅ role/aria-modal/aria-label | **登记待裁**（见 §5） |
| **合集列表检索框** `CollectionsListPage.tsx:81` | 裸 `<input>` | — | — | ❌ **只有 placeholder，无可访问名** | **已修**（补 `aria-label`） |
| **共享状态面 `FeedbackState`**（error/empty/loading/success/warning，全仓复用） | 共享 | — | — | ❌ **无 role / 无 aria-live** | **已修**（error→`role="alert"`+assertive；余→`role="status"`+polite） |
| `CollectionMemberAdder:73`、`CollectionFormDialog:70` | 裸 `<input>` | — | — | ✅ 由 `<label>` 包裹 | **合规（取证留存）** ⇒ 不重复补 aria-label |
| `CollectionRulesPanel:198` | 裸 `<input>` | — | — | ✅ `<label>` 包裹（`</label>` 在 202） | 合规 |

## 2. 修复清单（2 处，**纯属性、不改视觉/交互语义**）

1. `host/src/pages/browse/CollectionsListPage.tsx` — 检索框补 `aria-label="按合集名检索"`
   （placeholder **不足以**作为可访问名）。
2. `shared/src/ui/common/FeedbackState.tsx` — 新增 `a11yFor(variant)`：
   - `error` ⇒ `role="alert"` + `aria-live="assertive"`（错误须立即播报）；
   - 其余态 ⇒ `role="status"` + `aria-live="polite"`（不打断用户）。
   该组件是全仓统一状态面 ⇒ 一处修复覆盖所有错误/空/加载态。

## 3. RED → GREEN

- **测试形态（诚实说明）**：本仓 **无 jsdom / testing-library**（三个 `package.json` 均无相关依赖），
  引入它们属**新依赖**、违反 ponytail ⇒ **不引**。故写的是**源码契约静态断言**
  （`host/tests/a11y-static-contract.test.ts`，4 例），断言 aria-label / role / aria-live 已补齐，
  而非真实 DOM/读屏行为测试。真正的行为验证仍需浏览器/屏幕阅读器（见 §5）。
- **RED**：初跑 3 红——2 处真实缺口（缺 aria-label、FeedbackState 缺 role/aria-live）+ 1 处**我自己的路径写错**
  （`ROOT` 层级算错，ENOENT）。按 TDD 纪律**改测试不改代码**，修正为仓根。
- 中途另一次自我纠错：`CollectionMemberAdder` 我误判为「缺 label」，核查发现它**已被 `<label>` 包裹**
  ⇒ 从「缺陷」移到「取证留存」组，不重复补属性。
- **GREEN**：4/4 通过，exit 0。

## 4. 当次验证

```
shared: npx tsc -p . --noEmit                 → exit 0（0 错）
host:   npx tsc -p tsconfig.app.json --noEmit  → 3 错（**全部 main 基线，非本卡引入**，见 §5）
host:   node --import ./tests/register-aliases.mjs --test tests/a11y-static-contract.test.ts
                                              → tests 4 / pass 4 / fail 0
host:   node --import ./tests/register-aliases.mjs --test tests/*.test.ts
                                              → tests 386 / pass 386 / fail 0
node scripts/check-frontend-size.mjs           → PASS
node scripts/check-frontend-component-size.mjs → PASS
node scripts/check-contract-mappers.mjs        → PASS
```

## 5. 跳过项 / 待裁（明写，不擅改）

- **未做真实 DOM/读屏验证**：无 jsdom/testing-library 且不引新依赖；Tab 顺序、焦点陷阱与
  焦点归还、读屏播报需在浏览器 + 屏幕阅读器（NVDA/VoiceOver）上人工或 CI 复跑。
  既有资产 `docs/evidence/fe-opt-03/aria-snapshot/**` 可作口径参考，本卡未重跑生成。
- **`PlaybackSidebar` 无 Esc 关闭**：修它会**改变交互语义**（侧栏是否该被 Esc 关闭属产品决策），
  按卡面「拿不准的登记不擅改」⇒ **登记待裁**。
- **`SearchOverlay` 焦点归还**：关闭后焦点是否回到触发元素未静态可证（需 DOM 测试）⇒ 登记待裁。
- **host tsc 3 处错均非本卡引入**（`git status` 可证我只动了上述 2 文件）：
  1. `CollectionsListPage.tsx(109,25) TS7006` — `collection` 隐式 any（**既有**）；
  2. `Pan115DirectoryBrowserSection.tsx(10,27) TS6133` — 未用 import（他人）；
  3. `mountFormState.ts(101,5) TS2353` — `note`，**即我 `w/w5/fe-tsc-baseline-fix` 已修那处**，待你合并即消。
  ⇒ 本卡不越界修；建议 CI 复跑确认 host 全绿。
- 未改视觉、未改交互语义、未改契约仓/mirror、未引依赖、不碰农场、未跑全仓重活。

## 6. 提交

一原子项一提交：2 处属性修复 + 静态契约测试（4 例）+ 本 handoff。

`Reviewed-by: pending-non-author-review`

# FE-OPT-03 无障碍（a11y）系统化（第二轮 · `w/zcode/writer1-fe-opt-03`）

> 基线：fmby-web `main` @ `ce69be5`（含 FE-OPT-02 成果）。
> 工具：`host/e2e/a11y.spec.ts`（axe，仓内既有依赖）+ `host/e2e/a11y-report.spec.ts`（本轮新增，playwright 内建）。

## ⚠️ 开工前机械核实（卡面真实性）

**FE-OPT-03 已由 w3 交付并合入 main**（`0225df8` / `db54841`：全站 WCAG AA + 键盘导航
+ 对比度 + aria，verify 11 闸全绿）。故本轮**不重做**已落地项，只做：回归核查 +
真缺口修复 + 审计可信度补强（与 FE-OPT-02 第二轮同姿势）。

### codegraph 查证记录（卡要求）

| 查询 | 结果 |
| --- | --- |
| `codegraph query "accessibility\|aria\|keyboard\|focus" -p host/src` | **No results** |
| `codegraph query "aria-label"` | 命中 `shared/src/ui/primitives/Tabs.tsx:22` |
| `codegraph query "userButton" -p host/src` | **No results** |
| `codegraph callers "ManageOverviewPage"` | `host/src/pages/manage/index.ts:1` |

**结论（诚实边界）**：codegraph 索引对 `host/src` 覆盖较弱（按符号名查命中率低），
本轮多处仍靠读文件定位。索引问题不在本卡范围，未修。

## 一、开工前已存在（不重做）

| 项 | 位置 | 核实 |
| --- | --- | --- |
| 全页面 axe 扫描（wcag2a/2aa/21a/21aa，含 color-contrast） | `a11y.spec.ts`（29 页） | 桌面 37/37 ✓ |
| 键盘导航：Tab 顺序 / 焦点可见 / Ctrl+K / Esc 关弹层 | 同上 | ✓ |
| 语义标签：landmark / 控件可访问名 / aria-haspopup | 同上 | ✓ |
| 登录表单键盘不陷入陷阱 | `a11y-keyboard.spec.ts` | ✓ |
| `@axe-core/playwright` 依赖 | `host/package.json:41`（已锁 pnpm-lock） | **仓内既有**，非本轮新增 |

> 卡面「不要加 axe-core」= 不新引依赖。它已在仓内且已锁定，故沿用合规；
> 本轮**新增的报告 spec 完全不依赖 axe**（用 playwright 内建 `ariaSnapshot`）。

## 二、本轮新增/修复

| # | 缺口 | 证据 | 修复 |
| --- | --- | --- | --- |
| A-1 | 移动档 `userButton` **无可访问名**（axe `button-name`，**critical**，跨 27 页） | 手机档 `.userName{display:none}`（TopBar.module.css:211）后按钮内只剩装饰头像 | 补 `aria-label="账号菜单：{用户名}"`（含可见文本 → 满足 WCAG 2.5.3 label-in-name）+ avatar/chevron `aria-hidden` |
| A-2 | 表格横滚区**键盘不可达**（axe `scrollable-region-focusable`，serious：probe-tasks、secrets 的 `tableWrap`） | axe target `._tableWrap_19dyh_985` / `._tableWrap_16am8_767` | 加 `tabIndex={0}` + `role="region"` + `aria-label` |
| A-3 | 管理面 landmark 断言在移动档恒红（侧栏收在 Radix 抽屉内，未挂载） | `getByRole('navigation',{name:'管理中心导航'})` element not found | 按 profile 分流：移动档改验「抽屉触发器可达 → 展开后 landmark 具名」（**不 skip 了事**，比 skip 覆盖更多） |
| A-4 | **e2e 跑在陈旧 dist 上**：`start.mjs` 仅 dist 缺失才 build → 源码改动后不重建，验证的是旧产物 | 我两轮实测：CSS 与 aria-label 改动"不生效"，实为未重建 | `playwright.config.ts` 的 webServer.command 前置 `pnpm build`（代价 +7s） |
| A-5 | 无逐页 a11y 报告（验收要求） | — | 新增 `a11y-report.spec.ts`（见下） |

### A-5 新增报告 spec（无 axe）

- 15 页 × 2 profile：`locator('body').ariaSnapshot()` 产出 ARIA 树（YAML），
  + 汇总表（可聚焦元素数 / 无名控件 / landmark 清单 / 图片缺 alt / aria 节点）。
- 产出 `docs/evidence/fe-opt-03/{report-chromium.md, report-mobile-chrome.md, aria-snapshot/**}`（212K，**纯文本**，不占 repo-size 预算）。
- 断言**不放宽**（FE-OPT-02 N-3 教训）：无名控件 = 0、缺 alt 图片 = 0、每页可聚焦元素 > 0。
- playwright 1.62：`page.accessibility` 已移除 → 改用 `locator.ariaSnapshot()`。

### 本轮踩坑并修掉的自研算法假红

第一版自研 `accessibleName()` 只认 `label[for]` + aria-label/title → **误报 9 页无名控件**
（这些控件实际靠**包裹式 `<label>`** 或 `placeholder` 得名，axe 判 0 违规）。
冲突时以更完备的 axe 为准，**修算法**（补祖先 `<label>` + placeholder）而非放宽阈值。
修后两 profile 均 0 违规。

## 三、真跑证据

- `a11y.spec.ts` + `a11y-keyboard.spec.ts`（chromium + mobile-chrome）：**76 passed / 0 failed**。
- ① 修复前移动档：29 failed（其中 27 项 critical `button-name`）→ 修复后 **37 passed / 0 failed**。
- `a11y-report.spec.ts`：chromium ✓ / mobile-chrome ✓（各 ~45s）。
- A-4 自证：删除 `host/dist` 后 e2e **自行重建并通过**（15.1s），证明不再跑陈旧产物。

## 四、诚实边界 / 未做项（跳过了什么 · 何时再加）

- **列表方向键导航**（卡面范围 1）**未做**：仓内列表多为虚拟化网格 + 服务端分页，
  方向键漫游需先定义交互模型（roving tabindex vs grid role）。**建议作为独立卡**
  （FE-OPT-04）并先定角色语义，本轮不擅自引入半套实现。
- **屏幕阅读器真机验证**（范围 4）**未做**：无 NVDA/VoiceOver 环境。本轮以
  **ARIA 快照 + 可访问名断言**作代理证据——能证明"结构可朗读"，**不能**证明
  真机播报体验。**何时加**：有读屏器环境或引入 CI 读屏器时补。
- **对比度**（范围 3）：沿用 axe 的 `color-contrast` 规则（已在 wcag2aa tag 内，
  全站 0 违规）。**未**另做 token 级静态核算——axe 已覆盖实际渲染结果，重复做无增益。
- **逐页人工评审 ARIA 快照**：只在报告里落盘 + 断言关键统计，**未逐页人眼读树**。
- codegraph 对 host/src 索引覆盖弱，本轮未修（超出本卡范围）。

## 五、改动文件

- `host/src/app/layouts/TopBar.tsx`（A-1）
- `host/src/pages/manage/probe-tasks/components/ProbeTaskTable.tsx`（A-2）
- `host/src/pages/manage/ManageSecretsPage.tsx`（A-2）
- `host/e2e/a11y.spec.ts`（A-3）
- `host/playwright.config.ts`（A-4）
- `host/e2e/a11y-report.spec.ts`（A-5，新）
- `docs/evidence/fe-opt-03/**`（产出）

## 六、门禁

`pnpm verify` **exit 0**：typecheck ✓ / build ✓ / themes build ✓ /
test（host 46 + shared 94 + themes 28，0 fail）✓ / size ✓ / dupes ✓ / contracts ✓ /
theme-budget ✓ / component-size ✓ / theme-parity ✓ / repo-size ✓。

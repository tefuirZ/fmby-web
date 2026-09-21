# FE-OPT-02 移动端适配打磨（第二轮 · `w/zcode/writer1-fe-opt-02`）

> 基线：fmby-web `main` @ `a279e72`。本轮为**回归核查 + 真缺口修复**，非从零重做。
> 审计工具：`host/e2e/mobile-audit.spec.ts`（真实 `fmby-v2-server` + 真实 SQLite）。

## ⚠️ 开工前机械核实结论（卡面真实性）

卡面登记于 2026-09-16，但**FE-OPT-02 已由 w2 交付并合入 main**（commit `f329c8b`，
文档 `docs/FE-OPT-02.md`：三断点 × 25 页真跑 6/6、76 张截图归档、触控 44px、
管理面表格横滚、播放页进度条可拖）。故本轮**不重做已落地项**，只做：
① 在当前 main 上回归核查；② 修真缺口；③ 补强审计本身的可信度。

## 一、开工前已存在（不重做）

| 项 | 位置 | 核实方式 |
| --- | --- | --- |
| 断点档位体系（phone<768 / tablet<1024 / desktop≥1024） | `host/src/styles/responsive.css` | 读文件 |
| `--touch-min: 44px` token | `host/src/styles/defaults.css:180` | 读文件 |
| 触屏 44px 规则（Button / Switch / mobileClose / TopBar padding） | `shared/.../Button.module.css:41`、`Switch.module.css:21`、`ManageLayout.module.css:290`、`TopBar.module.css:35` | 读文件（均标 FE-OPT-02） |
| 滑动画廊（scroll-snap + 横滚） | `browse/styles/cinema-hero.module.css:208`、`shared.module.css` | 读文件 |
| 滚动惯性 `-webkit-overflow-scrolling: touch` | `base.css:36`、`hero.module.css:215`、`TopBar.module.css:47` | 读文件 |
| 管理面移动抽屉（Radix Dialog + mobileTrigger） | `ManageLayout.tsx:303` | 读文件 |
| 播放页移动端（进度条可拖 / 控件可达） | `mobile-audit.spec.ts` 第 6 项 | 真跑 ✓ |
| 三断点逐页截图 + 溢出审计（25 页 ×3） | 同上 1–3 项 | 真跑 ✓ |

## 二、本轮新增/修复（真缺口）

| # | 缺口 | 证据（实测） | 修复 |
| --- | --- | --- | --- |
| N-1 | 手机档 `manage-naming-scrape` **+92px 横向溢出** | 审计报 `DIV._metaRow`；实测 `metaRow` 容器 309px、内容 `scrollWidth=434px`（`metaText` 为无空格长哈希 `naming-cleanup-v6:95930e7e…`，宽 434 → 右边界 467） | `metaText` 加 `min-width:0` + `overflow-wrap:anywhere`；`metaRow` 等 flex 行加 `min-width:0`（`ManageShared.module.css`） |
| N-2 | 「终止会话」按钮 **19×19**，且是**破坏性操作**、只有 `title` 无 `aria-label` | 定位 `LivePlaybackStreams.tsx:148`，DOM 实测 19×19 | 触屏下按钮盒撑到 `44×44`（图标仍 15px、背景透明 → 视觉零变化）；补 `aria-label`（`ManageOverviewCockpit.module.css` + `LivePlaybackStreams.tsx`） |
| N-3 | 审计**触屏断言被宽松阈值放过**：`expect(≤20)` 使 19×19 违规仍判通过 | 实测 `manage-button[4]/[5] 19x19` 被记入却 PASS | 收紧为 `toHaveLength(0)` |
| N-4 | 审计**从未模拟触屏**：`Desktop Chrome` 的 `pointer:fine` → `(hover:none) and (pointer:coarse)` **永不匹配** | 实测 desktop `coarse=false` / Pixel 5 `coarse=true` | 新增 `mobile-chrome` project（Pixel 5，含 hasTouch/isMobile）；触屏断言加 project 守卫（桌面下 skip 并说明，不假装通过） |
| N-5 | 命中区探测法缺陷：`elementFromPoint` 只测视口内 → 视口外元素全 null | 实测探针全 null | 探测前 `scrollIntoView({block:'center'})` |

### N-4 的含义（重要，供主代理知悉）

仓内所有触屏 44px 规则都收在 `(hover:none) and (pointer:coarse)` 内。此前 e2e 只跑
`Desktop Chrome`，该 media **从不匹配** ⇒ w2 报告的「触控目标 0 违规」是在
**触屏样式未生效**前提下得出，结论偏弱（不等于错，但未被真验证）。本轮新增
`mobile-chrome` project 后，触屏规则才真正参与渲染并被断言。

## 三、真跑证据

- 全量（两 project）：**11 passed / 1 skipped / 0 failed**（`EXIT=0`）
  - skip 项 = 桌面 profile 下的触屏断言（按设计，附原因，非失败）
- 移动 profile 单独跑触屏项：`[audit] touch targets below 44px (non-exempt): none` ✓
- 手机档溢出：修复前 `+92px` → 修复后 `[audit] phone horizontal overflow pages: none` ✓
- 截图：76 张生成于 `docs/evidence/fe-opt-02/full/`（gitignored）；
  入库抽样 10 张（含本轮两个修复页），`samples/` 2.6M，`repo-size` 闸 PASS。

## 四、诚实边界 / 未做项

- **播放页全屏与手势**：依赖浏览器原生 video 控件 + artplayer 触摸层，本轮**未改**，
  也**未新增手势断言**（仅沿用既有「进度条可拖 / 控件可达」）。
- **逐页人工视觉对比**：按 REPO-HYGIENE-01，全量 76 张不入库；本轮只保证
  **程序化断言**（溢出/点按目标/表格横滚/进度条可拖）全绿，未逐张人眼评审。
- **`::before` 扩命中区方案已弃用**：先按 Switch 惯例用伪元素扩展，但命中区实测
  仍 ≈18px（邻居元素干扰 + 伪元素命中难以稳定探测），改为直接撑按钮盒（可测量）。
- **桌面 profile 下触屏 44px 规则不生效**是设计（media 限定），非缺陷。
- 未引入任何新依赖（playwright 为仓内既有）。

## 五、改动文件

- `host/src/pages/manage/longtail-shared/ManageShared.module.css`（N-1）
- `host/src/pages/manage/overview/ManageOverviewCockpit.module.css`（N-2）
- `host/src/pages/manage/overview/components/LivePlaybackStreams.tsx`（N-2）
- `host/e2e/mobile-audit.spec.ts`（N-3 / N-5）
- `host/playwright.config.ts`（N-4，新增 project，未改原 chromium）
- `docs/evidence/fe-opt-02/{README.md,samples/phone-375/…}`

## 六、门禁

`pnpm verify` **exit 0**：typecheck ✓ / build ✓ / themes build ✓ /
test（host 23 + shared 94 + themes 28，0 fail）✓ / size ✓ / dupes ✓ /
contracts ✓ / theme-budget ✓ / component-size ✓ / theme-parity ✓。

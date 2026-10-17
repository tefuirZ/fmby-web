# FE-UI-DENSITY-P1-BATCH · UI 密度 P1 批量收口 交卡报告

> 卡面：按 `docs/evidence/FE-UI-DENSITY-AUDIT.md` §4 的 11 条 P1 批量收口（审计报告本体在 `lovely-skunk` 分支 @ `47907b8`，尚未进 main；本卡全部改法以其原文为依据）。
> 分支：**`w/ui-p1-density-batch`**（基线 `ddc1a4c` = 审计报告的实测基线；落后 origin/main 9 个提交，未 rebase——合并归属主代理裁决）。
> 纪律：一件一 commit（13 个提交 = P1-1..P1-11 + 卡① + 1 个行号白名单同步）；**shared/src 零变化**（`git diff origin/main...HEAD -- shared/src` 为空）；未跑 pnpm build；找符号用 codegraph，字面量统计用 python3。

## 1. 提交清单（branch + sha）

| sha | 内容 | 对应卡面项 |
|---|---|---|
| `9509615` | P1-1 条目详情双重 gutter（内层 `.page` → `.pageSections`）+ 3 条断言 | ③ 双 gutter（前席会话产物，本席复核合格） |
| `50ce480` | P1-8 用户表 10→6 列（权限三源合并 + 次列折叠进抽屉）+ 6 条断言 | ② |
| `3d14654` | 卡① 页头收敛：两份 ManagePageHeader 删 eyebrow + description 转可选 + 6 处 changelog/票号文案改写 + 9 条断言 | ① |
| `8a4a017` | P1-2 任务中心类别筛选二选一 + 「全部」chip + 4 条断言 | P1-2 |
| `1a0b308` | P1-3 媒体资源页 total 唯一化 + 瞬态指标板退场 + 3 条断言 | ③ 同值重复 |
| `8fb7f26` | P1-4 历史页同值计数收敛 + 筛选生效指示 + 3 条断言 | ③ 同值重复 |
| `8ce6625` | P1-5 库详情加载计数三处收敛 + 3 条断言 | ③ 同值重复 |
| `2d82a46` | P1-6 播放页外部入口收敛 + 5 条断言 | P1-6 |
| `ca325c8` | P1-7 资源详情 8 节锚点导航 + 低频三节折叠（native details）+ 5 条断言 | P1-7 |
| `55ab047` | P1-9 管理首页 13 块收敛 + 4 条断言 | P1-9 |
| `f14e4ef` | P1-10 设置中心 sticky 魔数 token 化 + 2 条断言 | P1-10 |
| `4fe46f9` | P1-11 管理侧栏去卡片套卡片 + 树压平两层 + 4 条断言 | P1-11 |
| `6e40bb0` | test(a11y) 行号白名单同步（P1-7 插行位移，非产品回归） | 收尾 |

HEAD = `6e40bb0`；全分支 `50 files changed, +1182/−388`；工作区干净。

## 2. 逐条改前/改后对照（DOM 断言为证，RED→GREEN 全部真跑）

| # | 改前（审计原文定位） | 改后 | 断言（host/tests/） |
|---|---|---|---|
| P1-1 | ItemDetailPage 外层+内层两层 `.page`，gutter 叠加 2×grid-margin | 内层改 `.pageSections`（无 padding 同栅格） | ui-density-p1-1.test.ts 3 条 |
| 卡① | 46 个调用点每页 eyebrow「管理中心」+ changelog 口吻长描述（S3/S4：票号 #658/#42-N5 直出、commit-message 式文案） | 组件删 eyebrow（改 2 处覆盖全部调用点）；description 必填→可选条件渲染；6 处文案改写为人话 | ui-density-p1-header.test.ts 9 条 |
| P1-2 | 类别 select 与分类总览卡片组绑同一 state，一屏两控件 | 删 select 类别项；卡片组补「全部类别」chip；选中态统一 chip[aria-pressed] | ui-density-p1-2.test.ts 4 条 |
| P1-3 | total 同屏 3 处（页头/指标板/筛选条）+ 当前页瞬态指标 4 块 | 指标板整节删除；total 只留页头；localOverrideCount 单次计算 | ui-density-p1-3.test.ts 3 条 |
| P1-4 | 历史页页头与工具条同值计数各一次 | 工具条改「筛选生效中」（任一筛选 ≠ all 才显示） | ui-density-p1-4.test.ts 3 条 |
| P1-5 | 库详情「已加载 x/y」3 处 | hero 唯一；工具条只留「当前结果 N 个」；尾部提示布尔态不带数字 | ui-density-p1-5.test.ts 3 条 |
| P1-6 | 播放页外部打开/复制链 3 处并存（其中「新标签打开」与「外部打开」同 URL 同 target） | 删 InfoBar 裸直链（专门面在 ExternalPlayerBar 六深链）+ 删 overlay 重复锚点；复制链接保留两处（overlay 接管时 InfoBar 不可见，审计认可）；兼容徽标钉死单处 | ui-density-p1-6.test.ts 5 条 |
| P1-7 | 资源详情 8 节平铺长页 | 页头下 8 个 chip 锚点（含 scroll-margin 落点）；流水线/身份治理/危险操作三节 native `<details>` 默认折叠 | ui-density-p1-7.test.ts 5 条 |
| P1-8 | 用户表 10 列 | 6 列（勾选/账号/权限=角色+类型+来源授权/状态/登录+设备/操作）；创建时间等折叠进 UserDrawer（抽屉字段逐一核实，零信息损失）；colSpan 同步 | ui-density-p1-8.test.ts 6 条 |
| P1-9 | 中控一屏 13 块（含硬编码空数组+死链的空壳任务队列、沉底的 quickLinks 网格） | 空壳任务队列+任务模态拔除（级联死代码退场）；quickLinks 上移 KPI 下一行 chip；活动流并入风险雷达；脉搏 4 指标一行；假 38% gauge 与重复「最近刷新」删除 → 10 块 | ui-density-p1-9.test.ts 4 条 |
| P1-10 | `padding-bottom: 88px`/`120px` 裸魔数两处 | `--stickybar-clearance` 一处注册（桌面 88/移动 120），padding 引变量 | ui-density-p1-10.test.ts 2 条 |
| P1-11 | `.rail` 内套 `.navCard` 盒子再套 `.subGroup`，树最深 3 层 | navCard 去盒子（hairline 分区+标题 accent）；「邀请与用户/会话与日志」中间层退场，7 叶子上提；subGroup JSX+CSS 退场；30 叶子一条不少 | ui-density-p1-11.test.ts 4 条 |

## 3. 验证原文（当次真跑）

- **全量 UI 密度断言**：`node --import ./host/tests/register-aliases.mjs --test host/tests/ui-density-p1-*.test.ts host/tests/ui-density-p1-header.test.ts` ⇒ **51/51 pass，rc=0**（12 个测试文件）。
- **RED 反证**：每条提交前都以「改前跑断言全红」取证（P1-8 用 `git stash` 反证：实测 10 列，5/6 断言红）。
- **受波及既有测试真跑**：
  - `table-row-keynav.test.ts` ⇒ **65/65 pass，rc=0**（读 UserTable/ManageCasPage/ManageEventsPage，含 14 分钟大用例）；
  - `tablewrap-region-audit / css-import-reachability / css-var-defined / source-types-consolidate / episode-id-forgery / player-recreate` 共 22 条 ⇒ 21 pass + 1 红；
  - 1 红 = `a11y-static-contract` 行号白名单误报（P1-7 插行致 `<input>` 213→214，`inputBlockAt(213)` 抓到上一行 div）⇒ **`6e40bb0` 同步行号后 4/4 pass，rc=0**。可达名本体（刮削源/搜索关键词/外部编号/匹配原因 aria-label）从未缺失。
- **静态闸**：`check-frontend-component-size` / `check-frontend-dupes` / `check-frontend-size` 全 rc=0；`check-css-module-usage` rc=1 为**存量假红**（3 个 casHit* 类定义在 `@media` 内，本分支基线的旧版闸看不见；main `a28adb1` 已修闸脚本，本卡开工前即存在、非本卡引入）。
- **契约面**：`git diff origin/main...HEAD -- shared/src` 为空 ⇒ 不改后端契约 ✓。

## 4. codegraph 查证记录

- `codegraph query "ManagePageHeader" -p .` ⇒ 确认两份实现（`manage/components.tsx` / `longtail-shared/components.tsx`）与签名，收敛面据此定界；
- `codegraph query "collapsible" -p .` ⇒ 确认新 prop 已入索引且落在 `ManageSectionCard`；
- 引用面/消费方统计（TaskPipelineWidget、ActiveTaskQueueWidget、MediaItemMetricsBoard、`styles.eyebrow`、票号串分布）按纪律用 python3 字面量扫描（grep 垫片全局禁符号搜索；本席全程未用逃生阀 `FMBY_ALLOW_SYMBOL_GREP`）。

## 5. ponytail 段（最懒可行解自述）

- **收敛在共享点，不逐页改**：卡① 改 2 份组件覆盖 46 调用点；P1-9 的活动流以内联块并入既有 RiskRadarPanel（约 30 行），不造「合并面板」新组件。
- **删优于增**：MediaItemMetricsBoard、TaskPipelineWidget、subGroup 三层分组 JSX+CSS、假 gauge、重复计数全部删除；全分支净 +794 行里 12 个测试文件占 658，产品代码净增极少。
- **平台特性优先**：P1-7 折叠用 native `<details>`（站内 StreamDisclosureGroup 同范式），锚点用原生 hash 跳转；未引任何新依赖、无 jsdom/RTL（断言用文本判定，理由写在每个测试头注）。
- **复用既有词汇**：chip[aria-pressed]、stackText、metaText、ManagePages/ManageShared 既有类；全卡零新增 CSS 类（仅 `.anchorTarget` 与 `--stickybar-clearance` 两个必要锚点/token）。
- **跳过了什么 / 何时再加**：① NamingRulesHeader 粗口文案未动（属 P0-2，lovely-skunk `21060d8` 已修，避免同句合并冲突）；② ActiveTaskQueueWidget/TaskDetailModal 组件文件保留为未接线导出（lovely-skunk `99a171a` 在编辑 widget 本体，删文件制造冲突；两分支合并后可一并删除）；③ P1-3 未做后端全局口径指标（那是数据面新卡）；④ 行号白名单未改成内容定位（另一张重构卡更合适）。

## 6. 遗留与移交主代理

1. **分支基线落后 origin/main 9 提交**（含 a28adb1 闸修复、CAS 三态化等）——合并时如遇 ui-density 断言与新 main 冲突，断言判据均为结构不变量，重跑即知真伪。
2. `check-css-module-usage` 在本分支基线上为存量假红，主代理合并 a28adb1 后自消。
3. 审计报告 `FE-UI-DENSITY-AUDIT.md` 本体仍在 `lovely-skunk`，建议随该分支进 main 后，本卡 12 个测试的头注引用即可直达。
4. P0-1（中控空态诚实化）已由 `55ab047` 从消费侧消解于本分支；widget 本体修复以 lovely-skunk 为准。

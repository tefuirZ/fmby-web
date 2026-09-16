# FE-COMPONENT-SPLIT 交接（w1 · 前端仓 w/zcode/writer1-fe-split）

> 补上 CONSTRAINTS MD-3「组件 >400 行」的前端门禁（此前**无门禁执行**，与后端
> 「函数 >120 行无门禁」同型空档 / 第三方审计 C-2），并示范拆 2 个高频页。

- 基线：`origin/main` @ `8d9605a`
- 提交：`3bcc9d3`（单一 green commit）
- 门禁：`pnpm verify` **12 闸全绿**（34 PASS，新增 `component-size` 一闸）

---

## 1. 门禁设计（关键：必须能跑通存量）

**问题**：实测存量 **20 个 .tsx 超线**（其中 12 个 >500）。若直接卡绝对行数，
门禁一进来就红 → 必被绕过。故采用 **RB-2 棘轮（ratchet）**：
**红线只卡增量，存量按债务记账**。

脚本：`scripts/check-frontend-component-size.mjs`
- 扫描 `host/src` + `shared/src` 的 `.tsx`（排除 `.d.ts`）
- 分级显示：`>400` = WARN，`>500` = 超硬红线
- **判定 FAIL 仅三条**：
  1. 基线外**新增**超线文件（>400）→ 新代码必须干净
  2. 基线内文件行数**上升** → 存量只许降不许升
  3. （超硬红线且新增/上升，已含于 1/2）
- 基线内未上升 → **WARN 不阻塞**（已记账债务，降到 ≤400 后回收出基线）
- 已达标文件会提示「可从基线移除」

**基线（纯数据）**：`docs/plans/v2-dev/evidence/fe-component-size-baseline.json`
**更新**：`pnpm component-size --update-baseline` —— **只许减不许增**
（某文件本次行数 > 基线值 → 拒绝写入并 FAIL，防把变胖洗进基线）。

**已实测棘轮双向生效**：
- 给 `ManageLicensePage`（403）加 2 行 → `[Component Grew Past Baseline] 403 → 405` FAIL
- 新建 405 行文件 → `[New Over-Limit Component]` FAIL

**接进 verify**：`package.json` 新增 `component-size` script，插入 `theme-parity` 之前。

---

## 2. 存量基线表（拆分后 18 条，原 20）

| 行 | 文件 | 备注 |
|---:|---|---|
| 610 | `manage/ManageRegistrationCodesPage` | >500 债务 |
| 600 | `manage/ManageRuntimeLogsPage` | >500 债务 |
| 593 | `manage/users/components/UserDrawer` | >500 债务 |
| 591 | `manage/ManageCollectionsPage` | >500 债务 |
| 587 | `login/LoginPage` | >500 债务 |
| 579 | `manage/mounts/formUtils` | >500 债务 |
| 552 | `app/router/index.tsx` | >500 债务（路由表，性质特殊，见 §5） |
| 535 | `manage/registration-codes/components/RegistrationCodeForm` | >500 债务 |
| 533 | `manage/naming-rules/scrape-sections` | >500 债务 |
| 513 | `manage/ManageUsersPage` | >500 债务 |
| 496 | `manage/ManageOverviewPage` | |
| 484 | `manage/ManageMediaItemsPage` | |
| 463 | `manage/media-item-detail/components/MediaItemSubtitleSection` | |
| 448 | `manage/ManageNamingRulesPage` | |
| 448 | `manage/media-item-detail/components/MediaItemMetadataSection` | |
| 417 | `manage/ManageRewardsPage` | |
| 406 | `manage/mounts/components/MountDrawer/MountDrawer` | |
| 403 | `manage/ManageLicensePage` | |

**本卡已回收 2 条**：`PlayPage`（660 → **386**）、`ManageMediaReviewsPage`（558 → **385**）。

**注**：卡面原清单 13 条与本表有出入——实测是 20 条（扫描口径含
`app/router/index.tsx`、`mounts/formUtils.tsx`、`naming-rules/scrape-sections.tsx`
等），且 `ManageUpstreamsPage` 已不在清单（S4B 拆到 150）。**以基线 json 为准**。

---

## 3. 本卡拆分（2 个高频页）

### PlayPage 660 → 386
抽到 `host/src/pages/browse/play/`（该目录已有 `PlayPanels` / `playbackPresentation`）：
- `PlaybackStage.tsx`（109）播放器本体 + 不兼容兜底层
- `PlaybackSidebar.tsx`（135）剧集队列 / 相关推荐抽屉
- `PlaybackInfoBar.tsx`（73）格式徽标 + 外部操作
- `PlayPageHeader.tsx`（~60）返回 + 标题 + 右侧操作
- `PlayFeedbackPanels.tsx` 四类终态面板（缺 ID / 加载中 / 错误 / 无源）
- `CompatibilityNotice.tsx` 兼容性提示 + 详情补齐状态

### ManageMediaReviewsPage 558 → 385
抽到 `host/src/pages/manage/media-reviews/`：
- `components.tsx`（153）`ProviderSearchPanel` / `ReviewDetailPanel` / `ReviewMobileCard`
- `shared.ts`（47）阶段/状态/动作标签 + 时间格式化 + 快照解析

**均为纯结构搬迁，行为零变更**（typecheck + build + 14 个单测 + 12 闸全绿）。

---

## 4. 拆法模板（给后人示范）

1. 先找**接缝**：early-return 终态面板 → 纯展示区块（header/infobar/stage/sidebar）
   → 子组件（表格行/卡片/搜索面板）→ 共享常量与格式化。
2. 新建**同名目录**（`Xxx/`，已有则复用），页面留壳只做编排 + 状态。
3. 子组件的**类型不要另造**：本项目踩到两次——`SidebarItemSummary` 比真实
   `MediaCardSummary` 窄、`onError/onTimeUpdate` 签名比播放器窄。
   **直接 import 既有类型 / 对齐真实签名**（见下方「坑」）。
4. 拆完跑 `pnpm typecheck` → `pnpm test` → `pnpm component-size --update-baseline` 回收。

**坑（照做可省 3 轮）**：
- 抽走子组件后，页面里**就地定义的派生值**可能随之被切走（本次丢了
  `subtitleUrl` / `firstSubtitle`，报错才暴露）。切完立刻 typecheck。
- 抽走后页面常有**未使用的 import**（TS6133）逐个清；lucide 图标与
  `Link` 最常被搬空。

---

## 5. 待办 / 需裁决

1. **`app/router/index.tsx` 552 行是否要套此门禁？** 它是**路由声明表**（大量
   `lazy: async () => import(...)` 样板），不是组件。性质上更像配置文件，
   「拆」也没有意义（拆成多文件反而降低「一处看全路由」的价值）。
   **建议裁决：豁免路由表**，或改卡「路由表条目数」而非行数。当前按普通 .tsx 计入门禁。
2. **`.ts` 契约文件不在门禁范围**（`shared/src/contracts/manage/api.ts` 900 行、
   `types.ts` 833 行）。契约是 raw DTO + mapper 双件套，天然长；且已有
   `contracts` 闸管结构。**是否纳入？建议不纳入**（与本卡口径一致：只卡 `.tsx`）。
3. **`mounts/formUtils.tsx` 579 行**：是 `.tsx` 但是**表单工具函数集合**（非组件）。
   是否按组件口径卡？**建议按「是否含 JSX 组件」判定豁免工具模块**——需裁决。
4. **剩余 18 条债务的清偿顺序**：建议按「用户高频 + 改动频繁」排——
   `ManageCollectionsPage`(591) / `ManageUsersPage`(513) / `LoginPage`(587)
   / `UserDrawer`(593) 优先；纯展示大表单（`RegistrationCodeForm` 535、
   `MediaItem*Section` 463/448）可后。
5. **播放 URL 缺会话票据（w3 E2E 发现）**——已按卡面要求**只看清、未改行为**：
   外部播放器链接走 `buildPortablePlaybackUrl()`（绝对 URL，**不含会话票据**），
   播放器本体用 `session.streamUrl`（带票据）。二者用途不同，
   外部播放器场景本就无法带票据。**另卡处理**，不在本卡。

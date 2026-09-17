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

### 4.0 三条铁律（违一条必返工；B2/B3 各犯过）

> **① 子组件类型必须从既有模块 `import` 真实类型，禁止自造窄类型。**
> props 上的每一个类型（含回调签名、枚举、返回结构）都要指向**已存在的**
> 类型/函数签名；不要手写一个「看起来差不多」的局部 interface。
> 典型翻车（B2/B3 共三次）：自造 `SidebarItemSummary` 比真实 `MediaCardSummary` 窄、
> `onError/onTimeUpdate` 比播放器签名窄、自造 `RegistrationCodePendingAction` 把
> **单码** `record` 写成批次、把 `getCodeStatusAction().impact`（**string**）写成 `string[]`。
> **做法**：先 `grep` 既有模块找到权威类型（`PendingCodeAction`、`DangerousActionRequest`、
> `Dispatch<SetStateAction<T>>`、`ReturnType<typeof fn>`），直接复用；
> 拿不准就 `import type` 后让 `tsc` 告诉你哪里不匹配——**报错即证据，改回真实类型**。
>
> **② JSX 块按【行号切片】抽取，禁止靠字符串匹配定位边界。**
> 多分支页面里 `index('</Dialog>')` / 「找下一个 `}}`」会切到别的分支或提前收尾
> （B3 两次：把 `) : isPending ? (` 分支带走、`onConfirm` 多行体产出 TS1381/1382 残骸）。
> **做法**：先 `grep -n` 定位起止行号 → `python3` 按 `lines[i:j]` 切片 →
> **切完立刻** `wc -l` + `pnpm typecheck` 校验行数与语法。
>
> **③ 抽状态 hook 时，页面 early-return 不能进 hook。**
> `if (q.isPending) return <FeedbackState/>` 属**组件**渲染逻辑，留在页面；
> 只把 useState/派生/事件处理器抽进 hook。抽完确认 hook 内**无 JSX 返回**，
> 且需要的 query 对象（`codesQuery` 等）已加入 hook 返回对象供页面 early-return 使用。

### 4.1 步骤

1. 先找**接缝**：early-return 终态面板 → 纯展示区块（header/infobar/stage/sidebar）
   → 子组件（表格行/卡片/搜索面板）→ 共享常量与格式化。
2. 新建**同名目录**（`Xxx/`，已有则复用），页面留壳只做编排 + 状态。
3. 子组件的**类型不要另造**（见铁律 ①）**直接 import 既有类型 / 对齐真实签名**。
4. 拆完跑 `pnpm typecheck` → `pnpm test` → `pnpm component-size --update-baseline` 回收。

**坑（照做可省 3 轮）**：
- 抽走子组件后，页面里**就地定义的派生值**可能随之被切走（PlayPage 丢了
  `subtitleUrl` / `firstSubtitle`，报错才暴露）。按铁律 ② 切片并立刻 typecheck。
- 抽走后页面常有**未使用的 import**（TS6133）逐个清；lucide 图标与
  `Link` 最常被搬空。
- 抽 `use*PageState` hook 时，hook 返回对象手工拼装易**同名键重复**（TS1117）——
  加一轮去重（B3）。

---

## 5. 裁决落地（① ② ③ 已补做，见 §6）

1. **`app/router/index.tsx` → 已豁免**（`EXEMPT_FILES` 显式清单 + reason + ①②③判定标准）。
2. **`.ts` 契约文件 → 维持不纳入**，口径已写进脚本头注释。
3. **`mounts/formUtils.tsx` → 判定结果：不适用「无 JSX」豁免**（见 §6 待裁决）。
4. **剩余 17 条债务的清偿顺序**（裁决 4，不在本卡）：按「高频 + 改动频繁」排——
   `ManageCollectionsPage`(591) / `UserDrawer`(593) / `LoginPage`(587)
   / `ManageUsersPage`(513) 优先；纯展示大表单（`RegistrationCodeForm` 535、
   `MediaItem*Section` 463/448）可后。已立 `FE-COMPONENT-SPLIT-B2` 卡。
5. **播放 URL 缺会话票据（w3 E2E 发现）**——已按卡面要求**只看清、未改行为**：
   外部播放器链接走 `buildPortablePlaybackUrl()`（绝对 URL，**不含会话票据**），
   播放器本体用 `session.streamUrl`（带票据）。二者用途不同，
   外部播放器场景本就无法带票据。**另卡处理**，不在本卡。


---

## 6. 豁免机制（裁决 1/3 落地，commit `b9adb3d`）

### ① 显式豁免清单 `EXEMPT_FILES`（脚本内）
```js
const EXEMPT_FILES = [
  {
    file: 'host/src/app/router/index.tsx',
    reason:
      '路由声明表（① 主体为 lazy 路由声明；② 无业务 JSX 组件；③ 拆分丢失「一处看全路由」价值）。' +
      '长度=路由数量，属天然长度而非结构问题。',
  },
];
```
- 每条须带 `file` + `reason`，新增条目必须在 reason 里说明满足 ①②③。
- **禁止用豁免绕过「懒得拆」**——注释已明写。
- 同步登记进基线 json 的 `exemptFiles`（脚本与数据两处一致）。
- 输出里仍打印行数与理由（`[0] 豁免清单` 段），**防静默放行**。
- 豁免文件不进基线、不参与棘轮（实测：给 router 加行不 FAIL，符合预期）。

### ② 工具模块判定 `hasJsx()`
剥离注释 + 字符串字面量后匹配 JSX 标签；前接字符排除标识符/数字/`)`/`]`
（避免 `a < b` 误判）。**无 JSX 的 .tsx 视为纯函数集合 → 豁免**；含 JSX 即按组件计。

### ③ 口径注释（脚本头）
`.ts`（含 `contracts/manage/api.ts` 900 / `types.ts` 833）**不纳入**：
契约长度 = 端点数量（raw DTO + mapper 双件套），属天然长度且已有 `contracts` 闸。

### 输出与计数
豁免清单移到标题下方独立 `[0]` 段；受管 / 豁免分开计数
（`超线文件 17 个受管（另有 1 个豁免）`）。基线 18 → 17 条。

### 待裁决：`mounts/formUtils.tsx` 实际不适用「无 JSX」豁免
**事实**：该文件 37 个导出中，末尾两个是**真实 JSX 组件**：
- `renderFieldError`（553 行）→ `return <span …>{message}</span>;`
- `renderCredentialProbeStatus`（560–578 行）→ `return (<div …> … </div>);`

按裁决 3 给的判定标准（「文件内无 `return (<…>)`/JSX 语法的视为工具模块」），
它**含 JSX，应仍按组件计**，因此未被自动豁免。
全仓 227 个 .tsx 中，按此规则被判为工具模块的**当前为 0 个**。

**三个选项（请裁一个）**：
- **A（推荐）**：维持现状（按组件计，579 行记债务）。等 B2 卡把它拆成
  `formUtils.ts`（纯函数）+ `formRenderers.tsx`（2 个 JSX helper），
  拆后前者无 JSX 自动豁免、后者小 —— 规则不需要开口子。
- **B**：给 `formUtils.tsx` 加进 `EXEMPT_FILES`，reason 写「主体为纯函数集合，
  仅尾部 2 个 JSX helper」——但这与裁决 3 的「无 JSX」判定标准不一致，
  需要先放宽标准（例如「JSX 占比 <5%」），属**改规则**而非套规则。
- **C**：改判定标准为「无 JSX **或** JSX 行数占比低于阈值」——更通用，
  但也更容易被滥用（调阈值即可绕过）。

我倾向 **A**：不为一个文件破坏规则的清晰性，且拆分本身成本很低。

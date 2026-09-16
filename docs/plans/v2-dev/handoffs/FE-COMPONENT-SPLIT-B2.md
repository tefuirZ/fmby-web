# FE-COMPONENT-SPLIT-B2 交接（w1 · 前端仓 w/zcode/writer1-fe-split-b2）

> B2：按「高频 + 改动频繁」顺序拆 3 个页，并顺手按裁决 A 收口
> `mounts/formUtils.tsx`。纯结构搬迁、行为零变更。

- 基线：`origin/main` @ `d566d97`
- 提交：`1dad2c8`（单一 green commit，本次 4 项一次做完）
- 门禁：`pnpm verify` **12 闸全绿**（34 PASS）
- **基线 17 → 13**（4 条已达标回收）

---

## 1. 拆分结果

| 文件 | 拆前 | 拆后 | 抽出 |
|---|---:|---:|---|
| `manage/ManageCollectionsPage.tsx` | 591 | **385** | `collections/components/`：`CollectionMemberPanel`(75) · `CollectionFormDialog`(118) · `CollectionBatchActions`(123) · `labels.ts`(38) |
| `manage/users/components/UserDrawer.tsx` | 593 | **256** | `UserCreateForm`(230) · `UserEditForm`(217) |
| `manage/ManageUsersPage.tsx` | 513 | **395** | `users/components/`：`UsersHeaderAndTable`(~150) · `UserSelectionBar`(~50) · `UserActionDialogs`(~135) · `pendingAction.ts`(38) |
| `manage/mounts/formUtils.tsx` | 579 | — | **裁决 A**：拆为 `formUtils.ts`(552，无 JSX) + `formRenderers.tsx`(27) |

**formUtils 收口细节**：全仓所有引用都是 `from '../formUtils'`（**无扩展名**），
所以 `.tsx → .ts` 对调用方透明，无需改引用；仅 4 个使用 `renderFieldError` /
`renderCredentialProbeStatus` 的 section 改为从 `formRenderers` 导入。
拆后 `formUtils.ts` 无 JSX → 门禁按「工具模块」**自动豁免**（不是走 `EXEMPT_FILES`
显式清单，是规则本身生效）；`formRenderers.tsx` 27 行，远低于红线。
**规则未开口子**——含 JSX 仍算组件，这次只是纯函数部分真的无 JSX。

---

## 2. 本次踩到的坑（补充到拆法模板）

上一卡记了两条（类型别另造、抽走后残留 import/就地派生值）。本卡新增三条：

1. **「抽出 JSX 块」时块边界容易切错**，尤其条件分支：
   `? (` … `) : xxx ? (` 这种链式三元，靠 `index('</Dialog>')` 常切到别的分支，
   或把紧邻的 `isPending/isError` 分支一并带走。**切完立刻 `wc -l` + typecheck**，
   行数异常小/大都是切错了。UserDrawer 本次就切错了两次（把 pending/error
   分支包进 create 块；ManageUsersPage 把 batch-delete 确认框一起切走）。

2. **`onConfirm={...}` 多行块替换易失败**：`onConfirm` 体里有 `});` 时，
   简单的「找下一个 `}}`」会提前收尾，产出语法错误的残骸（本次 TS1381/TS1382）。
   建议按**行号切片**而非字符串匹配，或直接对整块做行区间替换。

3. **props 别贪多**：`ManageUsersPage` 第一次抽 `UsersHeaderAndTable` 时列了
   11 个回调 prop，结果调用点 85 行、净省 4 行——**等于白抽**。
   改成把分页/筛选的**状态与设置器打包成一个 `control` 对象**（状态仍归页面所有，
   子组件只负责调用）后，调用点降到 ~13 行，净省 ~70 行。
   **经验：抽完发现调用点和被抽块差不多长 → 说明 prop 面太宽，要合并而非放弃。**

另外：`longtail-shared/source-governance-fields.tsx` 的 `MountOption` 由
`interface` 改为 `export interface`——子组件要按**真实类型**声明 props，
不另造窄类型（沿用上一卡的反面教训）。

---

## 3. 剩余 13 条基线 + 建议顺序（B3 起）

| 行 | 文件 |
|---:|---|
| 610 | `manage/ManageRegistrationCodesPage` |
| 600 | `manage/ManageRuntimeLogsPage` |
| 587 | `login/LoginPage` |
| 535 | `manage/registration-codes/components/RegistrationCodeForm` |
| 533 | `manage/naming-rules/scrape-sections` |
| 496 | `manage/ManageOverviewPage` |
| 484 | `manage/ManageMediaItemsPage` |
| 463 | `manage/media-item-detail/components/MediaItemSubtitleSection` |
| 448 | `manage/ManageNamingRulesPage` |
| 448 | `manage/media-item-detail/components/MediaItemMetadataSection` |
| 417 | `manage/ManageRewardsPage` |
| 406 | `manage/mounts/components/MountDrawer/MountDrawer` |
| 403 | `manage/ManageLicensePage` |

**建议下一批（B3）**：`ManageRuntimeLogsPage`(600) → `ManageRegistrationCodesPage`(610)
→ `RegistrationCodeForm`(535)（同属一批改动面，拆法可复用）。
**`LoginPage`(587) 建议继续往后放**：登录页改动风险面大（会话/CSRF/多因素），
且不在管理面高频路径，收益/风险比不如管理页。

---

## 4. 待办 / 需裁决

1. **`UsersHeaderAndTable` 的 `control` 打包是否可接受？** 这是本卡为压缩调用点
   引入的写法（状态仍在页面、子组件只调 setter），**不在既有代码惯例里**。
   若你希望严格「一个 prop 一个回调」的显式风格，我可以改回去——但那样
   `ManageUsersPage` 会回到 430+ 行（超线）。**建议保留并认可该写法**。
2. **`UserEditForm` / `UserCreateForm` 两个组件高度相似**（同为表单，仅字段
   disabled 与提交载荷不同）。是否合并为一个带 `mode` 的 `UserForm`？
   **本次未合并**（纯搬迁优先，合并属重构，会放大 diff 与回归面）。可入后续卡。
3. **B3 及以后的批次**：本卡把 4 项一次做完了（时间够），已帮你把
   `formUtils` 从队列里清掉。剩余 13 条按 §3 顺序推进即可。
4. **门禁本身无新增需求**：棘轮仍双向生效，基线只降不升；
   `formUtils.ts` 的自动豁免证明「无 JSX 即工具模块」这条判定标准可用。

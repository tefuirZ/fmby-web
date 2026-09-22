# FE-DELETE-UX-OPTIMISTIC + FE-LIBRARY-ORDER-UI 交付说明

两张 P1 卡，均**只做前端**（后端零改动、契约文档零改动），前端分支各自独立。

- 分支 `w/zcode/writer1-fe-delete-ux`（基线 origin/main = b84fced，含 confirm-param 合并）
- 分支 `w/zcode/writer1-fe-library-order`（基线 origin/main = 87212f2）

两分支均已 `git merge origin/main` 并在合并树上 `pnpm verify` EXIT 0（host 95/96、shared、themes 全 0 fail；contracts 0、component-size 0 超线、repo-size PASS、theme-parity PASS）。**均未 push**（按常设：等 main 解锁后批量）。

---

## FE-DELETE-UX-OPTIMISTIC（用户产品裁定）

### 已存在（开工前就有的）
- `ManageMountsPage` + `SensitiveActionDialog` 删除确认弹窗（含 `isDeleting` pending 态）。
- `ManageLibrariesPage` + `SensitiveActionDialog` 删除确认弹窗（含 `isDeleting` pending 态）。
- `useMountMutations.deleteMountMutation` 已有 onSuccess（invalidate 刷新列表）。
- `useLibraryMutations.deleteLibraryMutation` 已有 FE-OPT-01② 的 onMutate 乐观移除 + onError 回滚。

### 本卡新增 / 修正
1. **挂载删除补乐观更新**（对齐库删除范式）：`useMountMutations.deleteMountMutation` 加 `onMutate`（cancelQueries + 快照 + 本地过滤掉该 id）+ `onError`（回滚快照 + banner）+ `onSuccess`（invalidate 校验）。点击即列表该行消失，不阻塞 UI。
2. **两条确认弹窗文案补清异步后果**：挂载「删除后该数据源会立即从列表移除；其关联的媒体库资源将由后台异步清理（可能耗时，期间仍可能短暂可见），清理完成前请勿重复操作」；媒体库同义改写。
3. **纯函数可测**：`host/src/pages/manage/mounts/hooks/deleteOptimistic.ts`（`optimisticRemoveMount` / `rollbackMountList`）+ `host/src/pages/manage/libraries/hooks/deleteOptimistic.ts`（`optimisticRemoveLibrary` / `rollbackLibraryList`）。
4. **单测 8 项**（node:test 纯逻辑）：挂载 + 媒体库两条主链路「mutation 后该 id 不在列表」+「失败回滚」。

### 诚实边界（必须如实标注）
- **原 FE-OPT-01② 的库删除乐观更新实为 no-op**：它读 `old.libraries`，但 `getLibraries` 返回 `ManageLibrariesResponse {items}`，字段名不符导致乐观移除从未命中缓存（删除后实际依赖 onSuccess 的 invalidate 才刷新）。本卡已修正为 `items` 形态（commit `fix(delete-ux): 修正媒体库删除乐观更新的缓存字段名`）。
- **后端 `?confirmed=true` 未动**：`deleteMount`/`deleteLibrary` 契约层仍带 `?confirmed=true`（confirm-param / CONFIRM-GATE-ALIGN 工作已覆盖）。卡面要求「接口调用形状不变」，且 w2 改后端去掉 `require_confirmed` 后多余 query 无害，故本卡未改契约层。
- **后端隐藏逻辑未落地时的诚实行为**：w2 将改为「点下去只隐藏、后台异步真删」，DELETE 会立即 2xx。前端 onSettled 的 invalidate 会重新拉取；若后端仅标记隐藏、真删未落地，行会回到列表（前端不假删、不假成功），这是 react-query 自然行为，无需额外代码，但已在实现与本文标注。

---

## FE-LIBRARY-ORDER-UI

### 已存在（开工前就有的）
- 后端 `PUT /api/manage/libraries/order`（V2 已实现，crates/fmby-v2-http + bridges，入参 `ReorderManagedLibrariesRequest.library_ids`）。
- `ManageLibrariesPage` / `LibraryTable` 媒体库列表（桌面表 + 移动卡片双分支）。
- `useLibraryMutations`（create/update/delete/scan，无 reorder）。

### 本卡新增
1. **契约层消费**：`shared/src/contracts/manage/api.ts` 新增 `reorderLibraries(libraryIds: string[])` → `PUT /api/manage/libraries/order`，body `{library_ids}`，返回 `ManageLibrariesResponse`（排序后的库列表）。机械核实：前端此前对 `/api/manage/libraries/order` **零调用**（grep `libraries/order`/`reorderLibraries` 无命中）。
2. **排序交互**（照 B2 成员排序先例，上/下移按钮而非拖拽）：`LibraryTable` 桌面表新增「排序」列（上/下移按钮，disabled 在完整列表边界、aria-label 含库名、`reorderPending` 时禁用），移动卡片分支 rowActions 同样加两按钮。**键盘可达 + 可见焦点**（原生 `<button>` + 全局 `:focus-visible`）。
3. **乐观更新**：`useLibraryMutations.reorderLibrariesMutation` 的 `onMutate`（本地按新序重排）+ `onSuccess`（以服务端返回顺序为准覆盖缓存）+ `onError`（回滚快照 + banner）。交互语义：点击立即本地重排、请求失败回滚并提示，不阻塞 UI。
4. **纯函数**：`host/src/pages/manage/libraries/hooks/libraryOrder.ts`（`moveLibraryIds(ids, id, step)`，边界不环绕、不原地改）。
5. **单测 13 项**：`library-order.test.ts`（moveLibraryIds 上/下/边界/空/连续）+ `library-reorder.contract.test.ts`（PUT 路径/body/返回顺序/失败拒收）。

### 诚实边界
- 排序操作的是**完整列表顺序**（含筛选隐藏项），因为后端 `PUT /order` 要求全量 `library_ids`；UI 按钮在过滤视图每行显示，但点击时对完整 `libraries` 顺序做交换再提交全量顺序。
- 未做卡片 5 余项（后续媒体库等），本卡 scope 仅「两条主链路 + 排序」。

---

## 验证证据
- `pnpm verify`：
  - delete-ux 分支（merge origin/main 后）：EXIT 0，host 95 pass / 0 fail，contracts 0 violations，component-size 0 超线，repo-size PASS，theme-parity PASS。
  - library-order 分支（merge origin/main 后）：EXIT 0，host 96 pass / 0 fail，contracts 0 violations，component-size 0 超线，repo-size PASS，theme-parity PASS。
- 搜索核实（FMBY_ALLOW_SYMBOL_GREP=1）：`reorderLibraries`/`libraries/order` 在改动前于 shared/host 仅在 raw-types 的 `library_ids` 字段定义中出现，无消费调用；`ManageLibrariesResponse` 返回 `{items}`（决定乐观更新字段名修正）。

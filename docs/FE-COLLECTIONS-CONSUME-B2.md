# FE-COLLECTIONS-CONSUME-B2 —— 成员移除 + 成员重排 · `w/zcode/writer1-fe-collections-consume-b2`

> 基线：fmby-web `main` @ `8de0636`（含 B1 成员添加流）。
> 来源：ORCHESTRATION-INBOX.md「COLLECTIONS-FRONTEND-CONSUMPTION-GAP」B2 子项。

## 〇、开工前核实：卡面口径 vs 权威契约（**发现冲突，已纠正**）

卡面写「`members/remove`（按条目移除成员）/ `members/reorder`（成员排序）」。但 B1 handoff
把 `members/remove` 登记成了 **DELETE**——**权威契约不是**：

| 端点（权威 `api-contract-fields.json` + `webui.md`） | 形态 |
| --- | --- |
| `POST /api/manage/collections/{id}/members/remove` | body `{item_id}`（V1 同形态），响应 `ManagedCollectionDetailDto` |
| `DELETE /api/manage/collections/{id}/members/{member_id}` | 按 `member_id` 删（**B1 已消费的 `deleteCollectionMember`**） |
| `POST /api/manage/collections/{id}/members/reorder` | body `{member_ids:[...]}`，响应 `{ok}` |

**结论**：`members/remove` 实为 **POST + `{item_id}`**（与 B1 已消费的 DELETE 是同一动作的
两个入口：POST 按 `item_id`、DELETE 按 `member_id`）。本卡严格按**权威契约**实现 POST 入口，
并在 `fromMember` mapper 补回被 B1 漏掉的 `bound_item_id` 透传（**真实断链**，
见 §二 B2-1）。

`reorder` 的 `member_ids` 是**成员 id**（`member.id`），后端逐条 `parse` + 归属校验
（`collections_members.rs` 3060-3090）——前端用 `members.map(m=>m.id)`，无误。

## 一、本卡新增（只做同域两条：移除 + 重排）

| # | 内容 | 位置 |
| --- | --- | --- |
| B2-1 | 契约层：`ManagedCollectionMemberRecord.boundItemId` 补回；`RemoveInput`/`ReorderInput` 类型；`removeCollectionMember`(POST /members/remove {item_id}) / `reorderCollectionMembers`(POST /members/reorder {member_ids})；`fromMember` 透传 `bound_item_id` | `shared/.../peripherals/{types.ts,api.ts}` |
| B2-2 | UI：`CollectionMemberPanel` 重写——行内 ↑↓ 按钮重排 + 移除切到 POST 入口；`memberReorder.ts` 纯函数 `moveMemberIds`；`ManageCollectionsPage` 接 `removeMemberMutation`/`reorderMemberMutation` | `host/.../collections/components/*` + `ManageCollectionsPage.tsx` |
| B2-3 | 测试：node:test 12 项（wire 对拍 + 纯函数 + 失败态）+ e2e spec（3 项） | `host/tests/*` + `host/e2e/*` |

### 选型理由（卡面要求）：重排用「上/下移按钮」而非 HTML5 拖拽

- **键盘可达**：`<button>` 天然 Tab 聚焦，配合全局 `:focus-visible` 焦点环（FE-LIST-KEYNAV
  已建立纪律），不依赖鼠标；原生 HTML5 drag **无键盘路径**，要补 a11y 需额外实现，收益低。
- **鼠标也能点**，且**零新依赖**（卡面明确禁止引 dnd 库）。
- 每按钮带 `aria-label="将「{title}」上移/下移"`，屏幕阅读器可朗读目标。
- 边界按钮 `disabled`（首行禁上移、末行禁下移），防越界环绕。

### wire 口径（按既有词表，未自造字段）

- 移除：`POST .../{id}/members/remove` body **仅 `{item_id}`**（`item_id` = 后端返回的
  `bound_item_id`）；返回更新后的 `ManagedCollectionDetailDto`。
- 重排：`POST .../{id}/members/reorder` body **仅 `{member_ids}`**（顺序即目标
  `release_order` 递增）。
- `collectionId` 走 `encodeURIComponent`（防路径注入，与 B1 同口径）。

### 失败态（分清，不吞成空 / 不假成功）

- remove：404 合集或成员不存在 / 409 约束冲突 / 403 无权限 / 401 失效 → 经
  `SensitiveActionDialog` 的 `errorMessage` 原样显示（不把确认框当成功）。
- reorder：400 成员不属于该合集 / 404 / 403 / 401 → 经面板 `tableHint` 显示
  `getErrorMessage(error)`，不假成功、不静默。

## 二、真跑证据

### 单测（node --test，可证伪）—— 本环境实跑 80/80（含本卡 12 项新增）

`host/tests/collections-member-remove-reorder.test.ts` 12 项覆盖：
- remove 路径/方法/`{item_id}` snake_case、URL 编码；
- **`bound_item_id` 透传**（B1 漏映射的真实断链，本卡补回后断言可见）；
- remove 404/409/403 均 `reject`；
- reorder 路径/`{member_ids}` 形态/`{ok}` 透传/400 `reject`；
- `moveMemberIds` 上移/下移/边界不环绕/越界返回副本。

### e2e（真实栈）—— 与 B1 同构 spec 已写，**本环境缺 `fmby-v2-server` 二进制未能真跑**

`host/e2e/collections-member-remove-reorder.spec.ts` 3 项 × 2 profile：
1. 重排：首行「下移」→ `成员顺序已更新。` 可见（真实写回）；
2. 移除：点「移除」→ `确认移除` → 成员行数 -1；
3. 失败：对不存在合集 `POST /members/reorder` → ≥4xx。

**诚实边界**：本环境 `E2E_ENABLED=false`（无 Rust 服务端二进制），spec 顶部
`test.skip(!E2E_ENABLED, …)` 触发 Playwright 1.62 的「condition-true 模块级 skip 校验报错」，
故**本环境 e2e 未真跑**。这与 B1 同源：B1 当时在**有二进制的环境**真跑了 6 passed，本卡 spec
与其**逐行同构**（数据集 0 合集 → 先建合集 → 走流），合并后在有二进制环境复跑即可。
`pnpm verify` **不含 e2e**，故不影响门禁（见下）。

### 门禁（卡面要求 `pnpm verify` exit 0 + 原始 tail）

```
VERIFY EXIT: 0
shared test: ℹ tests 94  pass 94  fail 0
themes/_template test: ℹ tests 9  pass 9  fail 0
themes/darkroom test: ℹ tests 19  pass 19  fail 0
host test: ℹ tests 80  pass 80  fail 0
repo-size: PASS
contracts: [PASS] 0 contract violations found.
component-size: 超线文件 0 个受管
theme-parity: PASS（其余 size/dupes/theme-budget 同 PASS）
```

## 三、诚实边界 / 未做项（ponytail：跳过了什么 · 何时再加）

- **e2e 真实栈未在本环境真跑**（缺 `fmby-v2-server` 二进制，与 B1 同源约束）。合并后在有
  二进制环境由 `pnpm e2e` 复跑；spec 已就绪、与 B1 同构。
- **`deleteCollectionMember`（DELETE /{id}/members/{member_id}`）保留在 hooks**——它是 B1
  已落地的另一真实端点（按 member_id 删），本卡把面板移除切到 POST 入口但**未删除**该方法，
  避免破坏 B1 已交付的契约面；页面不再调用其确认逻辑，仅解构用于 `actionError` 合并。属
  B1 既有真实端点方法，非本卡新增死代码。
- **仅做同域 2 条**（卡面范围）。余 8 条零调用登记为 B3：
  `order`(PUT)、`rules/preview`、`presets`、`presets/create`、`{id}/rules`(PATCH)、
  `{id}/sync`、`{id}/members/{member_id}`(PATCH 改 enable/order)、`member-candidates`(B1 已做)。
  B3 聚焦 rules/presets（需先定 UI 形态）。
- **后端零改动**（本卡无任何后端修改）。发现的真实断链（前端 `bound_item_id` 漏映射）属前端
  mapper 缺陷，已在本卡修复；后端 GET 确实返回该字段。

### codegraph 查证记录（卡要求）

| 查询 | 结果 |
| --- | --- |
| `codegraph query "collections" -p host/src` | 未命中符号（索引对 `host/src` 覆盖弱，连续第四轮同一观察） |
| 实际定位方式 | 字面量扫描 `/api/manage/collections*` + 读 `peripherals/api.ts` 方法表 + 后端 `bridges/collections_members.rs` 核实 `member_ids`/`item_id` 取值 |

### code review（requesting-code-review 纪律）

本会话无 subagent dispatch 工具，按技能精神由作者完成等价自检（非派发子代理）：
- wire 形态逐条对拍权威契约（remove POST+item_id / reorder POST+member_ids），无自造字段；
- 数据链路：`bound_item_id` 从 GET → record → POST body 闭环，无类型断裂；
- 无死代码引入、无 unused import、列数对齐（表头 8 列）、按钮 disabled 防环绕；
- 焦点环/aria-label 沿用既有范式，`pnpm verify` 全绿。

## 四、门禁

`pnpm verify` **exit 0**（见 §二 tail）。本轮无截图入库（不占 repo-size 预算）。

## 五、交付状态

分支 `w/zcode/writer1-fe-collections-consume-b2`：3 commits（B2-1/2/3），工作区 clean，
`git merge origin/main` 已 up-to-date（main 无新推进），未 push（按纪律等你合 + 推）。

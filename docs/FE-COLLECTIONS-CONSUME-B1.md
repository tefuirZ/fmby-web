# FE-COLLECTIONS-CONSUME-B1 —— collections 前端消费缺口（成员添加流）· `w/zcode/writer1-fe-collections-consume`
> ⚠ 本文部分结论已被后续卡推翻/与现状不符（见 `docs/FE-REPO-DOC-CLAIM-AUDIT.md` §3；以当前 `shared/src/contracts/**` + `host/src/**` 代码为准）。

> 基线：fmby-web `main` @ `c49795c`（含 FE-LIST-KEYNAV 成果）。
> 来源：ORCHESTRATION-INBOX.md:7104「COLLECTIONS-FRONTEND-CONSUMPTION-GAP」。

## 一、开工前核实：11 条零调用**逐条重核**（板子是否陈旧）

后端权威清单取自 `docs/interfaces/api-contract-fields.json`（17 条，全 `implemented`）；
前端消费面按**真实 `httpClient` 调用路径**判定（排除注释里的文档字面量 —— 初次判定
曾把 `types.ts` 注释中的模板路径误算为「已消费」，已修正）。

### 已消费 6 条（本卡前已存在，不重做）

| 方法 | 路径 | 前端方法 |
| --- | --- | --- |
| GET | `/api/manage/collections` | `listCollections` |
| POST | `/api/manage/collections` | `createCollection` |
| GET | `/api/manage/collections/{id}` | `getCollection` |
| PATCH | `/api/manage/collections/{id}` | `updateCollection` |
| DELETE | `/api/manage/collections/{id}` | `deleteCollection` |
| DELETE | `/api/manage/collections/{id}/members/{member_id}` | `deleteCollectionMember` |

### 仍零调用 11 条（**板子未陈旧**，逐条确认）

`member-candidates`(GET) / `order`(PUT) / `rules/preview`(POST) / `presets`(GET) /
`presets/create`(POST) / `{id}/rules`(PATCH) / `{id}/sync`(POST) /
`{id}/members/reorder`(POST) / `{id}/members/add`(POST) / `{id}/members/remove`(POST) /
`{id}/members/{member_id}`(PATCH)

⇒ 本卡消费其中 **2 条**（成员添加流的配套一对），**余 9 条**登记为 B2/B3…

## 二、本卡新增（只做一条完整流：成员添加）

| # | 内容 | 位置 |
| --- | --- | --- |
| A-1 | `ManagedCollectionMemberCandidate` / `ManagedCollectionMemberAddInput` 类型 | `shared/.../peripherals/types.ts` |
| A-2 | `listCollectionMemberCandidates(keyword)` / `addCollectionMember(id,{itemId})` | `shared/.../peripherals/api.ts` |
| A-3 | query key `collections.memberCandidates(keyword)` | `shared/src/query/keys.ts` |
| A-4 | `useCollectionMemberCandidatesQuery`（keyword<2 **不发请求**）+ `addMemberMutation` | `host/.../collections/hooks.ts` |
| A-5 | `CollectionMemberAdder` UI（关键词 → 候选 select → 加入 → 刷新 → 失败分类） | `host/.../components/CollectionMemberAdder.tsx`（新） |
| A-6 | 挂载在成员面板上方 | `ManageCollectionsPage.tsx` |

### wire 口径（按既有词表，未自造字段）

- 候选：`GET .../member-candidates?keyword=` → **裸数组**；字段 `item_id/library_id/library_name/title/original_title/media_kind/year/overview/community_rating/poster_url`。
  **`overview`/`community_rating`/`poster_url` 恒 null**（契约登记 V2 无源）→ 原样透传，**不伪造摘要、不回落 0 分、不回落占位图**。
- 加入：`POST .../{id}/members/add` body **仅 `{item_id}`**（后端取条目快照写绑定）。
- `keyword` **必填且去空白 ≥2 字符**，否则后端 400（webui.md:469）。

### 失败态（分清，不吞成空列表 / 不假成功）

404 合集不存在 / 409 成员冲突 / 403 无权限 / 401 登录失效 → 分别归类标题；其余按后端文案原样显示。

## 三、真跑证据

- 单测 **10 项**（`host/tests/collections-member-add.test.ts`）：路径/方法/keyword query/
  snake_case 映射/恒 null 三字段/400·404·409·403 均 `reject`。
- e2e **3 项 × 2 profile = 6 passed / 0 failed**：
  1. **边界**：keyword 1 字符 → 提示太短且**不发请求**（无 loading、无候选 select）；
  2. **正向**：建合集（数据集默认 **0 个合集**）→ 候选出现 → 加入 → 「成员已加入合集。」可见；
  3. **失败**：对不存在合集 POST add → **≥4xx**（不假成功）。
- `pnpm verify` **exit 0**。

## 四、诚实边界 / 未做项（ponytail：跳过了什么 · 何时再加）

- **只做 1 条流**（卡面要求）。余 **9 条**零调用登记为后续卡 B2/B3：
  `order`(PUT)、`rules/preview`、`presets`、`presets/create`、`{id}/rules`(PATCH)、
  `{id}/sync`、`members/reorder`、`members/remove`、`members/{member_id}`(PATCH)。
  建议 B2 做 **`members/remove` + `members/reorder`**（与 B1 同域、共享成员面板），
  B3 做 **rules/presets**（规则与预设，需先定 UI 形态）。
- **未换流**：卡面允许换（如 `presets/create`），我仍选成员添加流 —— 理由：它与已消费的
  `GET {id}` / `DELETE member` 同属成员域，能立刻补上「成员只能删不能加」的功能断裂，
  用户收益最直接。
- **e2e 数据集 0 个合集** → e2e 内先建合集再走流（不跳过、不假绿）；这也意味着
  正向流依赖 create 端点可用。
- **候选零命中未做 UI 区分断言**：e2e 中若数据集无候选会落到「没有匹配的候选条目。」，
  本轮数据集有候选（正向流通过），故零命中分支**未**被真跑；由单测（空数组非错误）覆盖。
- **未做分页/上限提示**：候选上限 30 条为后端限制，前端未额外提示（契约无分页）。
- **后端零改动**（本卡无任何后端修改；未发现需上报的后端缺口 —— 两条端点行为与契约一致）。

### codegraph 查证记录（卡要求）

| 查询 | 结果 |
| --- | --- |
| `codegraph query "collections" -p host/src` | 未命中符号（索引对 `host/src` 覆盖弱，连续第三轮同一观察） |
| 实际定位方式 | 字面量扫描 `/api/manage/collections*` + 读 `peripherals/api.ts` 方法表 |

**结论**：codegraph 对 `host/src` 索引覆盖弱已**连续三轮确认**（FE-OPT-03 / FE-LIST-KEYNAV / 本卡），
属索引侧问题，不在本卡范围，未修。

## 五、门禁

`pnpm verify` **exit 0**：typecheck ✓ / build ✓ / themes build ✓ /
test（host **68** + shared 94 + themes 28，0 fail）✓ / size ✓ / dupes ✓ / contracts ✓ /
theme-budget ✓ / component-size ✓ / theme-parity ✓ / repo-size ✓。
本轮**无截图入库**（不占 repo-size 预算）。

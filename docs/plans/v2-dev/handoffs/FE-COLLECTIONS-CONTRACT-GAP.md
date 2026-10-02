# FE-COLLECTIONS-CONTRACT-GAP 交付说明 · 合集成员契约补 `member_origin`

> 卡号：FE-COLLECTIONS-CONTRACT-GAP · 分支：`w/fe/collections-contract-gap`（自 `origin/main` 起，已 merge main）
> 提交：`8ef9c7f`（契约补字段 + mapper + 对拍测试）/ `<handoff>`
> 日期：2026-10-02 · 写手：zcode · `Reviewed-by: pending-non-author-review`

---

## 0. 一句话结论

评审 S17 在 FE-USER-COLLECTIONS-BROWSE 上实证的 MINOR-1 **成立**：后端
`ManagedCollectionMemberDto` 下发 **13** 字段（含 `member_origin`），前端
`RawManagedCollectionMember` 只收 **12**（自 `00eace2` 起未跟上 COLLECTIONS-RULES）。
本卡按后端**真实 wire** 补齐该字段 + mapper + 字段级对拍测试，**不加 UI**（UI 另派）。

---

## 1. 后端 wire 核证（不照抄猜测；卡面明确要求先核）

```
crates/fmby-v2-http/src/state/collections.rs
  /// 管理面合集成员行 DTO。
  /// COLLECTIONS-RULES：补 `bound_item_id`/`member_origin`（规则成员与人工收录的区分依据）。
  pub struct ManagedCollectionMemberDto {
      pub id: String,
      pub collection_id: String,
      pub bound_item_id: Option<String>,
      /// `imported` / `manual` / `rule`（迁移 0044）。
      pub member_origin: String,          ← 本卡补齐目标
      pub title_snapshot: String,
      pub year_snapshot: Option<i32>,
      pub media_kind: String,             // Movie / Series / Unknown（domain as_str 透传）
      pub poster_url_snapshot: Option<String>,
      pub is_enabled: bool,
      pub release_order: Option<u64>,
      pub watch_order: Option<u64>,
      pub created_at: i64,
      pub updated_at: i64,
  }                                        → 共 13 字段
```
前端取证（改动前）：`RawManagedCollectionMember` 12 字段，**无** `member_origin`；
`ManagedCollectionMemberRecord` 无 `memberOrigin` ⇒ 契约已漂移（UI 未消费，无用户可见影响）。

---

## 2. RED → GREEN

### 2.1 RED（先写失败测试）
`host/tests/collections-member-origin.contract.test.ts`（4 用例）先于实现落地：
```
✔ 后端 13 字段：RAW 夹具字段数与后端 DTO 对齐（自证口径）
✖ member_origin → memberOrigin 映射（规则成员）
  + actual - expected
  + undefined
    actual: undefined,
    expected: 'rule'
✖ member_origin 逐值透传（imported / manual 不丢、不归一）   actual: undefined / expected: 'imported'
✖ memberOrigin 不得为 undefined（契约缺字段的漂移信号）      Expected "actual" to be strictly unequal to: undefined
ℹ pass 1  ℹ fail 3     RED_EXIT=1
```

### 2.2 GREEN（最小实现）
- `types.ts`：新增 `CollectionMemberOrigin = 'imported' | 'manual' | 'rule'`
  （沿用 `CollectionMemberMediaKind` 同款字面量联合范式）；`ManagedCollectionMemberRecord` 加 `memberOrigin`。
- `api.ts`：`RawManagedCollectionMember` 加 `member_origin: string`；
  `fromMember` 加 `memberOrigin: r.member_origin as ManagedCollectionMemberRecord["memberOrigin"]`
  （沿用 `mediaKind` 同款 as 收窄写法）。

### 2.3 当次验证原文
```
host/tests/collections-member-origin.contract.test.ts
✔ 后端 13 字段：RAW 夹具字段数与后端 DTO 对齐（自证口径）
✔ member_origin → memberOrigin 映射（规则成员）
✔ member_origin 逐值透传（imported / manual 不丢、不归一）
✔ memberOrigin 不得为 undefined（契约缺字段的漂移信号）
ℹ pass 4  ℹ fail 0     GREEN_EXIT=0

node scripts/check-contract-mappers.mjs
  [PASS] 0 contract violations found. All contracts & domain mappers cleanly aligned.
  MAPPERS_EXIT=0                                    ← 卡面验收项

回归：host/tests/collections-browse-detail.contract.test.ts（同一 mapper 被详情页复用）
  ℹ pass 4  ℹ fail 0
node scripts/check-frontend-component-size.mjs   → GATE_EXIT=0
```

---

## 3. ponytail 与口径

- **最小闭合**：只补字段 + mapper + 测试；**不加 UI**（卡面明确「UI 另派」）、不引依赖、不动后端仓。
- **不归一**：`imported`/`manual`/`rule` 三值逐值透传，不折叠成布尔、不回落默认值。
- **类型收窄**：沿用既有 `as ManagedCollectionMemberRecord["memberOrigin"]` 写法，与 `mediaKind` 一致。

---

## 4. 跳过项与何时再加

- **跳过：UI 消费 `memberOrigin`** —— 卡面明确本卡只闭合契约缺口，展示面另派卡；
  当前详情页 UI 未消费该字段，**无用户可见影响**（与卡面来源一致）。
- **跳过：后端契约仓 / mirror** —— 全程只读核证，未改后端仓与契约仓。
- **跳过：`pnpm typecheck` / 全量 `pnpm test`** —— 本 worktree 无 `node_modules`
  （`pnpm install --offline` 未完成），tsc 不可运行；已验证范围 = 依赖无关的
  `node --test` 契约对拍（4/4）+ 门禁脚本（mapper 0 violations、体积密度 EXIT=0）。
  装依赖后由 CI 复跑 typecheck/e2e。
- **跳过：其它合并字段核查** —— 本卡只闭合 `member_origin` 一条；其余字段已由
  `check-contract-mappers.mjs` 全量对拍为 0 violations（未发现其它漂移）。

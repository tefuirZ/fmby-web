# FE-COLLECTIONS-CONTRACT-GAP 独立对抗式评审（非作者）

- **评审对象**：分支 `w/fe/collections-contract-gap`，tip `b6cdfc1`；交付 `8ef9c7f`（契约补 `member_origin`）+ `b6cdfc1`（handoff）
- **评审工作区**：`/root/.paseo/worktrees/1e9ww33s/fe-contract-density`（该卡分支所在 worktree；验证时临时 symlink node_modules，验证后移除，`git status` 恢复干净）
- **判定**：**APPROVE**
- **对抗式要求逐条核证如下，全部独立取证、未采信 handoff 任何陈述。**

---

## 1. 真实改动范围（对抗点①）

```
$ git fetch origin && git diff origin/main...b6cdfc1 --stat
 docs/plans/v2-dev/handoffs/FE-COLLECTIONS-CONTRACT-GAP.md | 107 +++++
 host/tests/collections-member-origin.contract.test.ts     | 101 +++
 shared/src/contracts/manage/peripherals/api.ts            |   3 +
 shared/src/contracts/manage/peripherals/types.ts          |   5 +
 4 files changed, 216 insertions(+)
```

生产代码新增 **8 行**（api.ts 3 + types.ts 5），其余为测试与文档。`git log 8d865b8..b6cdfc1 -- shared/src/contracts/` 仅 `8ef9c7f` 一个提交触及契约，**无顺手改无关契约**（对抗点⑤ ✓）。逐行核对新增 8 行：Raw 加 `member_origin: string`、mapper 加一行映射、types 加 union 类型 + record 字段 + 两条注释——无多余改动。

## 2. 后端真实 wire 独立核证（对抗点②，本卡核心）

**未采信作者引用，独立到后端仓 `/home/tefuir/rustproject/FMBY-V2` 全链取证：**

**(a) DTO 定义**（`crates/fmby-v2-http/src/state/collections.rs:63-80`）：
```rust
pub struct ManagedCollectionMemberDto {
    pub id: String,
    pub collection_id: String,
    pub bound_item_id: Option<String>,
    /// `imported` / `manual` / `rule`（迁移 0044）。
    pub member_origin: String,
    ...共 13 字段（id/collection_id/bound_item_id/member_origin/title_snapshot/
        year_snapshot/media_kind/poster_url_snapshot/is_enabled/release_order/
        watch_order/created_at/updated_at）
}
```
serde 默认派生（`#[derive(...Serialize...)]`，无 `#[serde(rename)]`）→ **snake_case 原名下发**，`member_origin: String` **非 Option**。

**(b) 枚举取值**（`crates/fmby-v2-domain/src/collections/mod.rs:142-173`）：
```rust
pub enum CollectionMemberOrigin { #[default] Imported, Manual, Rule }
as_str: "imported" / "manual" / "rule"   // mod.rs:153-160
from_str: 其余字符串 fail-closed 返回 None（mod.rs:162-171）
```

**(c) wire 组装链**：`get_collection`（bridges/collections.rs:312）→ `member_to_dto`（collections_support.rs:87）：`member_origin: m.member_origin.as_str().to_string()` —— 小写字面量进 DTO，确认无中间转换。

**(d) DB 层兜底**：迁移 `0044_collection_member_bind.sql:35-36`：`member_origin VARCHAR(16) NOT NULL DEFAULT 'imported' CHECK (member_origin IN ('imported','manual','rule'))`；repo `map_member`（collections_repo.rs:170-173）对未知值 fail-closed 报错。**非合法值无法流到 wire**。

**结论：作者抄写完全准确** —— 字段名 `member_origin`（snake_case）、非 Option、三值枚举 `'imported'|'manual'|'rule'`，均与后端实证一致，无自造。前端 `member_origin: string`（Raw 层宽）+ `CollectionMemberOrigin` 收窄（Record 层严）的分法与仓内 `mediaKind` 同款惯例一致。

## 3. 测试真实性 / RED→GREEN（对抗点③）

测试 `host/tests/collections-member-origin.contract.test.ts`（101 行）4 个用例：夹具 13 字段自证、`member_origin→memberOrigin` 映射（'rule'）、三值逐个透传（不归一不丢）、`memberOrigin !== undefined` 漂移信号。走真实 `httpClient` + `fromDetail`/`fromMember` 全链（仅 fetch 打桩），字段级对拍，**真断言，能防再漂移**。

**独立 RED 复现**（临时 detached worktree @ `8ef9c7f^`，不污染作者分支；已清理）：
```
$ git worktree add --detach /tmp/red-probe-collections 8ef9c7f^   # = 8d865b8
$ node --import ./tests/register-aliases.mjs --test tests/collections-member-origin.contract.test.ts
✔ 后端 13 字段：RAW 夹具字段数与后端 DTO 对齐（自证口径）
✖ member_origin → memberOrigin 映射（规则成员）   actual: undefined, expected: 'rule'
✖ member_origin 逐值透传 ...
✖ memberOrigin 不得为 undefined（契约缺字段的漂移信号）   actual: undefined
ℹ tests 4  ℹ pass 1  ℹ fail 3
```
**真 RED→GREEN 成立**（3 fail → 4 pass），与 handoff 声明一致；断言失败形态正是契约漂移特征（undefined），测试对拍逻辑有效。

## 4. 当次验证原文（对抗点④，评审者本机复现）

> 环境：评审 worktree 临时 symlink 兄弟 worktree node_modules（验证后 `rm` 移除，`git status` 恢复干净）。

```
$ tsc -p shared --noEmit ; echo SHARED_TSC=$?
SHARED_TSC=0
$ tsc -p host/tsconfig.app.json --noEmit ; echo HOST_TSC=$?
HOST_TSC=0

$ cd host && node --import ./tests/register-aliases.mjs --test tests/collections-member-origin.contract.test.ts
✔ 后端 13 字段：RAW 夹具字段数与后端 DTO 对齐（自证口径） (4.626607ms)
✔ member_origin → memberOrigin 映射（规则成员） (114.838541ms)
✔ member_origin 逐值透传（imported / manual 不丢、不归一） (8.334163ms)
✔ memberOrigin 不得为 undefined（契约缺字段的漂移信号） (1.396262ms)
ℹ tests 4  ℹ pass 4  ℹ fail 0

$ cd host && node --import ./tests/register-aliases.mjs --test tests/*.test.ts
ℹ tests 356  ℹ pass 356  ℹ fail 0        # 全量回归：加字段未破坏任何既有夹具断言

$ cd shared && node --import ./tests/register-resolver.mjs --test tests/*.test.ts
ℹ tests 122  ℹ pass 122  ℹ fail 0

$ node scripts/check-contract-mappers.mjs
[PASS] 0 contract violations found. All contracts & domain mappers cleanly aligned.
MAPPERS_EXIT=0

$ node scripts/check-frontend-component-size.mjs
[PASS] 0 违规；2 个存量超线文件在基线内且未上升（棘轮允许，须有拆分计划）。SIZE_EXIT=0

$ node scripts/check-frontend-dupes.mjs
[PASS] 0 violations found. All frontend architectural boundaries clean. DUPES_EXIT=0
```

## 5. Findings

无阻塞、无 Major、无 Minor finding。两条 INFO 级备注（无需返工）：

1. **[INFO] types.ts:41 `CollectionMemberOrigin`** — Record 层类型收窄为三值 union，而 Raw 层为 `string`，映射用 `as` 断言（沿仓内 `mediaKind` 惯例）。当前安全：后端 DB CHECK + repo fail-closed 保证只有三值能出 wire；若未来后端新增取值，前端会在运行时静默透传非 union 值（`as` 不校验）。与仓内既有惯例一致，不构成本卡问题。
2. **[INFO] 未验证项**：`pnpm verify` / vite build / e2e 未跑（本卡 8 行生产改动无 UI 面，e2e 风险极低；如需可交农场 check/build）。后端 `list_members` 实际 SQL SELECT 列序未逐列核对（已由 `map_member` 13 字段元组解构 + DB CHECK 间接闭环，风险可忽略）。

## 6. 结论与依据

- 改动 = 缺口的最小闭合（8 行生产代码），后端 wire 三层独立实证（DTO 定义 / 枚举 as_str / 迁移 CHECK），作者零自造。
- RED→GREEN 经评审者独立复现（3 fail → 4 pass），测试为字段级对拍 + 全链 httpClient，防漂移有效。
- 验证面全绿：双包 tsc 0、host 356 / shared 122 全 pass、三门禁 PASS。
- 消费面核证：`ManagedCollectionMemberRecord` 消费点仅 `fromMember`/`fromDetail`/`getCollection`（codegraph callers），`memberOrigin` 尚无 UI 消费者——加字段为纯增量，无行为回归可能（host 全量 356 pass 佐证）。

**判定：APPROVE**（建议按流程交农场 check/build 补 build 面；本评审未合并、未动 main、未碰农场）。

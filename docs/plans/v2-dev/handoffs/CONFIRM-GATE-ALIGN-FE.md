# CONFIRM-GATE-ALIGN（前端 half）交接 — w1

> 对抗式审查 N-02（P1）：危险操作确认闸 FE/BE 口径不一致 —— 后端要 query
> `?confirmed=true`，前端部分危险写调用**只发 body `confirm_action`、不发 query**
> → 运行时必 **400**（确认闸拒），且编译器/既有测试/契约清单 drift 规则都拦不住。

- 基线：`origin/main` @ `e017a7c`
- 分支：`w/zcode/writer1-confirm-gate`（从最新 main 开，非旧的 `w/zcode/writer1-v1-parity`）
- 提交：见下（单一 green commit）
- 上游 half：`FMBY-V2-worktrees/ws-zcode-writer1` 的 `scripts/check-confirm-gate.mjs` + 后端反证测试

## 后端口径（实测锁定）

```rust
// crates/fmby-v2-http/src/routes/manage.rs
pub struct ConfirmQuery { pub confirmed: Option<String> }
pub(crate) fn require_confirmed(query: &ConfirmQuery) -> … {
    // 只有 confirmed 字符串大小写不敏感等于 "true" 才放行，否则 400
}
```
`httpClient` 侧 `params: { confirmed: true }` → `buildUrl` 用 `String(true)` = `"true"`
→ `?confirmed=true` ✅（`shared/src/api/client.ts:146`）。

## 修改（11 处，全部加 `params: { confirmed: true }`）

**审查 N-02 点名的 5 处中，后端真实挂了 `require_confirmed` 的 3 处**：

| 文件:行 | 调用 | 后端 handler |
|---|---|---|
| `manage/api.ts` `updateUser` | `PATCH /manage/users/{id}` | `manage_users_update` |
| `manage/api.ts` `deleteLibrary` | `DELETE /manage/libraries/{id}` | `manage_libraries_delete` |
| `manage/api.ts` `deleteMount` | `DELETE /manage/mounts/{id}` | `manage_mounts_delete` |

> 审查另点名的 `deleteRegistrationCode` / `deleteRoleTemplate` 在本卡基线（旧 main）的后端
> **无对应路由**；但 **main 随后合并了 REG-CODES-B**，`registration-codes` 的 DELETE 与
> PATCH status 已落地且挂了 `require_confirmed` → 该两处本卡已一并修复（见下表）。
> `role-templates` 的 DELETE 后端仍不存在 → 不修（见「未修」）。

**审查漏报、本卡扫出的 8 处同类漏点**（同一缺陷，按「以后端实际挂 rc 的 handler 为准」一并修）：

| 文件 | 调用 | 后端 handler |
|---|---|---|
| `manage/api.ts` `batchUpdateUsers` | `POST /manage/users/batch/update` | `manage_users_batch_update` |
| `manage/api.ts` `batchDisableUsers` | `POST /manage/users/batch/disable` | `manage_users_batch_disable` |
| `manage/api.ts` `resetUserPassword` | `POST /manage/users/{id}/reset-password` | `manage_users_reset_password` |
| `manage/api.ts` `resetIpLoginRisk` | `POST /manage/login-risk/ip/reset` | `manage_login_risk_ip_reset` |
| `manage/api.ts` `resetUserLoginRisk` | `POST /manage/users/{id}/login-risk/reset` | `manage_users_reset_login_risk` |
| `manage/api.ts` `updateRegistrationCodeStatus` | `PATCH /manage/registration-codes/{id}/status` | `manage_registration_codes_update_status` |
| `manage/api.ts` `deleteRegistrationCode` | `DELETE /manage/registration-codes/{id}` | `manage_registration_codes_delete` |
| `media-items/api/mutations.ts` `deleteMediaItemSource` | `DELETE /manage/media-items/{id}/sources/{sourceId}` | `manage_media_items_source_delete` |

**合计 11 处**（`manage/api.ts` 10 + `media-items/api/mutations.ts` 1）。
body 里的 `confirm_action` **原样保留**（后端不读，但删它会动 wire 契约）。

## 反证（必须项）

### ① 修前 → 400（后端测试锁定）
`crates/fmby-v2-http/src/routes/manage.rs` 新增
`dangerous_write_with_body_only_and_no_query_is_rejected`：
模拟旧前端形态 —— `DELETE /manage/mounts/1` **带 body `{"confirm_action":"delete-mount"}`、
不带 query** → 断言 **400** 且错误文案含 `confirmed=true`。
（既有 `manage_users_delete_requires_confirmation` 已覆盖同型；本测试是 N-02 专属证据。）

### ② 修后 → 过闸
后端 `?confirmed=true` 形态 → 既有测试 `manage_users_delete_requires_confirmation`
断言"携带 confirmed=true 后不再被确认闸拒"（503/500 取决于 service 装配，非 400）。
前端侧由静态门禁 `check-confirm-gate.mjs` 锁定（见下）。

### ③ 新门禁反证（已实测两轮）
`scripts/check-confirm-gate.mjs`（后端 half 交付）：
- 正例（修复后）→ `CONFIRM-GATE CHECK PASSED`，0 violation
- 注入：抽掉任一 `params: { confirmed: true }` → `CONFIRM_PARAM_MISSING` **FAIL**
  （实测抽 `mounts_delete` / `reset-password` 各一次，均 FAIL）

## 本卡未做（有意，非遗漏）

1. **`role-templates` 的 DELETE**：后端**无此路由**（只有 GET/POST/GET{id}）→ 前端
   `deleteRoleTemplate` 是打到不存在端点的 404（**另一类缺陷：路由缺失**，非确认闸），
   不在本卡范围；建议另卡（要么后端补路由，要么前端删死调用）。
2. **`users/batch/delete` 路径漂移**：前端 `POST /manage/users/batch/delete`
   vs 后端 `/manage/users/batch/permanent-delete` → 前端是 **404**（非确认闸问题）。
   同样另卡（路由名对齐）。
3. **`ci.yml`**：**未改**（按主代理指示，CI 归主代理维护；新门禁由主代理挂到
   `pre-merge-gate.sh` 的 node 闸列表）。

## 验证状态

| 项 | 状态 |
|---|---|
| `check-confirm-gate.mjs`（跨仓，node） | ✅ PASS（0 violation）+ 反证 FAIL 有效 |
| 前端 `pnpm typecheck` / `verify` | ⏸ **未跑**（写手不自编译新纪律；由主代理/前端 CI 跑） |
| 后端反证测试 | ⏸ 已写，**未跑**（同上，主代理合并时跑） |
| 改动面 | 2 文件、+28 行（纯新增 `params` 行 + 注释，零逻辑改动） |

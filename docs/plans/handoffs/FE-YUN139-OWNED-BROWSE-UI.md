# 交接 · FE-YUN139-OWNED-BROWSE-UI（139 自有挂载浏览的前端消费面）

仓库 `/home/tefuir/rustproject/fmby-web`，分支 `w/fe2/fe-yun139-owned-browse-ui`（基于 `origin/main`）。
本卡用 **ponytail**（不造字段、不造 UI 直到契约确实）；找符号只用 **codegraph**。

---

## 1. 先取证：前端原本**没有** owned 三端点消费面

`shared/src/contracts/manage/yun139/api.ts` 原有 6 个方法（qr-login / qr-status /
credential-profiles CRUD / reauthorize），**无** `browse` / `credentials` / `activate`
（字符串级检索：`browse`/`credentials`/`activate`/`owned` 全部 False）。
⇒ 卡面「无则补最小消费面」成立。

## 2. 后端真实 wire（`file:line`，逐字段对拍依据）

端点（`crates/fmby-v2-http/src/routes/yun139_accounts.rs`，均 `MANAGE_MOUNT`）：
- `GET  /manage/yun139/accounts/{mount_id}/credentials` → `get_account_credentials` → `service.credentials_info()`
- `POST /manage/yun139/accounts/{mount_id}/browse` → `browse_account` → `service.browse_owned_mount()`
- `POST /manage/yun139/activate` → `activate_account`（`mount_id` 空串 → `Validation`；写回 → runtime 校验 → 失败回滚）

DTO：
- `Yun139CredentialsInfo` @ `crates/fmby-v2-bridges/src/bridges/yun139_owned_mount.rs`：
  `mount_id / has_authorization / has_cookie / can_refresh / authorization_expires_at / updated_at`
- `Yun139OwnedBrowseRequest` @ `crates/fmby-v2-contracts/src/repository/yun139_accounts.rs`：
  `path / offset / limit`，wire 名 `spaceKind`(`space_kind`) / `cloudId`(`cloud_id`,`cloudID`,`family_id`…) / `fileId`(`file_id`,`root_file_id`…)
- `Yun139ActivateRequest`：`mountId`(`mount_id`, 必填) / `authorization` / `cookie` / `spaceKind` / `cloudId`

## 3. 改动（契约层，最小）

`shared/src/contracts/manage/yun139/`：
- `types.ts` 新增 `Yun139CredentialsInfo`、`Yun139OwnedBrowseRequest`、
  `Yun139ActivateRequest`；响应侧 `Yun139OwnedBrowseResult` / `Yun139ActivateResult`。
- `api.ts` 新增 3 个方法：`getOwnedCredentials` / `browseOwnedMount` / `activateOwnedMount`
  + `RawCredentialsInfoResponse`（snake_case 原始形态）。

**不自造字段（红线）**：后端 browse/activate 当前返回 `Json<serde_json::Value>`，
全仓**无** `Yun139OwnedBrowseResponse` 条目 DTO ⇒ 前端只做**不透明透传**（`unknown`），
绝不臆造条目字段；待后端落地条目 DTO 后再细化。

**凭据安全红线（已锁死）**：`Yun139CredentialsInfo` 本身即零明文；前端映射**只输出
meta 五位**，未新增任何 authorization / cookie 明文字段，并由测试断言键名不含
`authorization_value|cookie_value|secret|token|password`。

## 4. RED → GREEN

- **RED**：先写 `shared/tests/yun139-owned-browse.test.ts`（3 例）→ 报
  `yun139Api.getOwnedCredentials is not a function`（真红，非断言写错）。
- **GREEN**：实现后 **3/3 通过**，exit 0。
- 覆盖范围：credentials 的 snake_case→camelCase 对拍 + 无明文断言；
  browse 请求体 wire 命名（`spaceKind`/`cloudId`/`fileId`）；activate 请求体 + `mountId` 必填。

## 5. 顺手修 main 既有 tsc 错（已授权）

`shared/src/api/client/core.ts(4,1) TS6192`：`isBackendErrorBody, retryableForCode`
两个 import **全未使用**（body 内 0 次引用），由 main 的 `c25c4ed`（FE-CLIENT-SPLIT）
引入。已删除该行；其余 import（`ApiError`/`isApiError`/`isSessionInvalidationError`/
`notifyAuthFailure`/`mapResponseToApiError`）均有用，保留。
⇒ 修后 **shared tsc 0 错**（exit 0）。

## 6. 当次验证

```
shared: npx tsc -p . --noEmit                 → exit 0（0 错）
shared: node --import ./tests/register-resolver.mjs --test tests/yun139-owned-browse.test.ts
                                              → tests 3 / pass 3 / fail 0
shared: node --import ./tests/register-resolver.mjs --test tests/*.test.ts
                                              → tests 125 / pass 125 / fail 0
node scripts/check-frontend-size.mjs          → PASS
node scripts/check-frontend-component-size.mjs→ PASS
node scripts/check-contract-mappers.mjs       → PASS
```

## 7. 跳过项 / 待办（明写）

- **host tsc 仍有 3 处错，均为 main 基线，非本卡引入**（`git status` 可证我未触碰）：
  1. `host/src/pages/browse/CollectionsListPage.tsx(5,10) TS2305`：`@fmby/v2-shared/viewmodels`
     无导出 `useCollectionsList`（**真实断链**，疑似他人 in-flight）。
  2. 同文件 `(107,25) TS7006`：`collection` 隐式 any（上条断链的连锁）。
  3. `host/src/pages/manage/mounts/mountFormState.ts(101,5) TS2353`：`note` 不在
     `CreateManageMountRequest` —— **此即我 `w/w5/fe-tsc-baseline-fix` 已修的那处**，
     该分支待你合并后即消。
  ⇒ 本卡不越界修他人文件；host tsc 全绿需上述合并/返工后达成（**建议 CI 复跑确认**）。
- **未做页面/抽屉 UI**：卡面目标 3（挂载详情加「自有 139 账号」区）**未做**。
  理由（ponytail + 不造假）：browse 在无 139 数据面时桥内**恒 503 fail-closed**，
  且响应无条目 DTO ⇒ 现在铺 UI 会得到一个永远空/报错的面。
  **建议**：等后端条目 DTO + 数据面落地后另开 UI 卡；本卡先交契约层（可测、可对拍）。
- 未改契约仓 / mirror；未引依赖；不碰农场；未跑全仓重活。

## 8. 提交

一原子项一提交：契约层 3 方法 + 类型 + RED 测试 + 顺手修 main 既有 tsc 错（core.ts）。

`Reviewed-by: pending-non-author-review`

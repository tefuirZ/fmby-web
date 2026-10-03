# FE-LICENSE-REMAINING 交付说明 · 前端授权交互残余对齐

> 卡号：FE-LICENSE-REMAINING · 分支：`w/fe1/fe-license-remaining`（自 `origin/main` = `e094921` 起）
> 提交：`b176a3a`（Emby 导入契约 3 端点）/ `602fe1b`（门判定面 6 用例）/ `<handoff>`
> 日期：2026-10-03 · 写手：zcode（席位目录 worktree）· `Reviewed-by: pending-non-author-review`

---

## 0. 先证伪结论（本卡核心取证，推翻旧 handoff）

LICENSE-UX-V1-PARITY handoff §5 曾登记「4 处字段级付费门需先补 V2 底层功能再接线」。
**独立取证证明该前置已全部就绪**，旧阻塞理由失效：

| V1 门（surface，kebab） | V1 消费点 | V2 底层功能现状（取证） | 判定 |
|---|---|---|---|
| `upstream-emby` | `ManageUsersPage:49,205,216,370`（「从 Emby 导入」入口+抽屉） | `POST /manage/users/emby-import(/preview)`、`GET .../jobs` 3 端点已挂（`router_core.rs`），DTO `manage_emby_user_import.rs` 全量 | ✅ 可接线 |
| `user-expiration` | `ManageUsersPage:49,321,362,373,393,436` | `valid_until` 在用户创建/更新 payload 与 `ManagedUserDto` wire（`state/manage_users.rs`，0046 列）；V2 users 表单已有 `validUntil` 字段（`users/components/*`） | ✅ 已接线（characterization） |
| `registration-window` | `ManageSiteSettingsPage:92,278` | `registration_window` 在 license 面（`license_gate.rs` 等）；visibility 契约字段已在 | ✅ 门判定可用 |
| `identity-google`/`identity-telegram` | `ManageSiteSettingsPage:93-94,170`（security tab 过滤） | V2 登录提供方**另立** `manage/auth-providers/` 页（含 google/telegram types）；site-settings 无该 section 属**结构性差异**而非缺口 | ⚠ 形态差异（登记，不硬抄 V1 tab 语义） |

**V1→V2 落地决策**：`canUsePaidFeature`（kebab surface）+ `isPaidFeatureEnabled(status, feature)`
均已在 V2 `host/src/pages/manage/license/licenseAccess.ts` 并入且语义照 V1——4 处门的**判定面**
V2 已完备，本卡补的是**消费该判定的契约面**（Emby 导入 0 消费 → 补齐）+ 全量 characterization 钉住。

## 1. 变更清单

### ① Emby 用户导入契约（`b176a3a`，`shared/src/contracts/manage/api.ts`）
后端 wire 取证：`crates/fmby-v2-http/src/routes/manage_emby_user_import.rs`（3 路由）+
`dto/manage_emby_user_import.rs`（source tagged enum `kind=saved|temporary`；summary
snake 六计数；result 词表 `created|updated|skipped|failed` / action 7 值；jobs wire 小写）。
- `manageApi.previewEmbyUserImport` → `POST /manage/users/emby-import/preview`
- `manageApi.importEmbyUsers` → `POST /manage/users/emby-import`
- `manageApi.listEmbyUserImportJobs` → `GET /manage/users/emby-import/jobs`
- 类型/mapper：`EmbyUserImport*Record`（snake→camel）+ `RawEmbyUserImport*`；词表**透传不归一**。

### ② 门判定面测试（`602fe1b`，`host/tests/license-remaining.contract.test.ts`，6 用例）
4 门 characterization + preview wire 断言（路径 + 真 wire 夹具形状）+ 门决策断言。

## 2. RED → GREEN

- RED：`previewEmbyUserImport` 未实现 → `manageApi.previewEmbyUserImport 未实现（RED 特征）`
  （1 fail）；补契约后 6/6 pass。
- 过程修正：surface 名误传 camelCase（`upstreamEmby`）→ 实为 V1 kebab 词表
  （`summary.ts::canUseLicenseVisibilitySurface` switch），修正测试后门判定全绿——判定面本身无缺口。

## 3. 当次验证原文

```
host tests/license-remaining.contract.test.ts → pass 6 / fail 0
host tests/collections-*.test.ts（3 件回归）    → pass 14 / fail 0
node scripts/check-frontend-component-size.mjs  → [PASS] 0 违规（SIZE_EXIT=0）
node scripts/check-contract-mappers.mjs         → [PASS] 0 contract violations
```

## 4. 跳过项与何时再加

- **跳过：UsersHeaderAndTable `headerActions` 插槽 + EmbyImportDrawer 组件接线** ——
  本 worktree 无 `node_modules`（react 不可 import），SSR 组件测试无法运行；组件渲染
  测试（初版已写）判 ERR_MODULE_NOT_FOUND 后移除，改由门判定面 + 契约面钉住语义。
  组件接线交下卡/评审（依赖农场装依赖后补 e2e）。
- **跳过：site-settings 硬抄 V1 三 section** —— V2 结构性差异（identity 另立页），
  硬抄会制造重复 UI；登记形态差异待主代理裁决是否在 auth-providers 页补门。
- **跳过：tsc 双包** —— 无 node_modules；由 CI 复跑。
- 事故登记：验证中一次 `git checkout origin/main -- .` 误覆盖未提交的 api.ts 改动
  （测试文件 untracked 幸存），已按取证记录重做并**先 commit 后验证**止损；
  教训：换基线前必须先落 `/tmp/<name>.patch`。

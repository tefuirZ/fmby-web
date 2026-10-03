# 交接 · FE-REGISTRATION-WINDOW-UI（注册窗口设置 UI）

仓库 `/home/tefuir/rustproject/fmby-web`，分支 `w/fe2b/fe-registration-window-ui-2`（基于 `origin/main`）。
本卡用 **ponytail**（复用既有范式、不造字段、不造新组件壳）；找符号只用 **codegraph**。

---

## 0. 教训（先写，避免复发）

上一轮我得出「后端无注册窗口管理读写端点」的**证伪结论是错的**——错在取证方法：
我只在**自己的工作区**（落后 main 300+ 提交）查文件/路由，没有用 `origin/main` ref 查。
**正确做法（本轮采用）**：`git fetch` 后一律 `git show origin/main:<path>` /
`git ls-tree -r --name-only origin/main`，**不查工作区文件**。
⇒ 「证伪」与「红」结论一样，都必须按**最新 main 的证据**核。

## 1. 后端真源（`origin/main` `e3e714add` 实测，非工作区）

端点（`crates/fmby-v2-http/src/routes/router_manage.rs:88/92`）：
- `GET /api/manage/users/direct-registration/settings` → `manage_direct_registration_settings_get`
- `PUT /api/manage/users/direct-registration/settings` → `manage_direct_registration_settings_put`
  （**全量替换**，回落库后真值）
- handler 文件：`crates/fmby-v2-http/src/routes/manage_registration_window.rs`
- 能力门：**`MANAGE_ACCESS`**（= `manage:users`，不是 `MANAGE_SETTINGS`）

DTO：`DirectRegistrationSettingsDto` @ `crates/fmby-v2-contracts/src/dto_registration.rs:17`
```
enabled: bool            start_at: Option<i64>   end_at: Option<i64>
max_users: Option<i64>   default_role_template: Option<String>
```
- `#[serde(default, deny_unknown_fields)]` ⇒ 前端**只能发这 5 个字段**，多一个即 400。
- `unset_default()` = `default()` ⇒ 未持久化 = **关闭**。
- 与注册侧 `self_register::DirectRegistrationSettings` **同字段名**（KV 即本形状 JSON）。

## 2. ★时间单位（本轮重点核实，不猜）

后端 `availability_of(cfg, now_ms: i64, …)`（`bridges/self_register.rs`）：
`now_ms < start_at` ⇒ 拒；`now_ms > end_at` ⇒ 拒
⇒ **`start_at`/`end_at` 是 epoch 毫秒**。表单用 `datetime-local`（秒级）必须显式换算，
故在 `manageApi` 上加了 `toDateTimeLocal` / `fromDateTimeLocal`（空串 ⇄ `null`，绝不臆造 0）。

## 3. 边界与校验（照后端，不自行收紧/放宽）

`validate_direct_registration_settings`（bridges）：
- `start_at >= end_at` ⇒ Validation「start_at 必须早于 end_at」（**严格早于**）
- `max_users < 0` ⇒「名额不得为负」
- `enabled && default_role_template` 空 ⇒「启用时必须指定默认权限模板」

`availability_of`：未启用→「未开放」；模板未配→「尚未配置默认权限模板」；
模板不存在→「模板不存在，请联系管理员修复」；`now_ms<start_at`→「尚未开始」；
`now_ms>end_at`→「已结束」；`used>=max_users`→「名额已满」。
⇒ 起止**含边界放行**（正好等于开始/结束时刻仍可注册），UI 提示已照此写。

防枚举：未配置与配置损坏在匿名侧**统一文案**（上层 de-enumerate）。
本卡只做**管理面**（`MANAGE_ACCESS`），管理面可看真实原因；不改动匿名侧口径。

## 4. 改动清单（最小，复用既有范式）

| 文件 | 内容 |
|---|---|
| `shared/src/contracts/manage/types.ts` | 新增 `DirectRegistrationSettings`（camelCase 视图，注释钉死 ms 语义） |
| `shared/src/contracts/manage/index.ts` | 导出该类型 |
| `shared/src/contracts/manage/api.ts` | `getDirectRegistrationSettings` / `putDirectRegistrationSettings` / `unsetDirectRegistrationSettings` + `toDateTimeLocal` / `fromDateTimeLocal` + raw 映射 |
| `shared/src/query/keys.ts` | `manage.users.directRegistrationSettings()` |
| `host/src/pages/manage/users/hooks/useDirectRegistrationSettings.ts` | query + mutation（**以 PUT 响应写回缓存**，不做本地乐观臆造） |
| `host/src/pages/manage/users/components/DirectRegistrationSection.tsx` | 表单（启用/起止/名额/模板）+ 加载/错误/保存失败态 |
| `host/src/pages/manage/users/components/index.ts` | 导出组件 |
| `host/src/pages/manage/ManageUsersPage.tsx` | 挂载 `<DirectRegistrationSection />`（挂到 users 面，与 `MANAGE_ACCESS` 族一致） |

范式复用：外壳用既有 **`ManageSectionCard`**（`host/src/pages/manage/components.tsx:78`），
样式复用 `ManageShared.module.css` 既有类（**未新造 class**）；
数据面走 `users/hooks` 而非页面直调 `useQuery`（照 `useUserQueries`/`useUserMutations`）。

## 5. RED → GREEN

- **RED**：先写 `shared/tests/direct-registration-settings.test.ts`（4 例）→
  `manageApi.unsetDirectRegistrationSettings is not a function`（真红）。
- **中途两处是「我的测试/我的装配」错，按纪律改自己、不改实现**：
  1. PUT 用例我错误地 **mock 了自己的方法**（录到 camelCase 入参，断言不到 wire）
     ⇒ 改为 **mock `httpClient.put`**，才真正断言到上线的 snake_case body（这条才是
     `deny_unknown_fields` 的守护）。
  2. 装配期我把 `queryKeys` 加到了 **libraries 块**（应在 users 块）、且未在 barrel 导出类型
     ⇒ tsc 报错后修正（**不是**改实现绕过）。
- **GREEN**：契约 4/4；host 390/390；shared 129/129。

## 6. 当次验证（原文级）

```
shared: npx tsc -p . --noEmit                 → exit 0（0 错）
host:   npx tsc -p tsconfig.app.json --noEmit  → 仅 3 处**main 基线错**（非本卡，见 §7）
host:   npm test                               → tests 390 / pass 390 / fail 0   （node --test，非 vitest）
shared: node --import ./tests/register-resolver.mjs --test tests/*.test.ts
                                              → tests 129 / pass 129 / fail 0
shared: node --import ./tests/register-resolver.mjs --test tests/direct-registration-settings.test.ts
                                              → tests 4 / pass 4 / fail 0
node scripts/check-frontend-size.mjs           → PASS
node scripts/check-frontend-component-size.mjs → PASS
node scripts/check-contract-mappers.mjs        → PASS
```

## 7. 跳过项 / 待裁（明写）

- **host tsc 仍有 3 处 main 基线错，非本卡引入**（我只动了上表 8 个文件）：
  1. `CollectionsListPage.tsx(5,10) TS2305` — `useCollectionsList` 不存在（**真实断链**，他人 in-flight）
  2. 同文件 `(109,25) TS7006` — `collection` 隐式 any（上条连锁）
  3. `Pan115DirectoryBrowserSection.tsx(10,27) TS6133` — 未用 import（他人）
  ⇒ 你提到这 3 处应随 `fe-tsc-baseline-fix` 消除，但在本树（最新 main）**仍在**；
  我不越界改他人文件，建议派返工卡或你合并时统一处理。
- **未做浏览器/键盘实测**：焦点顺序、保存后焦点位置等需在浏览器验证（沿用
  FE-A11Y-KEYBOARD-AUDIT 口径；本卡表单已给每个输入框 `aria-label`，错误态走
  既有 `FeedbackState`（其 `role/aria-live` 已在上张卡补齐））。
- 未改后端、未造字段、未改契约仓/mirror、未引依赖、未跑全仓重活、不碰农场。

## 8. 提交

一原子项一提交：契约 + queryKey + hook + 组件 + 挂载 + 测试 + handoff。

`Reviewed-by: pending-non-author-review`

# FE-LICENSE-REMAINING handoff（前端授权交互残余对齐：4 处字段级付费门 → V2 逐项补齐）

> 卡号：FE-LICENSE-REMAINING · 分支：`w/fe/license-remaining`（自 `origin/main = a1c13f9`）
> 仓库：`/home/tefuir/rustproject/fmby-web` · 日期：2026-10-02 · 写手：zcode
> `Reviewed-by: pending-non-author-review`

---

## 0. 结论一句话（先证伪/取证后的逐项处置）

承接 `LICENSE-UX-V1-PARITY` handoff §5「4 处 V1 字段级付费门未接」。核实 V2 现状后**逐项**处置：

| V1 门（file:line） | surface | V2 对应面 | 本卡处置 |
|---|---|---|---|
| `ManageUsersPage.tsx:48` | `user-expiration` | V2 users **有** `validUntil`（UserCreateForm:177 / UserEditForm:153） | ✅ **接线**（未开通→禁用+诚实提示） |
| `ManageUsersPage.tsx:48` | `upstream-emby` | V2 users **无** Emby 导入；能力已由 `ManageUpstreamsPage` **页级** `ManagePaidFeatureGuard feature=['upstream-emby','upstream-apple-cms']` 覆盖 | ⏭ **N/A**（页级已守卫，users 无该入口） |
| `ManageSiteSettingsPage.tsx:90` / `SiteSettingsRegistrationSection.tsx:16` | `registration-window` | V2 `SiteSettingsRegistrationSection` **无**「注册窗口」字段面（仅 allowRegistration + banner） | ⏭ **N/A**（底层功能缺位，登记后续） |
| `ManageSiteSettingsPage.tsx:90` / `SiteSettingsSecuritySection.tsx:18` | `identity-google` / `identity-telegram` | V2 登录提供方已另立 `auth-providers/AuthProvidersSection`（google/telegram 开关） | ✅ **接线**（未开通→禁用开关+提示） |

⇒ 补齐 **3 个 surface**（`user-expiration`、`identity-google`、`identity-telegram`）；2 项如实登记 N/A（不造假接线）。

**诚实边界**：Google/Telegram 未开通时**只禁「开」（disable），不改存量值**（非破坏式；与 V1 `allowedProviders` 只筛登录面同义——禁新启用，不清既配）。

---

## 1. 取证（codegraph + 源码）

### 1.1 判据与 surface（V2 已是付费面）

```
shared/src/contracts/manage/license/summary.ts
  :17-24  PAID_MANAGE_SURFACES 含 upstream-emby / registration-window / user-expiration /
          identity-google / identity-telegram
  :32-45  FREE_LICENSE_VISIBILITY：上列 5 项**全 false**（免费基线 fail-closed）
  :54-88  canUseLicenseVisibilitySurface(surface) → visibility.<位>
host/src/pages/manage/license/licenseAccess.ts
  :19 canUsePaidFeature(visibility, surface)   :27 isPaidFeatureEnabled(status, feature)
host/src/pages/manage/ManagePaidFeatureGuard.tsx   （页级守卫，数据源 useLicenseStatusQuery）
```

### 1.2 V1 4 处原文（`/data/projects/fmby-main/fmby`）

```
apps/web/src/pages/manage/ManageUsersPage.tsx:49-50
  const canUseUserExpiration = canUsePaidFeature('user-expiration');
  const canUseUpstreamEmby = canUsePaidFeature('upstream-emby');
apps/web/src/pages/manage/ManageSiteSettingsPage.tsx:92-94
  canUseRegistrationWindow / canUseGoogleIdentity / canUseTelegramIdentity
apps/web/src/pages/manage/site-settings/components/SiteSettingsSecuritySection.tsx:18
  canUseGoogleIdentity/TelegramIdentity → allowedProviders（筛 google/telegram）
```

### 1.3 V2 对应面

```
host/src/pages/manage/users/components/UserCreateForm.tsx:177 / UserEditForm.tsx:153  「有效期截止」输入
host/src/pages/manage/auth-providers/AuthProvidersSection.tsx  google/telegram 行（enabled/allowLogin/allowBinding/allowPasswordReset）
host/src/pages/manage/ManageUpstreamsPage.tsx:171  <ManagePaidFeatureGuard feature=['upstream-emby','upstream-apple-cms']>（页级已守卫）
```

---

## 2. RED → GREEN

**RED**：`host/tests/license-paid-surfaces.test.ts` 导入 `paidSurfaceForAuthProvider`（此前不存在）→ 模块解析失败（feature missing）。

**GREEN**：实现后
```
$ cd host && node --import ./tests/register-aliases.mjs --test tests/license-paid-surfaces.test.ts
✔ 登录提供方 → 付费 surface 映射（大小写不敏感；非付费 provider 不受门控）
✔ 免费基线 fail-closed：4 处新接 surface 全不可用
✔ 开通后对应 surface 放行、其余仍拒（不误伤）
ℹ tests 3  ℹ pass 3  ℹ fail 0        EXIT=0
```

**实现清单**：
- `licenseAccess.ts`：新增 Vite-free `paidSurfaceForAuthProvider(provider)`（google→`identity-google`、telegram→`identity-telegram`，其余 null）。
- `AuthProvidersSection.tsx`：`useLicenseStatusQuery` → google/telegram 未开通时**禁用该行 4 个开关** + 顶部 `InlineBanner`「部分登录提供方未开通」。（★修：hook 提到所有 early-return 之前，守 Rules of Hooks。）
- `users/components/UserDrawer.tsx`：`isPaidFeatureEnabled(status, 'user-expiration')` → 传 `canUseUserExpiration` 给 Create/Edit 表单。
- `UserCreateForm.tsx` / `UserEditForm.tsx`：未开通时 `disabled` 有效期输入 + 诚实提示「当前授权未开通「账号有效期」…」。

---

## 3. 当次验证原文

```
$ node …/typescript/bin/tsc -p host/tsconfig.app.json --noEmit   → HOST_TSC=0
$ node …/typescript/bin/tsc -p shared/tsconfig.json --noEmit     → SHARED_TSC=0
$ cd host && node --import ./tests/register-aliases.mjs --test tests/*.test.ts
ℹ tests 351  ℹ pass 351  ℹ fail 0          （含本卡 +3）
$ cd shared && node --import ./tests/register-resolver.mjs --test tests/*.test.ts
ℹ tests 122  ℹ pass 122  ℹ fail 0
$ node scripts/check-frontend-component-size.mjs → [PASS] 0 违规
$ node scripts/check-contract-mappers.mjs        → [PASS] 0 contract violations
$ node scripts/check-frontend-dupes.mjs          → [PASS] 0 violations
$ git fetch origin && git merge origin/main      → Already up to date
```

> **说明（后端脚本 N/A）**：卡面/派单里的 `branch-gates.sh`、`precheck-writer.mjs`、`local-check.sh check --workspace` 均为**后端仓（FMBY-V2）**脚本——在 fmby-web 上 `branch-gates` 多数 `SKIP(no script)`、`precheck-writer.mjs` 不存在（`MODULE_NOT_FOUND`）、`local-check` 是 Rust 工具链。**前端等价验证 = 上列 tsc + node:test + 3 前端门禁**（全绿）。tsc 用兄弟 worktree 的 node_modules（gitignore，验证后已移除，工作区干净）。

---

## 4. 跳过项 / 登记（不假装完整对齐）

- **`upstream-emby`**：V2 users 无 Emby 导入入口；能力面由 `ManageUpstreamsPage` **页级**守卫覆盖 ⇒ 本卡不在 users 重复接（避免双守卫）。
- **`registration-window`**：V2 `site-settings` 无「注册窗口」字段面 ⇒ 需先补后端字段再接线；登记为后续卡触发条件（与 `LICENSE-UX-V1-PARITY §5` 同）。
- **非破坏式口径**：未开通时禁「开」、不清存量（见 §0 诚实边界）；若产品要求「未开通即强制关闭存量」，需另裁。
- **未跑**：`pnpm verify` / vite build / e2e（本机队列拒重活；tsc+test+gates 已覆盖本卡改动面）。

## 5. 提交与工作区

```
$ git log --oneline -1
80eb87b feat(license): 补齐字段级付费门 user-expiration / identity-google / identity-telegram（FE-LICENSE-REMAINING）
（+ 本 handoff 提交）

$ git status --short
（空）
```

尾注 `Reviewed-by: pending-non-author-review`（不代表主代理已评审）。

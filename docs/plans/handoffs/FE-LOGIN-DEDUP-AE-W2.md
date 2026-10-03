# FE-LOGIN-DEDUP-AE 交付（W2 自行立卡，依 assets 席「本席位自行立卡」先例）

分支 `w/w2/fe-login-dedup`（worktree `/data/wt-w2-fe-login-dedup`，基于 `origin/main` = `10c5298`）。
卡面：`/root/fmby-orchestra/cards/FE-LOGIN-DEDUP-AE.md`。

## 1. 为什么自卡

W2 在做 FE-LOG-ARCHIVE 时取证发现 `origin/main`（fmby-web）**typecheck 22 错 / `vite build` 失败**
（前端主分支不可构建）。证据档已推：`FE-MAIN-TSC-BREAKAGE-W2.md`。
其中「A 组：`LoginPage.tsx` 重复块」**可证明零行为改动**（5 处重复块脚本比对**逐字节相同**），
且当时**无人认领**（我核过全部在途 FE 分支）。仓内已有 assets 席自卡先例 ⇒ 自卡并执行。

## 2. 改了什么（只删，不增语义）

| 文件 | 改动 |
|---|---|
| `host/src/pages/login/LoginPage.tsx` | **5 处逐字节相同的重复块**去重（各保留一份）：`AuthResponse` import、`MfaVerifyPanel` import、`mfaChallenge` useState、`handleAuthResponse` 函数、JSX `: mfaChallenge ? (…)` 三元分支 |
| `.../MountDrawer/sections/Pan115DirectoryBrowserSection.tsx` | 删未用 import `isPan115CredentialError`（TS6133） |

净 **diff：2 文件 / +1 −19**（无任何新逻辑）。

**成因形态（供后续防复发）**：
```
459c169 feat(mfa): MFA/TOTP 契约 + 登录二因子流        ← MFA 首次落地
4be4a86 Revert "Merge …459c169…"                        ← 被 revert
9409c1c / 1cc66f3 feat(mfa) …（重新落地 + 返工 2/2）
b092741 Merge commit '1cc66f3…'                         ← revert 侧 × 重现侧 合并 ⇒ 两边块共存
```

## 3. RED → GREEN（当次原文）

```bash
# RED（本 worktree、本卡分支、未打补丁）
cd host && ./node_modules/.bin/tsc -p tsconfig.app.json --noEmit     # EXIT=2
  错误数: 22
     13  src/pages/login/LoginPage.tsx
      5  src/pages/login/forms/MfaVerifyPanel.tsx
      2  src/pages/browse/CollectionsListPage.tsx
      1  src/pages/login/forms/LoginForm.tsx
      1  src/pages/manage/mounts/components/MountDrawer/sections/Pan115DirectoryBrowserSection.tsx

# GREEN（打补丁后同一命令）
  错误数: 10
      5  src/pages/login/forms/MfaVerifyPanel.tsx
      2  src/pages/browse/CollectionsListPage.tsx
      2  src/pages/login/LoginPage.tsx        ← 见 §4
      1  src/pages/login/forms/LoginForm.tsx
  Pan115DirectoryBrowserSection.tsx ✅ 已清零
```
构建侧（前卡已实测并记录）：`vite build` 由「51 模块即挂（A 组）」→「2477 模块通过、改挂 B 组」。

## 4. ⚠ 实测比预估多 1 条：LoginPage 仍余 **2 条语义错**（非本卡能修）

```
src/pages/login/LoginPage.tsx(151,34): error TS2339: Property 'user' does not exist on type 'AuthResponse'.
src/pages/login/LoginPage.tsx(290,22): error TS2322: Type '(response: AuthResponse) => void' is not assignable to type '(user: User) => void'.
源码：handleAuthResponse(response) { if (response.status === 'mfa_required' && response.challengeId) { … return; }
                                      handleAuthenticated(response.user); }   ← 此处
```
`AuthResponse` 已改为**可辨识联合**，而守卫 `status === 'mfa_required' && challengeId` **未排除**
`mfa_required && !challengeId` 这一形态 ⇒ `response.user` 不成立。

**这属 w5 提交 `1cc66f3`「AuthResponse 改可辨识联合 + LoginPage 按 status 收窄（返工 2/2）」的余项**，
需作者定夺语义（守 `status` 单独判定？还是 `mfa_required` 缺 challengeId 时给错误态？）——
**故本卡未动它**（改了就是替人决定 API 语义）。我自卡时写的「≤9 且不含 LoginPage」过于乐观，
**已据实测更正卡面验收**，并在下节如实登记。

## 5. 据实登记：本卡**不使 main 转绿**

修完本卡后 `tsc` 仍 **10 错**、`vite build` 仍挂 ⇒ `check-frontend-size`（体积闸）**仍不能出结论**。
剩余分组（与 `FE-MAIN-TSC-BREAKAGE-W2.md` §3 一致）：
- B 组 `MfaVerifyPanel.tsx` 5 错（`contracts/auth` 缺 `SESSION_USERNAME_STORAGE_KEY` 等导出 + 可空性）→ **MFA 作者**
- C 组 `CollectionsListPage.tsx` 2 错（`useCollectionsList` 全仓无定义）→ **collections 作者**
- D 组 `LoginForm.tsx` 1 错 + §4 的 LoginPage 2 错 → 同属 MFA 语义组

## 6. 当次验证输出（全量）

```
cd shared && ./node_modules/.bin/tsc -p . --noEmit                ⇒ EXIT=0（include:["src"]，真编译）
cd host   && ./node_modules/.bin/tsc -p tsconfig.app.json --noEmit ⇒ 22 → 10（见 §3）
cd host   && node --import ./tests/register-aliases.mjs --test tests/*.test.ts
                                                                   ⇒ tests 397 / pass 397 / fail 0（EXIT=0）
node scripts/check-frontend-component-size.mjs                     ⇒ EXIT=0
node scripts/check-contract-mappers.mjs                            ⇒ EXIT=0
```
（注：本分支 397 例 = main 基线例数；`w/w2/fe-log-archive` 因含我 4 例归档对拍为 401。）

## 7. codegraph / 取证记录

- 重复块**完备性**：脚本对四组做 `block(a,b) == block(c,d)` 比对 ⇒ 全 `True`（逐字节相同，删除语义保持）；
  去重后复查各标记出现次数 = **1**（`AuthResponse` import / `MfaVerifyPanel` import / `mfaChallenge` / `handleAuthResponse` / JSX 分支）。
- 方向性核对（吸取我前次误判教训）：`git merge-base --is-ancestor` + `rev-list --count` 确认本分支
  **领先 main 1 提交、无落后**；补丁 `git apply --check` EXIT=0。
- 合并安全：`git merge-tree --write-tree <在途 FE 分支> HEAD` ⇒ 与 `fe-points-checkin` /
  `fe-visibility-governance` / `fe-continue-watching` / `fe-notification-prefs` / `fe-storage-footprint`
  **全部零冲突**。

## 8. ponytail

- **只删不加**：净 −19/+1 行；无新抽象、无新依赖、无 `#[allow]`/`@ts-ignore` 之类抑制手段。
- **跳过**：未做 B/C/D 与 LoginPage 余 2 条（属语义决定，须作者；硬修会替人定 API 行为）。
- 未改闸基线、未动契约仓、未碰 `useCollectionsList.ts`（其 dupes 红归 collections 卡）。
- `ponytail:` 天花板注明——本卡只清「构建链第一层」，第二层（B/C）须实现卡；已在 §5 写清升级路径。

## 9. 合并提示

本卡文件（`LoginPage.tsx` / `Pan115DirectoryBrowserSection.tsx`）与在途 FE 分支零冲突（§7 实测）；
建议与 §5 的 B/C 实现卡**一起**合，以便一次性让 `tsc`/`vite build`/体积闸恢复可判定。

---

# 附录：本卡**范围扩展**（第二提交）—— 完成 `AuthResponse` 收窄余项（含一处真实功能缺陷）

## A1. 为什么扩展

§4 原本把「LoginPage 余 2 条语义错」判为「须 MFA 作者定夺」。立案后我做了两件取证，结论改变：

1. **核类型定义**：`shared/src/contracts/auth/api.ts`
   ```ts
   export type AuthResponse = AuthLoginSuccess | AuthLoginMfaRequired;
   export interface AuthLoginSuccess     { status: 'ok';           user: User; }
   export interface AuthLoginMfaRequired { status: 'mfa_required'; challengeId: string; expiresAt: number | null; }
   ```
   `challengeId` 是**非空 `string`** ⇒ `LoginPage.tsx` 守卫里的 `&& response.challengeId` **冗余**。
2. **核消费方**：`LoginForm` 的唯一消费方就是 `LoginPage.tsx:290`
   `<LoginForm onAuthenticated={handleAuthResponse} />`（`handleAuthResponse` 的形参就是 `AuthResponse`）
   ⇒ `LoginFormProps.onAuthenticated: (user: User) => void` 的旧签名**与调用点不符**（即 `LoginPage:290` 那条 TS2322）。

## A2. ★过程中发现的**真实功能缺陷（非纯类型债）**

`LoginForm.tsx` 的 `onSuccess` 原来写的是：
```ts
onSuccess: (response) => { onAuthenticated(response.user); }   // response: AuthResponse（联合）
```
当用户是二因子账号时，后端返回 `{status:'mfa_required', challengeId, expiresAt}`——
该变体**没有 `user` 字段** ⇒ 传上去的是 `undefined` ⇒ `LoginPage.handleAuthResponse(undefined)`
会先读 `response.status` ⇒ **TypeError**。
⇒ **经登录表单走二因子登录在 main 上是走不通的**（MFA 功能的缺失环节），本附录一并修好。

## A3. 改动（2 文件）

| 文件 | 改动 |
|---|---|
| `host/src/pages/login/LoginPage.tsx` | 守卫 `status === 'mfa_required' && response.challengeId` → `status === 'mfa_required'`（去掉冗余项；判别式单独收窄后 else 分支即 `AuthLoginSuccess`） |
| `host/src/pages/login/forms/LoginForm.tsx` | prop 类型 `(user: User) => void` → `(response: AuthResponse) => void`；`onAuthenticated(response.user)` → `onAuthenticated(response)`；删因此变为未用的 `User` import |

**设计归属说明**：这不是我改的 API 语义 —— `LoginPage` 早已负责分流（`ok`→建会话 / `mfa_required`→二因子面板），
本改动只是让 `LoginForm` **按既有调用点与既有联合类型**把整份响应转发上去。

## A4. RED → GREEN（当次原文）

```
RED  （本分支 A+E 态，未加本附录改动）
  cd host && tsc -p tsconfig.app.json --noEmit  ⇒ EXIT=1，**10 错**
    5 MfaVerifyPanel.tsx / 2 CollectionsListPage.tsx / 2 LoginPage.tsx / 1 LoginForm.tsx

GREEN（同一命令）
  ⇒ EXIT=2，**10 → 7 错**；**登录组 3 条（LoginPage×2 + LoginForm×1）清零** ✅
    余 7：MfaVerifyPanel 5（可空性，仍属该面板作者）+ CollectionsListPage 2（由 C 卡 `w/w2/fe-collections-vm` 清零）
```

## A5. 当次回归验证

```
cd shared && tsc -p . --noEmit                        ⇒ EXIT=0
cd host   && node --test tests/*.test.ts              ⇒ tests 397 / pass 397 / fail 0
check-frontend-component-size.mjs                     ⇒ EXIT=0
check-contract-mappers.mjs                            ⇒ EXIT=0
check-frontend-dupes.mjs                              ⇒ EXIT=1 —— **仍是 main 既有那条**
   （`[queryKeys Factory] shared/src/viewmodels/useCollectionsList.ts:14`），非本附录引入；
   该条由我的 C 卡 `w/w2/fe-collections-vm`（recover fe2 的 hook）清零。
```

## A6. 边界与风险（如实登记）

- **行为变化 1 处（有意的修正）**：`status === 'mfa_required'` 且 `challengeId === ''`（退化值）时，
  旧码会掉进 `handleAuthenticated(undefined)`（崩溃）；新码进二因子面板。
  按 `challengeId: string` 的契约，后者才是正确语义。
- **未做**：`MfaVerifyPanel.tsx` 的 5 条可空性（属该面板自身处理，仍归其作者）；
  `CollectionsListPage` 2 条（C 卡负责）。
- `ponytail:` 未引入任何新抽象/依赖/抑制手段；两文件共 +14/−5。

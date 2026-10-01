# LICENSE-UX-V1-PARITY 交付说明（FE 写手 W4）

**仓库**：`/root/.paseo/worktrees/1e9ww33s/license-ux-v1-parity`　**分支**：`w/fe/license-ux-v1-parity`
**卡**：`/root/fmby-orchestra/cards/LICENSE-UX-V1-PARITY.md`
**提交**：`9824f01`（本 handoff 为同分支后续 docs 提交）

---

## 0. 结论先行（卡面 premise 已过期，不做重复实现）

卡面写「当前已知主前端只有 `ManageLicensePage`/陈旧 `LicenseUnwiredPanel`」——**不成立**。
V2 `origin/main`（本 worktree 基线 `1cfab4b`）已含 W5-G 三提交，且 `LicenseUnwiredPanel` 已删除：

```
$ git merge-base --is-ancestor 2419d20 HEAD && echo "W5-G IS ancestor of HEAD"
W5-G IS ancestor of HEAD
$ git log --oneline -4 -- shared/src/contracts/manage/license host/src/pages/manage/license
2419d20 feat(license): 付费守卫照 V1 对位 + 真 visibility 判定（W5-G 卡④/commit3）
a0a5a03 feat(license): 授权页照 V1 拆组件 + 真端点接线（W5-G 卡②/commit2）
062b1a7 feat(license): 授权契约+域层照 V1 对齐（W5-G 卡①/commit1）
```

因此本卡**不重造**管理面，只按 codegraph + V1 实证补真实残余，并登记未覆盖项。

---

## 1. codegraph 查证记录（V1 = `/data/projects/fmby-main/fmby`；V2 = 本 worktree）

| 查询 | V1 | V2（卡尖） | 判定 |
|---|---|---|---|
| `codegraph query "ManageLicense"` | `pages/manage/license/ManageLicensePage.tsx` | `host/src/pages/manage/ManageLicensePage.tsx`（5 卡 + 3 hook） | 组件/端点面已并入 |
| `codegraph query "license"` → route | — | `route license @ host/src/app/router/index.tsx:497`（`/manage/site/license`，父级 `CapabilityGuard required="manage:access"` + `AuthGuard`） | 验收①满足 |
| `codegraph query "PaidFeature"` | `ManagePaidFeatureGuard` + `canUsePaidFeature` | 同名，`licenseAccess.ts`（Vite-free） | 守卫已并入 |
| `codegraph callers "ManagePaidFeatureGuard"` | 3 处：`ManageRegistrationCodesPage` / `ManageUpstreamsPage` / `Pan115ImghostPage` | 3 处，同名同范围 | 已对齐 |
| `codegraph callers "canUsePaidFeature"` | **10 处** | **3 处**（Guard/featureFlags/test） | **差 4 处字段级付费门** |

4 处字段级门（V1 `canUsePaidFeature(...)`）在 V2 的对应底层功能已缺失或另立页，故**非本卡 license 页范围**：

- V1 `ManageUsersPage:48`（`user-expiration`/`upstream-emby`）→ V2 `users/**` 无 expiration/emby 字段面；
- V1 `ManageSiteSettingsPage:90` + `SiteSettingsRegistrationSection:16` + `SiteSettingsSecuritySection:18`
  （`registration-window`/`identity-google`/`identity-telegram`）→ V2 `site-settings/**` 无这些字段，
  V2 已将登录提供方另立 `host/src/pages/manage/auth-providers/AuthProvidersSection.tsx`。

→ 登记后续卡（见 §5），本卡不顺手改 users/site-settings。

---

## 2. ponytail 段（跳过了什么 / 何时再加）

- 跳过：不重造 W5-G 已并入的契约/域层/5 卡 UI；不新增依赖；不改契约仓/后端。
- 只抽 1 条纯判定 `isDeviceFlowExpired`（≈5 行）。**未**抽 phase 机、**未**改 API wire、**未**动
  `mapStatus`。需要 denied 与超时分别细化呈现时，再考虑抽 phase。
- DeviceFlowCard 超时态用**一次性定时器**（到期 +1s 刷新 `now`），而非引入 interval/状态机——
  `// ponytail:` 注释已标注：到期没有别的渲染触发点。
- 4 处字段级付费门跳过，触发条件=补回 V2 对应用户到期/注册窗口/身份提供方 UI（属独立功能卡）。

## 3. RED → GREEN 原文

**RED**（新增 `host/tests/license-ux-states.test.ts` 后首跑，③ 因 `deviceFlow.ts` 不存在而失败）：

```
$ node --import ./tests/register-aliases.mjs --test tests/license-ux-states.test.ts
✔ ① 未激活：status 映射 + 六态标签可区分（未激活/过期/宽限）
✔ ② 权益不足：limit 用量达上限 → exhausted + user_limit.exceeded 透出
✖ ③ 设备授权轮询：成功 authorized / 失败 denied / 超时（flow 到期未授权）
✔ ④ activation token 错误：后端 4xx 必须 reject 且保留真实 message
✔ ⑤ 秘密字段不回显：token 只进请求体，不进 URL / Storage / 状态映射
ℹ tests 5  ℹ pass 4  ℹ fail 1

✖ ③ ... Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../host/src/pages/manage/license/deviceFlow.ts/index.ts'
```

**GREEN**（实现 `deviceFlow.ts` + 接线后）：

```
$ node --import ./tests/register-aliases.mjs --test tests/license-ux-states.test.ts tests/license-guard.test.ts tests/license.contract.test.ts
✔ ① 未激活 ...✔ ② 权益不足 ...✔ ③ 设备授权轮询 ...✔ ④ activation token 错误 ...✔ ⑤ 秘密字段不回显 ...
ℹ tests 14  ℹ pass 14  ℹ fail 0
```

> 诚实标注：①/②/④/⑤ 是既有行为的**characterization 回归**（非新逻辑，落盘即过）；
> 仅 ③ 的超时判定为本卡新增行为的真 RED→GREEN。

---

## 4. 当次验证原文（本机，worktree `license-ux-v1-parity`）

```
$ tsc -p host/tsconfig.app.json --noEmit ; echo TSC_EXIT=$?
TSC_EXIT=0
$ tsc -p shared --noEmit ; echo SHARED_TSC_EXIT=$?
SHARED_TSC_EXIT=0

$ cd host && node --import ./tests/register-aliases.mjs --test tests/*.test.ts
ℹ tests 325  ℹ pass 325  ℹ fail 0
$ cd shared && node --import ./tests/register-resolver.mjs --test tests/*.test.ts
ℹ tests 101  ℹ pass 101  ℹ fail 0

$ node scripts/check-frontend-component-size.mjs  → [PASS] 0 违规
$ node scripts/check-contract-mappers.mjs         → [PASS] 0 contract violations
$ node scripts/check-frontend-dupes.mjs           → [PASS] 0 violations
```

未执行：`pnpm verify` / vite build / e2e —— 本机 4 核，`fmby-queue` 拒绝本机重活
（`test/testc/clippy/build`，原文：`✗ fmby-queue 拒绝：这是重活`）。build/e2e 交由农场 `check/build` 跑。
tsc 用兄弟 worktree 的 node_modules（`.codegraph`/`node_modules` 均 gitignore，验证后已移除，工作区干净）。

---

## 5. 未覆盖项 / 后续卡（不假装完整 V1 对齐）

1. **4 处 V1 字段级付费门未接**（见 §1）：需先补 V2 底层功能再接线，独立卡。
   触发条件：补回用户到期/上游 Emby 导入/注册窗口/身份提供方字段面。
2. **已覆盖对照（逐项）**：端点 5/5（status、device-flow、device-flow/poll、activation-token、heartbeat）；
   组件 5/5（StatusOverview/DeviceFlow/ActivationToken/Lease/Entitlements）；状态 runtime 6/6、
   realtime 6/6、poll 4/4；守卫 3/3 页面级接线 + 本轮新增 device-flow 超时态。
3. 本卡**未**改 shared 契约（`shared/src/contracts/auth/license*` 在 V2 不存在，卡面该项 N/A）。

## 6. 提交与工作区

```
$ git log --oneline -1
9824f01 feat(license): 设备流轮询超时态 + 授权链路状态/秘密 RED 覆盖（LICENSE-UX-V1-PARITY）
$ git status --short
（空）
```

后一提交：本 handoff 文档。尾注 `Reviewed-by: pending-non-author-review`（不代表主代理已评审）。

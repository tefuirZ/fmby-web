# FE-MOUNT-AGGREGATE 交付说明（FE 写手 W4）

**仓库**：`/root/.paseo/worktrees/1e9ww33s/fe-mount-aggregate`（workspace `wks_f9fef8e390e5ef80`）
**分支**：`w/fe/mount-aggregate`（自 `1cfab4b`）　**卡**：`/root/fmby-orchestra/cards/FE-MOUNT-AGGREGATE.md`
**提交**：`505eeb6`（本 handoff 为同分支后续 docs 提交）

---

## 1. codegraph callers 图

`codegraph node -f host/src/pages/manage/mounts/formUtils.ts --symbols-only`：**55 symbols，used by 21 files**。
由「文件依赖者 + import 说明符字面量补齐」得到完整 importer → 导入符号映射：

| importer（相对 formUtils 的路径） | 导入符号 |
|---|---|
| `host/src/pages/manage/ManageMountsPage.tsx` (`./mounts/formUtils`) | 多项 |
| `mounts/hooks/useMountMutations.ts` (`../formUtils`) | buildUpdateMountPayload |
| `mounts/hooks/useMountValidation.ts` (`../formUtils`) | getMountStatusLabel, isStructuredRemoteProvider |
| `mounts/components/MountDirectoryBrowserCard.tsx` | 多项 |
| `mounts/components/MountTable.tsx` | 多项 |
| `mounts/components/MountCredentialGuidance.tsx` | resolveCredentialGuidance |
| `MountDrawer/MountDrawer.tsx` (`../../formUtils`) | 多项 |
| `MountDrawer/hooks/useMountDrawerHandlers.ts` (`../../../formUtils`) | 多项 |
| `MountDrawer/sections/MountOverviewSection.tsx` | 多项 |
| `MountDrawer/sections/AuthModeSection.tsx` | 多项 |
| `MountDrawer/sections/WebDavS3ConnectionSection.tsx` | 多项 |
| `MountDrawer/sections/Pan115CredentialsSection.tsx` | PAN115_CREDENTIAL_HINT |
| `MountDrawer/sections/Pan115DirectoryBrowserSection.tsx` | PAN115_CREDENTIAL_HINT |
| `MountDrawer/sections/MountConnectionConfigSection.tsx` | maskSensitiveConfig |
| `MountDrawer/sections/MountReferencesSection.tsx` | formatMountReferenceSummary |
| `MountDrawer/sections/MountDeletePanel.tsx` | formatMountReferenceSummary, hasHiddenMountReferences |
| `MountDrawer/sections/MountViewWarningBanners.tsx` | isStructuredRemoteProvider, hasHiddenMountReferences |
| `MountDrawer/sections/MountProviderFields.tsx` | isStructuredRemoteProvider |
| `MountDrawer/sections/MountLinkedSourcesSection.tsx` | getMountStatusLabel |
| `MountDrawer/sections/BasicInfoSection.tsx` | getProviderHint, getRootPathPlaceholder, getRootPathReadonlyHint |
| `host/tests/mount-datasource-backfill.test.ts` | buildMountFormState, buildUpdateMountPayload, resolveCredentialGuidance, describeSecretValue, createEmptyMountForm |

全部经 `formUtils.ts` 桶路径导入 → 保桶即保兼容（导入路径零改动）。

---

## 2. 改动清单（纯结构拆分）

`host/src/pages/manage/mounts/formUtils.ts`（870 行）→ 桶（19 行，`export *`）+ 6 子模块：

| 子模块 | 行数 | 职责 | 依赖 |
|---|---|---|---|
| `providerCapabilities.ts` | 145 | provider 分类 / 能力默认值 / provider-keyed 文案 | leaf |
| `rootPath.ts` | 59 | 根路径归一 + 路径穿越防线 | providerCapabilities |
| `mountConfig.ts` | 228 | config_json / 密封凭据映射 + 文本 JSON 解析 | providerCapabilities |
| `mountFormState.ts` | 135 | 表单初始化/回填 + Create/Update payload | providerCapabilities, rootPath, mountConfig |
| `mountValidation.ts` | 195 | 表单/目录浏览校验 + 鉴权方式切换影响 | providerCapabilities, rootPath, mountConfig |
| `mountPresentation.ts` | 180 | 健康/抽屉文案、引用/删除摘要、遮蔽、凭据引导 | leaf |

新增测试：`host/tests/mount-formutils-exports.test.ts`（桶导出面 51 项 + 无 default + 4 组关键纯函数行为）。
新增/变更：`docs/plans/v2-dev/evidence/fe-component-size-baseline.json`（回收 `mounts/formUtils.ts` 棘轮条目，只减不增）。

未改：任何函数体逻辑、导出名、UI 文案、API 契约、依赖；`mounts/formUtils.ts` 私有 helper（`REMOTE_CONFIG_KNOWN_KEYS` / `normalizeMountRootPath` / `collectSealedRefInputErrors`）仍在原职责模块内保持私有。

---

## 3. ponytail（跳过什么 / 何时再加）

- 跳过：不新增抽象层/基类/工厂；不做「按函数一文件」的机械碎片化（6 个职责模块是上限）。
- 唯一净新增公共导出：`parseConfigJson`（原为私有，被 `mountFormState` 与 `mountValidation` 共用而必须模块间可见）。
  这与「公共导出无删除/改名」不冲突（只增）。若坚持零新增，可在后续把「JSON 文本是否合法」抽成不导出的共享模块——当前无收益，不做。
- 跳过 themes/后端/契约仓；未顺手改任何业务行为。
- 何时再加：若 `mountConfig`（228）或 `mountValidation`（195）继续增长逼近 400，再按端点/子域二次拆分。

## 4. 基线 → GREEN（当次原文）

**基线（拆分前）**

```
$ tsc -p host/tsconfig.app.json --noEmit   → HOST_EXIT=0
$ node --import ./tests/register-aliases.mjs --test tests/mount-*.test.ts
ℹ tests 45  ℹ pass 45  ℹ fail 0
$ node --import ./tests/register-aliases.mjs --test tests/mount-formutils-exports.test.ts
ℹ tests 5  ℹ pass 5  ℹ fail 0          # characterization 先建，拆前即绿
$ node scripts/check-frontend-component-size.mjs
[WARN(>500)] host/src/pages/manage/mounts/formUtils.ts: 870 行（870 → 870）  [PASS]
```

**GREEN（拆分后）**

```
$ tsc -p host/tsconfig.app.json --noEmit       → HOST_EXIT=0
$ tsc -p shared --noEmit                        → SHARED_TSC_EXIT=0
$ cd host && node --import ./tests/register-aliases.mjs --test tests/*.test.ts
ℹ tests 325  ℹ pass 325  ℹ fail 0
$ cd shared && node --import ./tests/register-resolver.mjs --test tests/*.test.ts
ℹ tests 101  ℹ pass 101  ℹ fail 0
$ node scripts/check-frontend-component-size.mjs → [PASS] 0 违规（formUtils 已 ≤400，回收基线）
$ node scripts/check-contract-mappers.mjs        → [PASS] 0 contract violations
$ node scripts/check-frontend-dupes.mjs          → [PASS] 0 violations
```

**无环证据**（脚本按相对 import 建图并 DFS，非 grep 找符号）：

```
providerCapabilities -> (leaf)
rootPath -> providerCapabilities
mountConfig -> providerCapabilities
mountFormState -> providerCapabilities, rootPath, mountConfig
mountValidation -> providerCapabilities, rootPath, mountConfig
mountPresentation -> (leaf)
formUtils -> providerCapabilities, rootPath, mountConfig, mountFormState, mountValidation, mountPresentation
no cycles among mounts modules
```

未执行：`pnpm verify` / vite build / e2e —— 本机 4 核被 `fmby-queue` 拒重活，交农场 `check/build`。
tsc/test 用兄弟 worktree 的 node_modules（gitignore，验证后已移除，工作区干净）。

## 5. 提交与工作区

```
$ git log --oneline -1
505eeb6 refactor(mounts): 拆分 formUtils 巨型文件为 6 职责子模块 + 兼容桶（FE-MOUNT-AGGREGATE）
$ git status --short
（空）
```

尾注 `Reviewed-by: pending-non-author-review`（不代表主代理已评审）。

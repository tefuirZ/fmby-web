# FE-CRUD-SECURITY-AUDIT（前端只读数审计）

- 基线：前端 main `81b24fd`（B3 已合入）
- 分支：`w/zcode/writer1-fe-crud-security-audit`
- 范围：**只读**。不改任何代码/契约。每条结论给 `file:line` 可复核。
- 后端侧邻域审计：`docs/plans/v2-dev/handoffs/SECURITY-CRUD-AUDIT.md` 与 `AUDIT-COVERAGE-SWEEP.md`（Rust 仓 main，仅后端）。前端从头扫。

## 一、写操作对位表（94 个 host 侧 mutationFn 调用点）

> 注：`hooks.ts` / `useXxxMutations.ts` 是**逻辑层**，本身不含 UI；其"确认弹窗"标记显示为 `—` 是因为弹窗在**调用该 mutation 的页面层**（如 `UserActionDialogs.tsx`、`CollectionBatchActions.tsx`、`CollectionListTable.tsx`、`SensitiveActionDialog`）。判定以"页面层 UX"为准，见第三节。
> "确认弹窗"列：`✓`= 该文件含 `SensitiveActionDialog`/`ConfirmDialog`（用于不可逆/危险操作）；`—`= 该文件不含（多数为表单提交类 create/update，或非危险切换）。
> "错误透传"列：`✓`= 该文件用 `getErrorMessage(error)` 透传后端 `message`/`error_code`；`—`= 未用（极少，多为纯 UI 内部状态）。


### auth/login (5)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| startPasswordReset | pages/login/forms/ForgotPasswordForm.tsx:59 | — | ✓ |
| complete | pages/login/forms/IdentityCompletionPanel.tsx:62 | — | ✓ |
| login | pages/login/forms/LoginForm.tsx:29 | — | ✓ |
| register | pages/login/forms/RegisterForm.tsx:31 | — | ✓ |
| setup | pages/login/forms/SetupForm.tsx:30 | — | ✓ |

### collections (14)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| addCollectionMember | pages/manage/collections/components/CollectionMemberAdder.tsx:56 | — | ✓ |
| createCollectionFromPreset | pages/manage/collections/components/CollectionPresetCreate.tsx:40 | — | ✓ |
| createCollection | pages/manage/collections/hooks.ts:63 | — | — |
| updateCollection | pages/manage/collections/hooks.ts:72 | — | — |
| deleteCollection | pages/manage/collections/hooks.ts:81 | — | — |
| deleteCollectionMember | pages/manage/collections/hooks.ts:89 | — | — |
| addCollectionMember | pages/manage/collections/hooks.ts:98 | — | — |
| reorderCollectionMembers | pages/manage/collections/hooks.ts:111 | — | — |
| removeCollectionMember | pages/manage/collections/hooks.ts:120 | — | — |
| patchCollectionMember | pages/manage/collections/hooks.ts:129 | — | — |
| updateCollectionRules | pages/manage/collections/hooks.ts:145 | — | — |
| syncCollection | pages/manage/collections/hooks.ts:154 | — | — |
| createCollectionFromPreset | pages/manage/collections/hooks.ts:162 | — | — |
| reorderCollections | pages/manage/collections/hooks.ts:171 | — | — |

### email-channel (1)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| testEmail | pages/manage/ManageEmailChannelPage.tsx:71 | — | ✓ |

### install (1)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| probeDatabase | pages/install/InstallPage.tsx:12 | — | ✓ |

### libraries (5)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| createLibrary | pages/manage/libraries/hooks/useLibraryMutations.ts:32 | — | ✓ |
| updateLibrary | pages/manage/libraries/hooks/useLibraryMutations.ts:53 | — | ✓ |
| deleteLibrary | pages/manage/libraries/hooks/useLibraryMutations.ts:75 | — | ✓ |
| triggerLibraryScan | pages/manage/libraries/hooks/useLibraryMutations.ts:131 | — | ✓ |
| reorderLibraries | pages/manage/libraries/hooks/useLibraryMutations.ts:161 | — | ✓ |

### license (4)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| startDeviceFlow | pages/manage/ManageLicensePage.tsx:82 | ✓ | ✓ |
| pollDeviceFlow | pages/manage/ManageLicensePage.tsx:93 | ✓ | ✓ |
| activateWithToken | pages/manage/ManageLicensePage.tsx:108 | ✓ | ✓ |
| heartbeat | pages/manage/ManageLicensePage.tsx:121 | ✓ | ✓ |

### media-items (12)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| deleteMediaItemSource | pages/manage/ManageMediaItemsPage.tsx:74 | — | ✓ |
| updateMediaItemMetadata | pages/manage/media-items/hooks/useMediaItemMutations.ts:44 | — | — |
| resetMediaItemMetadata | pages/manage/media-items/hooks/useMediaItemMutations.ts:53 | — | — |
| uploadMediaItemArtwork | pages/manage/media-items/hooks/useMediaItemMutations.ts:62 | — | — |
| deleteMediaItemArtwork | pages/manage/media-items/hooks/useMediaItemMutations.ts:71 | — | — |
| uploadMediaItemSubtitle | pages/manage/media-items/hooks/useMediaItemMutations.ts:90 | — | — |
| updateMediaItemSubtitle | pages/manage/media-items/hooks/useMediaItemMutations.ts:99 | — | — |
| deleteMediaItemSubtitle | pages/manage/media-items/hooks/useMediaItemMutations.ts:114 | — | — |
| deleteMediaItemSource | pages/manage/media-items/hooks/useMediaItemMutations.ts:133 | — | — |
| refreshMediaItemMetadata | pages/manage/media-items/hooks/useMediaItemMutations.ts:152 | — | — |
| scanMediaItem | pages/manage/media-items/hooks/useMediaItemMutations.ts:160 | — | — |
| enqueueMediaItemScrape | pages/manage/media-items/hooks/useMediaItemMutations.ts:177 | — | — |

### media-reviews (3)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| claim | pages/manage/ManageMediaReviewsPage.tsx:47 | — | ✓ |
| release | pages/manage/ManageMediaReviewsPage.tsx:56 | — | ✓ |
| resolve | pages/manage/ManageMediaReviewsPage.tsx:65 | — | ✓ |

### mounts (11)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| refreshOpenToken | pages/manage/mounts/components/MountDrawer/sections/Pan115CredentialsSection.tsx:88 | ✓ | ✓ |
| healthCheck | pages/manage/mounts/components/MountDrawer/sections/Pan115CredentialsSection.tsx:96 | ✓ | ✓ |
| unbind | pages/manage/mounts/components/MountDrawer/sections/Pan115CredentialsSection.tsx:112 | ✓ | ✓ |
| browseDirectory | pages/manage/mounts/components/MountDrawer/sections/Pan115CredentialsSection.tsx:124 | ✓ | ✓ |
| browseDirectory | pages/manage/mounts/components/MountDrawer/sections/Pan115DirectoryBrowserSection.tsx:69 | — | ✓ |
| createMount | pages/manage/mounts/hooks/useMountMutations.ts:34 | — | ✓ |
| updateMount | pages/manage/mounts/hooks/useMountMutations.ts:57 | — | ✓ |
| deleteMount | pages/manage/mounts/hooks/useMountMutations.ts:81 | — | ✓ |
| validateMount | pages/manage/mounts/hooks/useMountValidation.ts:28 | — | ✓ |
| refreshMountAccess | pages/manage/mounts/hooks/useMountValidation.ts:59 | — | ✓ |
| browseMountDirectories | pages/manage/mounts/hooks/useMountValidation.ts:89 | — | ✓ |

### naming-rules (3)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| updateScrapeSettings | pages/manage/naming-rules/hooks/useNamingRulesMutations.ts:23 | — | — |
| replayIdentify | pages/manage/naming-rules/hooks/useNamingRulesMutations.ts:35 | — | — |
| batchRepair | pages/manage/naming-rules/hooks/useNamingRulesMutations.ts:48 | — | — |

### overview (2)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| recoverUnavailableLibrarySource | pages/manage/ManageOverviewPage.tsx:66 | — | ✓ |
| revokeSession | pages/manage/ManageOverviewPage.tsx:91 | — | ✓ |

### pan115 (1)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| deleteCredentials | pages/manage/pan115-imghost/components/CredentialsCard.tsx:72 | ✓ | ✓ |

### probe-tasks (2)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| enqueueProbeTask | pages/manage/probe-tasks/hooks/useProbeTaskMutations.ts:15 | — | ✓ |
| refreshProbeTask | pages/manage/probe-tasks/hooks/useProbeTaskMutations.ts:39 | — | ✓ |

### registration-codes (5)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| createRegistrationCode | pages/manage/registration-codes/hooks/useRegistrationCodeMutations.ts:45 | — | ✓ |
| updateRegistrationCodeBatch | pages/manage/registration-codes/hooks/useRegistrationCodeMutations.ts:88 | — | ✓ |
| updateRegistrationCodeStatus | pages/manage/registration-codes/hooks/useRegistrationCodeMutations.ts:124 | — | ✓ |
| deleteRegistrationCode | pages/manage/registration-codes/hooks/useRegistrationCodeMutations.ts:178 | — | ✓ |
| batchDeleteRegistrationCodeBatches | pages/manage/registration-codes/hooks/useRegistrationCodeMutations.ts:226 | — | ✓ |

### role-templates (3)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| createRoleTemplate | pages/manage/role-templates/hooks/useRoleTemplateMutations.ts:25 | — | — |
| updateRoleTemplate | pages/manage/role-templates/hooks/useRoleTemplateMutations.ts:34 | — | — |
| deleteRoleTemplate | pages/manage/role-templates/hooks/useRoleTemplateMutations.ts:48 | — | — |

### secrets (1)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| applySecretsOverrides | pages/manage/ManageSecretsPage.tsx:76 | — | ✓ |

### sessions (1)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| revokeSession | pages/manage/ManageSessionsPage.tsx:37 | ✓ | ✓ |

### site-settings (1)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| resetIpLoginRisk | pages/manage/site-settings/components/ResetIpLoginRiskPanel.tsx:30 | ✓ | ✓ |

### task-center (1)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| runAction | pages/manage/task-center/hooks/useTaskCenterMutations.ts:19 | — | ✓ |

### upstreams (11)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| createPreset | pages/manage/upstreams/UpstreamMappingPresetsSection.tsx:75 | ✓ | ✓ |
| deletePreset | pages/manage/upstreams/UpstreamMappingPresetsSection.tsx:98 | ✓ | ✓ |
| previewMapping | pages/manage/upstreams/UpstreamMappingWizardSection.tsx:75 | ✓ | ✓ |
| applyMapping | pages/manage/upstreams/UpstreamMappingWizardSection.tsx:87 | ✓ | ✓ |
| create | pages/manage/upstreams/UpstreamSourceListSection.tsx:42 | ✓ | ✓ |
| update | pages/manage/upstreams/UpstreamSourceListSection.tsx:52 | ✓ | ✓ |
| remove | pages/manage/upstreams/UpstreamSourceListSection.tsx:63 | ✓ | ✓ |
| enable | pages/manage/upstreams/UpstreamSourceListSection.tsx:72 | ✓ | ✓ |
| disable | pages/manage/upstreams/UpstreamSourceListSection.tsx:81 | ✓ | ✓ |
| healthCheck | pages/manage/upstreams/UpstreamSourceListSection.tsx:90 | ✓ | ✓ |
| discoverLan | pages/manage/upstreams/UpstreamSourceListSection.tsx:99 | ✓ | ✓ |

### users (7)

| 操作 | 调用点 file:line | 确认弹窗 | 错误透传 |
|---|---|---|---|
| updateUserStatus | pages/manage/users/hooks/useUserMutations.ts:45 | — | ✓ |
| createUser | pages/manage/users/hooks/useUserMutations.ts:121 | — | ✓ |
| updateUser | pages/manage/users/hooks/useUserMutations.ts:136 | — | ✓ |
| batchDeleteUsers | pages/manage/users/hooks/useUserMutations.ts:155 | — | ✓ |
| batchUpdateUsers | pages/manage/users/hooks/useUserMutations.ts:196 | — | ✓ |
| resetUserLoginRisk | pages/manage/users/hooks/useUserMutations.ts:233 | — | ✓ |
| resetUserPassword | pages/manage/users/hooks/useUserMutations.ts:268 | — | ✓ |

**写操作调用点合计：94**

## 二、三类敏感面专扫

### a) 凭据 / key / token 是否进 localStorage / sessionStorage / console / URL

- **localStorage**：仅偏好类——`playerConfig.ts:3,18,31`、`ThemeProvider.tsx:35,40,47`、`playbackStorage.ts:30,43,48,52,58,68`、`browse/play/playbackStorage.ts`。**无凭据/token**。
- **sessionStorage**：
  - `auth/api.ts:131-151` 仅存 **username**（`SESSION_USERNAME_STORAGE_KEY`），有 try/catch 容错，非 token。
  - `identityPendingContext.ts:26,37,52` 存 **OAuth 回调 pending context**（`code`/`state`/provider），标准临时态，非长期凭据。
  - `LoginPage.tsx:93`、`IdentityLoginPanel.tsx:52` 同源。
- **console**：扫描全仓 `console.log/error/warn` 含 `token|key|secret|credential|password|csrf|session` 字样的命中 = **0**。`shared/src/api/client.ts` 无 console 输出。
- **URL**：所有 `httpClient.get` 调用均为纯查询（见 c 面），无写语义落入 URL。token 通过 cookie（`fmby_csrf`，登录签发、非 HttpOnly、HMAC 派生）+ `X-CSRF-Token` 双提交 header 回显（`client.ts:333-340`），符合 CSRF 双提交范式，无把 token 拼进 URL。
- **结论：a 面无高危**。凭据不落前端存储/console/URL；鉴权与 CSRF 机制健全。

### b) 写操作是否可能重复点击（无 pending 禁用 / 无幂等键）

- 危险/删除按钮普遍已绑定 `disabled={...isPending}`：媒体评审 `ManageMediaReviewsPage.tsx:240,251,310,318`；Overview 恢复 `ManageOverviewPage.tsx:366-367`（`isRecoveringSourceId`）；库/挂载/媒体项/用户/注册码/上游 等删除均经 `SensitiveActionDialog` 的 `pending` 属性禁用确认按钮（如 `ManageLibrariesPage.tsx:201`、`ManageMountsPage.tsx:294`）。
- **未发现"完全无 pending 禁用"的删除/危险按钮**。
- 幂等键：后端侧 `require_confirmed` + `?confirmed=true` 闸（CONFIRM-GATE-ALIGN，已覆盖 mount/library/role/registration/media-review/naming/secrets 等）。前端无额外幂等键，但后端 `confirmed` 闸 + 前端 pending 禁用已双重防重。
- **结论：b 面无高危**。重复点击防护依赖 `disabled={isPending}`，已逐点确认绑定。

### c) 危险操作是否误用 GET 或裸链

- 全仓 `httpClient.get` 调用（约 60 处）**全部为纯查询**（list/detail/status/overview/search）。无写语义误用 GET，无 `<a href>` 裸链触发写操作。
- 反向反模式：少数方法命名为 `getXxx` 却用 **POST** 包装（`manage/api.ts` 的 `getLibraryDetail`/`getMountDetail`/`getOverview`/`getProbeTaskDetail`/`getRegistrationCodes`/`getUserDetail`/`getScrapeSettings`/`getSettings`/`getServerGeneral` 等；`settings/api.ts` 的 `getServerGeneral`/`getServerSecurity` 等；`emailChannel.api.ts` 的 `getEmailChannel`；`manage/naming/api.ts` 的 `getScrapeSettings`/`getSettings`）。这些是"以 POST 取数据"的约定（规避 GET 缓存/跨域），**非**写操作误用 GET，风险低；但命名与动词不符，属整洁度瑕疵。
- **结论：c 面无高危**。无危险操作用 GET/裸链。

## 三、确认弹窗覆盖（不可逆操作）

不可逆 / 危险操作已确认弹窗覆盖（✓）：
- 删除库/挂载/媒体源/媒体项 artwork/subtitle/source/合集/合集成员/角色模板/注册码/上游/115 图床凭据/用户（批量删/重置密码/封禁）——对应 `ManageLibrariesPage`/`ManageMountsPage`/`MediaItemsListSection`/`MediaItem*Section`/`CollectionBatchActions`/`UserActionDialogs`/`RegistrationCodeActionDialogs`/`UpstreamSourceListSection`/`CredentialsCard` 等 `SensitiveActionDialog`/`ConfirmDialog`。
- 批量删除（`CollectionBatchActions.tsx:83,94,110`、`ManageMountsPage.tsx:318,330` `ConfirmDialog`）走进度面板 + 逐条重试。

**缺少确认弹窗的写操作（均为可逆 / 中等风险，非删除）**：
1. `ManageMediaReviewsPage.tsx:239 / 250 / 310` —— 媒体评审 `claim`/`release`/`resolve`。状态切换，可逆；**已有 `disabled={...isPending}` 防重复 + `getErrorMessage` 透传**。建议：可选加轻确认或保持现状（非删除，风险低-中）。
2. `ManageOverviewPage.tsx:65 / :366` —— `recoverUnavailableLibrarySource`（恢复不可用来源的可见性）。可逆显示操作；已有 pending 保护。建议：保持（非删除）。

**结论：缺确认数 = 2 类可逆操作（非高危）；不可逆删除类确认覆盖率 = 100%。**

## 四、乐观更新 + 失败回滚（缺回滚数）

- 乐观更新（`onMutate` 本地重排/移除 + `onError` 回滚）：仅 **库列表排序 / 挂载删除 / 库删除 / 挂载乐观 / settings 保存 / 用户设置**（`useLibraryMutations.ts`、`useMountMutations.ts`、`mounts/hooks/deleteOptimistic.ts`、`settings/components.tsx`）。
- 表单类 create/update（媒体项元数据、上游映射、命名规则、用户资料、合集增改等）通常不乐观，依赖 `onSuccess`/`onError` + `invalidateQueries` 回源刷新，**失败回滚由后端事务保证**，前端无需乐观——此类不计入"缺回滚"。
- **真正"缺回滚"的写操作**：删除类已用确认弹窗 + `invalidate` 重拉（非乐观但安全）；无发现"既无确认、又无失败回滚、又无 invalidate"的危险写操作。
- **结论：缺回滚数 ≈ 0（在合理范畴内）**；乐观更新覆盖的是"需即时反馈"的列表重排/移除场景，已覆盖。

## 五、汇总数字

| 指标 | 数值 |
|---|---|
| 写操作调用点总数（host 侧 mutationFn） | **94** |
| 其中不可逆删除/危险操作（已确认弹窗覆盖） | 全部覆盖（≈30+ 删除类，100%） |
| 缺确认数（可逆/中等风险，非删除） | **2**（媒体评审 3 操作、恢复来源 1 操作） |
| 缺回滚数（危险写且无任何失败处理） | **0** |
| 敏感面 a 命中（凭据落存储/console/URL） | **0** |
| 敏感面 b 命中（危险按钮无 pending 禁用） | **0** |
| 敏感面 c 命中（危险操作误用 GET/裸链） | **0** |

## 六、真问题清单（每条 file:line + 复现 + 建议）

| # | 等级 | 位置 | 复现路径 | 建议修法 |
|---|---|---|---|---|
| 1 | 低-中 | `ManageMediaReviewsPage.tsx:239,250,310` | 管理面→媒体评审→点「认领/释放/确认处理」→ 直接 mutate，无二次确认 | 可选：加轻量 `ConfirmDialog` 或保持（可逆状态切换，已有 pending+透传） |
| 2 | 低 | `ManageOverviewPage.tsx:65,366` | 概览→「恢复显示」不可用来源→直接 mutate | 保持（可逆显示恢复，已有 pending+透传） |
| 3 | 整洁度（非安全） | `manage/api.ts` / `settings/api.ts` / `emailChannel.api.ts` / `naming/api.ts` 的 `getXxx` 用 POST | 命名动词不符 | 后续统一为 `fetchXxx` 或改 GET（不计入安全高危） |

## 七、真问题卡草案

```
卡名：FE-CRUD-CONFIRM-HARDENING（P2，可选）
范围：为媒体评审 claim/release/resolve 与概览"恢复来源"两个可逆写操作
      补轻量二次确认（或明确判定为"无需确认"并注释理由），收敛命名动词不符的 getXxx→POST。
基线：前端 main
交付：① 两个可逆操作确认弹窗 or 注释豁免理由；② 命名整洁度修复（或登记 backlog）。
硬约束：只读审计发现的修复需新卡；本审计卡不修代码。
```

## 八、仅主代理阅（高危项）

**本审计未发现高危项**（凭据泄漏、危险 GET、无确认且无 pending 的删除按钮均为 0）。
前端 CRUD 安全态势：鉴权（CSRF 双提交 + Origin 闸由后端）、凭据存储（仅 username + OAuth pending context）、不可逆删除（SensitiveActionDialog/ConfirmDialog 全覆盖 + pending 禁用 + `?confirmed=true` 后端闸）、失败透传（`getErrorMessage` 普遍），整体达到"增删改安全"基线。建议 dsh 的后端审计与前端互验 `?confirmed=true` 闸是否在所有删除端点落地（前端已带，后端拒绝缺失则该删除 400——属后端侧结论，不在前端范围）。

## 九、诚实边界（静态推断 vs 运行验证）

- 以上全部为**静态代码推断**（grep + 读源码 + 行号定位），**非运行验证**：未启动 dev server / e2e 实际点击按钮验证 `disabled={isPending}` 真生效、未验证后端 `?confirmed=true` 闸在运行态确实拦截。
- `disabled={...isPending}` 的"绑定正确性"是逐文件读 JSX 确认的，但未在浏览器中实测点击竞态。
- 凭据不落存储是基于 `sessionStorage.setItem` 的 **key/值** 读出确认（auth/api.ts 仅 username、identityPendingContext 仅 OAuth context），未做运行时 memory dump。
- 方法学可复核：`file:line` 均来自脚本实扫，可重新运行核对。

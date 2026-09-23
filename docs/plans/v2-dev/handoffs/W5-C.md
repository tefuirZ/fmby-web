# W5-C 交付说明（凭据重绑：通用表单 → 各 provider 专用流）

基线：前端 main（origin/main）
分支：`w/zcode/writer1-w5c-microsoft` @ `bbc4d2d`
判据：`pnpm verify` EXIT=0；host **267 pass / 0 fail**（含新增 8 项）；shared 94 pass；component-size **0 违规**；contracts 0 违规。

## 各 provider 落点（一行：之前 → 现在 → 还差什么）

- **微软**：之前落到通用配置表单（W5-B 回落） → 现在抽屉内挂载 `MicrosoftRebindSection`，复用既有 `microsoftApi.startAuth/completeAuth`，按 `config_json.drive_id` 关联账号发起重绑 → 还差：无（expired 真实可达，后端 `mount_contract_e2e.rs:1317` 已证 `drive_id → microsoft_graph_accounts.expires_at` 派生 expired/bound）。
- **139**：之前落到通用配置表单（W5-B 回落） → 现在**仍只能落通用表单** → 还差：后端两点硬缺口使抽屉内专用重绑不可实现——①`helpers.rs:155` 的 `expires_at` 匹配仅微软分支，139 挂载 `credential_status` 恒 `bound`（expired 不可达）；②挂载 `config_json` 无 profile 关联键（grep `credential_profile_id/profile_id` 命中 0），抽屉不知 reauthorize 哪个档案。档案页 `/manage/media/yun139` 虽有 `reauthorizeCredentialProfile` 端点，但过期项**只显示 reason 文本、无按钮**；补按钮需新建凭据录入 UI（139 仅有新建档案的 qrLogin，无重绑录入组件），违反本卡「不新写一套 UI 体系」红线 → 如实登记为后端+UI 缺口，未伪造。
- **AList**：之前落到通用配置表单（W5-B 回落） → 现在**仍只能落通用表单** → 还差：同 139 的硬缺口（`expires_at` 恒 None ⇒ bound；无 mount→account 关联键；token 密封但无处挂接）。无专用流可做。

## 结论

W5-C 在**后端既有事实**下只能、且已正确完成**微软**这一条专用流。139/AList 的专用重绑被后端 `derive_credential_status` 的 expires_at 硬编码（非微软不取过期源）+ 挂载无 profile 关联键双重阻断，属**真实后端缺口**，不应在前端伪造状态或自造关联键。

若主代理希望补 139/AList 专用流，需要先决卡：
1. 后端给 139/AList 挂载 `config_json` 增加 `credential_profile_id`/`account_id` 关联键；
2. 后端 `derive_credential_status` 对该 provider 取对应账号表 `expires_at`（否则挂载永远 bound，前端无 expired 可挂）；
3. 前端 139/AList 档案页补 reauthorize 按钮（复用/新建凭据录入 UI）。

## 改动清单

- 新增 `host/.../MountDrawer/sections/MicrosoftRebindSection.tsx`（135 行，抽屉内区块，不新写 UI 体系）
- `credentialPresentation.ts`：新增 `readMountDriveId`（只取后端明写的 `drive_id`，不碰 sealed/secret）+ `supportsMicrosoftRebind`（provider×drive_id 矩阵）
- `MountDrawer.tsx`：微软挂载在既有抽屉内挂载该区块（pan115 仍走原 `Pan115CredentialsSection`）
- 成功失效范围沿用 W5-B `useInvalidateCredentialState`（list+detail+health，不多不少）
- 契约测试 `host/tests/w5c-microsoft-rebind.test.ts`（8 项全绿）：入口矩阵 / drive_id 读取（含密封引用不误取）/ 失效范围=W5-B hook
- 静态映射：drive_id 关联、supportsMicrosoftRebind 判定；真跑：8 项单测 + 复用既有 14 个 ms 端点

## 验证

- `MountTable.tsx` 保持 394/400（未触碰，遵守红线）
- `MountDrawer.tsx` 384/400，`MicrosoftRebindSection.tsx` 135/400，均未越线

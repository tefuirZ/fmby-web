# 交接 · FE-LICENSE-REMAINING（前端授权交互残余对齐 · 先证伪）

仓库 `/home/tefuir/rustproject/fmby-web`，分支 `w/fe2/fe-license-remaining`（基于 `origin/main`）。
本卡用 **ponytail**（不造需求、不为不存在的功能造假门）；找符号只用 **codegraph**。

---

## 0. 结论先行（卡面 premise 不成立，无真实可接线缺口）

承接 LICENSE-UX-V1-PARITY §5-1 登记的「4 处字段级付费门」。经逐文件取证：
这 4 处门**无法接线**，因为它们的**底层字段面在 V2 根本不存在**——
不是「有功能但没接付费门」，而是**功能本身未实现**。接线 = 为不存在的功能造假门，
违反「不假实现 / 不造需求」。故本卡**不写生产代码**，仅交付取证结论。

## 1. codegraph / 文件取证记录（V2 = 本 worktree）

| 项 | V1 位置（前卡登记） | V2 现状取证 | 判定 |
|---|---|---|---|
| 用户到期 `user-expiration` | `ManageUsersPage:48` | `host/src/pages/manage/ManageUsersPage.tsx` + `users/components/*`（10 文件）**全无** `expiration` | 功能缺失 |
| 上游 Emby 导入 `upstream-emby` | `ManageUsersPage:48` | 同上 10 文件**全无** `emby` | 功能缺失 |
| 注册窗口 `registration-window` | `ManageSiteSettingsPage:90` / `SiteSettingsRegistrationSection:16` | `site-settings/components/*`（含 Registration/Section）**全无** | 功能缺失 |
| Google / Telegram 身份提供方 | `SiteSettingsSecuritySection:18` | `site-settings/**` 全无 `google`/`telegram`；V2 已另立 `auth-providers/AuthProvidersSection.tsx`（不含该两提供方） | 功能缺失 |

- `canUsePaidFeature`：`host/src/pages/manage/license/licenseAccess.ts:19`（35 行），调用者 3 处
  （`isPaidFeatureEnabled`、`license-guard.test.ts`、`featureFlags.ts`）—— 与前卡「V2 = 3 处」一致，
  V1 为 10 处，差额即上述 4 处（每处多个调用点）。

## 2. 「诚实错误态」面：前卡已覆盖，非缺口

`ManagePaidFeatureGuard.tsx` 现状：
- `statusQuery.isPending` → `FeedbackState variant="loading"`（「正在校验授权」）；
- 查询失败或无数据 → `isPaidFeatureEnabled` 返回 false → **fail-closed 未授权**（照 V1「无 license 载荷 → FREE」语义），
  给出 warning + 「查看授权与订阅」/「返回管理首页」两个入口。

⇒ 卡面要求的诚实错误态**已存在且对位 V1**，无需本卡改动。

## 3. 顺手发现并修复的**工具**缺陷（非生产代码）

- 现象：`codegraph query "canUsePaidFeature"` 初始返回 **No results**，但该符号确实存在于
  `licenseAccess.ts:19` —— **本仓 codegraph 索引陈旧**。
- 影响：AGENTS.md 明确「禁 grep 找代码」的**前提是索引可用**；索引陈旧会让 codegraph-only
  纪律得出错误结论（本次即差点误判「符号不存在」）。
- 处置：执行 `codegraph sync .`（一次性、非生产改动）后符号恢复正常，调用者 3 处可查。
- **建议**：主代理核查本仓 post-commit hook 是否未生效（worktree 的 `.git` 是指针文件时
  hook 常不跑，AGENTS.md 已有同类记载），否则索引会持续陈旧。

## 4. RED → GREEN

本卡**无生产代码改动**，故无传统 RED→GREEN 环；取证本身即「先证伪」环：
- 假设（卡面）：4 处付费门可补齐 + 需补诚实错误态；
- 取证：底层字段面 4/4 缺失、错误态已覆盖 ⇒ 假设不成立 ⇒ 缩减为「结论交付」。

## 5. 当次验证

```
git status --porcelain            → 0（工作树干净，基于 origin/main）
python3 逐文件取证 users/site-settings   → expiration/emby/registration-window/google/telegram 全 False
codegraph query "canUsePaidFeature"      → licenseAccess.ts:19（sync 后）
codegraph callers "canUsePaidFeature"    → 3 处
```

## 6. 跳过项 / 给主代理的建议（不擅自扩大范围）

- **未**为不存在的字段造假付费门、**未**改 `users/**`、`site-settings/**`、`auth-providers/**`
  （那属于**前置功能卡**，不是本卡「接线/对齐」范围）。
- 建议后续按 V1 拆**前置功能卡**（各自独立派卡，本卡不吞）：
  1. 用户到期字段面（`user-expiration`）
  2. 上游 Emby 导入字段面（`upstream-emby`）
  3. 注册窗口（`registration-window`）
  4. Google / Telegram 身份提供方（并入 `auth-providers`）
  以上任一项落地后，再派「接 `canUsePaidFeature` 门」的小卡即可闭合 V1 的 10 处。
- 未跑全仓重活（纪律所限）；本卡零生产代码 ⇒ 无需编译验证。

## 7. 提交

一原子项一提交：本 handoff 文档（docs only）。

`Reviewed-by: pending-non-author-review`

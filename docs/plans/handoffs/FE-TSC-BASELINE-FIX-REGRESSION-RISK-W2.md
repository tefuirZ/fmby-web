# ⚠ P0 风险档：`w/w5/fe-tsc-baseline-fix` 是「靠删功能把 tsc 弄绿」

**发现者**：W2（在做 FE-LOG-ARCHIVE 的 P1 取证时顺带发现）。
**证据级别**：已核验（当次命令 + 原文，见 §3/§4）。
**建议动作**：**合入前先裁决**——按本仓「功能不减」（V1 对等）纪律，该分支形态不可直接合。

## 1. 一句话

该分支把 `tsc -p tsconfig.app.json` 的 **22 错降到 1 错**，代价是
**删除 MFA/TOTP 全链 UI、yun139 owned browse 契约、collections viewmodel、6 个测试文件、6 份 handoff**，
净 **+222 / −2142 行**，且**仍然不是绿的**（剩 1 错）。

## 2. 与「外科修复」的对比（同一份 22 错，两种做法）

| 做法 | 结果 | 代价 |
|---|---|---|
| **本席建议的外科修**（`FE-MAIN-TSC-BREAKAGE-W2.md`） | 去掉 A 组 13 错（重复块，**已实测逐字节相同**）+ E 组 1 错 | **零功能损失**，仅删重复代码与未用变量 |
| **`w/w5/fe-tsc-baseline-fix`** | 22 → **1 错**（仍不绿） | **−2142 行**：删功能 + 删测试 + 删证据 |

## 3. 被删清单（`git diff --numstat origin/main..origin/w/w5/fe-tsc-baseline-fix`）

### 3a. 用户可见功能（**功能回退**）

| 文件 | 删除行 | 丢失的能力 |
|---|---|---|
| `host/src/pages/login/forms/MfaVerifyPanel.tsx` | 123 | **登录二因子验证面板** |
| `host/src/pages/manage/site-settings/components/MfaTotpSection.tsx` | 275 | **自助 MFA/TOTP 管理 UI** |
| `shared/src/contracts/auth/mfa.ts` | 116 | MFA 契约（enroll/verify/reset） |
| `shared/src/contracts/manage/yun139/api.ts` + `types.ts` | 66 + 64 | **yun139 owned browse 契约** |
| `shared/src/viewmodels/useCollectionsList.ts` | 309 | **合集列表 viewmodel**（搜索/分页） |
| `shared/src/errors/pan115Codes.ts` | 26 | pan115 错误码映射 |
| `host/src/pages/login/LoginPage.tsx` | 39 | 去掉 `mfaChallenge` 挂起态与 `MfaVerifyPanel` 分支 ⇒ **MFA 登录流整段消失** |
| `shared/src/ui/common/FeedbackState.tsx` / `InlineBanner.tsx` / `core.ts` | — | 组件/客户端改动 |

### 3b. 测试（**删测试换绿**）

```
host/tests/a11y-static-contract.test.ts          124
host/tests/mfa-totp.contract.test.ts             103
shared/tests/yun139-owned-browse.test.ts         110
host/tests/collections-search.contract.test.ts    78
host/tests/pan115-error-codes.contract.test.ts    48
host/tests/a11y-announcements.test.ts             43
```

### 3c. 证据/交付档（**删记录**）

```
docs/plans/handoffs/FE-YUN139-OWNED-BROWSE-UI.md     94
docs/plans/handoffs/FE-REGISTRATION-WINDOW-UI.md     84
docs/plans/handoffs/FE-A11Y-KEYBOARD-AUDIT.md        74
docs/plans/handoffs/FE-CONTRACT-GAP-SWEEP.md         60
docs/plans/v2-dev/handoffs/FE-CONTRACT-REAUDIT.md    46
docs/plans/v2-dev/handoffs/FE-CONTRACT-REAUDIT2.md   31
```

## 4. 当次验证（该分支仍未绿）

```bash
git worktree add --detach /tmp/w2-fe-w5 origin/w/w5/fe-tsc-baseline-fix
cd /tmp/w2-fe-w5/host && ./node_modules/.bin/tsc -p tsconfig.app.json --noEmit
# ⇒ EXIT=2，错误数 1：
#   ../shared/src/api/client/core.ts(4,1): error TS6192: All imports in import declaration are unused.
```
（对照：`origin/main` 同命令 **EXIT=2 / 22 错**；本席建议的外科修可无损去掉其中 14 条。）

## 5. 建议裁决

1. **不合** `w/w5/fe-tsc-baseline-fix`（形态=删功能换绿，违「功能不减」）；
   若确需「把 main 拉回可构建」，请走**外科修**（去重 + 删未用变量，零功能损失）。
2. MFA / yun139 / collections 那部分（B+C+D 组）**是功能缺口，不是 lint 债** ⇒
   派给对应作者**补实现**，而不是删掉。
3. 该分支删掉的 6 份 handoff/证据属**审计轨迹**，删之会让「哪些功能曾被交付」失忆；
   如需回退某功能，请在 handoff 里**登记回退理由**，而不是连记录一起删。
4. `useCollectionsList.ts` 现状（`origin/main`）本身已损坏：该文件 317 行**只导出 `queryKeys`**，
   而 `CollectionsListPage.tsx` 导入并调用 `useCollectionsList`（**全仓无定义**）⇒
   合集列表页不可构建。这是**真缺口**，需补实现（详见 `FE-MAIN-TSC-BREAKAGE-W2.md` §3 C 组）。

## 6. 附：本次两档的分工

- `FE-MAIN-TSC-BREAKAGE-W2.md`：**main 为何红**（22 错的精确 file:line 与分组修法）。
- 本档：**一个"看起来能修"的分支为何危险**（绿因删空 + 仍未绿）。

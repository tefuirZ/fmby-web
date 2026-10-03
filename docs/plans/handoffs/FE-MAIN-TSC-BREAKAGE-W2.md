# FE-MAIN-TSC-BREAKAGE 修复档（W2 取证，只读诊断，未改任何源码）

**发现者**：W2（做 FE-LOG-ARCHIVE 时顺带取证）。
**性质**：**P1** —— 前端 `origin/main` 当前 **typecheck 不过、`vite build` 失败** ⇒ 前端仓主分支不可构建。
**证据级别**：已核验（干净 `origin/main` 临时 worktree 逐条复算，见 §6）。

## 1. 一行结论

`origin/main` 前端 **`tsc -p tsconfig.app.json --noEmit` = 22 错 / `vite build` 失败**；
根因是 **revert 后再 merge** 留下的重复块与丢失的导出（详见 §3）。

## 2. 复现（权威命令）

```bash
cd <origin/main 的 checkouts>/host
./node_modules/.bin/tsc -p tsconfig.app.json --noEmit     # ⇒ 22 errors（不是 -p .，那是虚绿，见 §5）
./node_modules/.bin/vite build                            # ⇒ ERROR: The symbol "mfaChallenge" has already been declared
```

## 3. 错误清单（精确 file:line，按修法分组）

### A 组 · `host/src/pages/login/LoginPage.tsx` —— **块被整体复制**（13 错，去重即解）

| 位置 | 症状 | 修法 |
|---|---|---|
| `:29` / `:30` | `TS2300 Duplicate identifier 'AuthResponse'` | 删 1 行（两份**逐字节相同**） |
| `:36` / `:37` | `TS2300 Duplicate identifier 'MfaVerifyPanel'` | 删 1 行（同上） |
| `:69` / `:71` | `TS2451 Cannot redeclare 'mfaChallenge'/'setMfaChallenge'` | 删 1 个 `useState`（`:70` 注释保留一份） |
| `:148-155` / `:157-164` | `TS2393 Duplicate function implementation`（`handleAuthResponse`） | 删 1 份（**【已验】两份逐字节相同**） |
| `:294-299` / `:300-305` | JSX 两个相邻 `: mfaChallenge ? (…)` 三元分支 | 删 1 份（**【已验】逐字节相同**） |
| `:154` / `:163` `TS2339 response.user` · `:308` `TS2322 (response) => void` | 去重后 **应自解**（`AuthResponse` 可辨识联合收窄恢复） | 无需单独改 |

**判定依据（已实测）**：上述 4 组重复块**两份完全相同**（脚本比对 `block(a,b) == block(c,d)` 全 `True`）
⇒ 去重是**语义保持**的，不会动 MFA 行为。

**成因（历史形态）**：
```
459c169  feat(mfa): MFA/TOTP 契约 + 登录二因子流        ← MFA 首次合并
4be4a86  Revert "Merge commit '459c169…'"                ← 被 revert
9409c1c  feat(mfa): …（FE-MFA-TOTP-UI）                  ← MFA 重新落地
1cc66f3  mfa: AuthResponse 改可辨识联合 + LoginPage 收窄（返工 2/2）
b092741  Merge commit '1cc66f3…'                         ← revert 侧 × 重新落地侧 合并 ⇒ 两边块共存
```

### B 组 · `host/src/pages/login/forms/MfaVerifyPanel.tsx`（5 错，**非重复，是真语义错**）

| 位置 | 症状 | 备注 |
|---|---|---|
| `:13` | `TS6133 'useQueryClient' is declared but its value is never read` | 删 import |
| `:14` | `TS2305 Module '"@fmby/v2-shared/contracts/auth"' has no exported member 'SESSIO…'` | **导出名不存在**（需核后端/auth 契约真名） |
| `:17` | `TS6133 'useSession' is declared but its value is never read` | 删 import |
| `:47` / `:48` | `TS2322 Type 'string \| null' is not assignable to type 'string' / 'string \| undefined'` | 可空性未收窄 |

⇒ **需 MFA 卡作者**（要判「契约真名是什么 / 该不该用 session」），不能机械改。

### C 组 · `host/src/pages/browse/CollectionsListPage.tsx`（2 错，**功能真缺失**）

| 位置 | 症状 |
|---|---|
| `:5` / `:24` | `TS2305 Module '"@fmby/v2-shared/viewmodels"' has no exported member 'useCollectionsList'` |

**取证（已核验）**：`shared/src/viewmodels/useCollectionsList.ts`（317 行）**只有一个导出 `queryKeys`**
（文件名与内容不符；它其实是 query key factory，正是 `check-frontend-dupes` 报的那条：
"queryKeys definition is only permitted in 'shared/src/query/**'"）；
而 `shared/src/viewmodels/index.ts:22` 写着 `export * from './useCollectionsList'` ——
**该 hook 在整个仓库中不存在**（全仓扫描「定义」0 命中，仅 `CollectionsListPage.tsx` 两处引用/调用）。

⇒ **用户面合集列表页根本无法构建/运行**（属 `b4f38c5` / `30b646c` collections 卡）。需该卡作者补 `useCollectionsList` 实现
（或改为调用既有 viewmodel），并把 `queryKeys` 迁到 `shared/src/query/**` 以消 dupes 红。

### D 组 · `host/src/pages/login/forms/LoginForm.tsx`（1 错）

`:31` `TS2339 Property 'user' does not exist on type 'AuthResponse'` —— 同 A 组，属 `AuthResponse`
改可辨识联合后的**调用点未同步**（需与 B 组一起由 MFA 作者收口）。

### E 组 · `.../MountDrawer/sections/Pan115DirectoryBrowserSection.tsx`（1 错）

`:10` `TS6133 'isPan115CredentialErro…' is declared but its value is never read` —— 删未用变量即可。

## 4. 为什么不该由我做

- A/E 是纯机械，但 B/C/D **需要各自卡作者的业务意图**（契约真名、hook 该不该存在）；
- 猜错会把 MFA / collections **功能回退**（本档的 A 组虽可安全去重，但只做 A 组 **仍然不绿**：
  剩下 B 5 + C 2 + D 1 + E 1 = **9 错**）⇒ 拆成「机械组（A+E）」与「业务组（B+C+D）」两张卡最省事。
- 我这一席的活树是**后端仓**；本 FE worktree 只为 FE-LOG-ARCHIVE 而建，改动他人 FE 文件会与在跑的
  w5（`w/w5/fe-points-checkin`）撞车。

## 5. ★附带修正：FE 卡面的 typecheck 命令是**虚绿**

`host/tsconfig.json` 是 **solution 文件**（`"files": []` + 仅 `references`）⇒
`cd host && npx tsc -p . --noEmit` **不编译任何文件、恒 EXIT=0**（我先跑它也拿到 0，差点假绿）。
仓内权威口径是 `package.json` 的 `typecheck`/`build`：

```bash
cd host && npx tsc -p tsconfig.app.json --noEmit   # include: ["src", "../shared/src/**/*"]
```
建议 FE 卡面统一写成 `-p tsconfig.app.json`（或 `npm run typecheck`）。
（`shared/tsconfig.json` 有 `include:["src"]` ⇒ 其 `-p .` 是真的，绿有效。）

## 6. 硬证据（干净 origin/main 复算）

```bash
git -C <fe repo> worktree add --detach /tmp/w2-fe-main2 origin/main
cd /tmp/w2-fe-main2/host && ./node_modules/.bin/tsc -p tsconfig.app.json --noEmit
# ⇒ EXIT=2，22 errors，逐文件计数与我的分支完全一致：
#   13 LoginPage.tsx / 5 MfaVerifyPanel.tsx / 2 CollectionsListPage.tsx
#    1 LoginForm.tsx / 1 Pan115DirectoryBrowserSection.tsx
#   本卡（FE-LOG-ARCHIVE）文件命中数 = 0
```
另 `check-frontend-dupes` 在干净 `origin/main` 上同样报 1 例（`useCollectionsList.ts:14`）。

**复核（main 前进后）**：`origin/main` 由 `b092741` → `10c5298`（+9 提交，含 continue-watching /
notification-prefs / points-checkin）后重跑同命令 ⇒ **仍 22 错、逐文件计数完全不变**（13/5/2/1/1）
⇒ P1 未因这 9 个提交改变；本卡分支 merge 后 `shared` tsc 仍 EXIT=0、host 测试 **401/401 全绿**。

## 7. 构建阻断链（实测：把 A 组消除后，下一个阻断者是谁）

体积闸 `check-frontend-size` 需要 `host/dist/.vite/manifest.json`，即必须先 `vite build` 成功。
为判「光去重够不够」，我在**本地临时**打上 A 组（`LoginPage.tsx` 5 处重复块去重）+ E 组（删未用 import）的机械补丁，
跑 `vite build`，测完**已全部回滚**（`git diff HEAD` 为空，未提交）：

```
① 原始（未打补丁）：vite build ⇒ 51 modules 后挂
   [vite:esbuild] The symbol "mfaChallenge" has already been declared   ← A 组

② 打上 A+E 机械补丁：vite build ⇒ 2477 modules 编译通过（A 组确被消），但改挂：
   src/pages/login/forms/MfaVerifyPanel.tsx (14:17):
   "SESSION_USERNAME_STORAGE_KEY" is not exported by "../shared/src/contracts/auth/index.ts"
   ⇒ 即 §3 B 组那条 TS2305

③ 推知再往下：C 组（useCollectionsList 全仓无定义）仍会阻断 rollup 绑定
```

**结论（对派卡的直接含义）**：main 前端**不是"lint 债"，而是"构建链断在功能缺口上"** ——
B 组（`contracts/auth` 缺 `SESSION_USERNAME_STORAGE_KEY` 等导出）與 C 组（合集列表 hook 缺失）
都是**要真写代码**的缺口，去重只是清除第一层。
⇒ 派卡时**不能只派"去重让 tsc 变绿"**（那只把 22 错降到 9 错、build 仍挂）；
须把 B/C 当**实现卡**（谁交付的谁补），否则 `check-frontend-size` 在前端仓**永远跑不出结论**。
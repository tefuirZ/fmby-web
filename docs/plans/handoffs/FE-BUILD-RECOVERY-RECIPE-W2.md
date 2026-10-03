# FE 构建恢复配方（W2 实测，端到端验证）

**结论**：`origin/main`（fmby-web，`10c5298`）的前端构建**可完全恢复**，只需 **3 处改动**；
其中 **2 处已由我交付、第 3 处已存在于一条未合并分支**（无需重写）。
恢复后 `vite build` **EXIT=0**、`check-frontend-size` **PASSED**。

## 1. 三处改动（缺一不可）

| # | 改动 | 状态 |
|---|---|---|
| **A+E** | `LoginPage.tsx` 5 处**逐字节相同**的重复块去重 + `Pan115DirectoryBrowserSection.tsx` 删 1 未用 import | ✅ 已交 `w/w2/fe-login-dedup`（`09bf311`） |
| **B** | `contracts/auth/index.ts` barrel 补 `SESSION_USERNAME_STORAGE_KEY` re-export（常量已在 `api.ts:139`）+ `MfaVerifyPanel.tsx` 删 2 未用 import | ✅ 已交 `w/w2/fe-tsc-mfa-export`（`d27f279`） |
| **C** | `shared/src/viewmodels/useCollectionsList.ts` —— **需用真正的 hook 实现替换**（现文件 317 行却**只导出 `queryKeys`**，hook 全仓无定义） | ★**已存在于 `w/fe2/fe-search-ui`**（fe2 席，10-03 12:46，自有 1 提交、落后 42）⇒ **取该文件即可，不必重写** |

## 2. 端到端实测（当次输出，本 worktree `/data/wt-w2-fe-tsc-mfa`）

```
# ① 逐步定位 build 阻断链（A → B → C）
原始 main                                  ⇒ 51 模块 挂 A（mfaChallenge 重复声明）
+ A+E                                      ⇒ 2477 模块 挂 B（SESSION_USERNAME_STORAGE_KEY 未导出）
+ A+E + B（= 我的两条分支）                 ⇒ 2475 模块 挂 C（useCollectionsList 未导出）

# ② 三处齐备 ⇒ 构建恢复
+ A+E + B + C(取自 w/fe2/fe-search-ui)
  cd host && vite build                    ⇒ **EXIT=0**，2475 modules，manifest.json 47.82 kB 正常产出

# ③ 体积闸（此前因 build 失败无法出结论）
npm run build:themes  （★前置：主题产物，缺则闸报「主题独立产物缺失」）
node scripts/check-frontend-size.mjs       ⇒ **EXIT=0 / All frontend size & chunking gates PASSED**
```

## 3. 三处齐备后的**剩余类型错 = 6**（`tsc -p tsconfig.app.json`，由 22 降至 6）

```
src/pages/login/LoginPage.tsx(151,34) TS2339 Property 'user' does not exist on type 'AuthResponse'
src/pages/login/LoginPage.tsx(290,22) TS2322 (response: AuthResponse) => void 不可赋给 (user: User) => void
src/pages/login/forms/LoginForm.tsx(31,32) TS2339 同上（AuthResponse 收窄）
src/pages/login/forms/MfaVerifyPanel.tsx(46,9) TS2322 'string | null' 不可赋给 'string'
src/pages/login/forms/MfaVerifyPanel.tsx(47,9) TS2322 'string | null' 不可赋给 'string | undefined'
src/pages/browse/CollectionsListPage.tsx(24,62) TS2353 对象字面量含未知属性（页面传 `search`，
        而 fe2 的 hook（95 行）早于 COLLECTIONS-LIST-SEARCH ⇒ 需补 search 入参）
```

**★关键**：这 6 条**不阻 build**（esbuild/rollup 不做类型检查）⇒
**构建与体积闸的恢复不依赖修这 6 条**；但它们仍是 `tsc` 红，须按作者归属收口：
- 4 条（`LoginPage`×2、`LoginForm`×1、`MfaVerifyPanel`×2 中的可空性）→ **MFA/AuthResponse 收窄**（`1cc66f3` 余项）
- 1 条（`CollectionsListPage` `search`）→ **collections 席**（其 `COLLECTIONS-LIST-SEARCH` 在途）

## 3b. ★剩 5 条里 3 条的**精确诊断**（升级版：不只是「语义错」，而是**潜在崩溃 + 冗余守卫**）

已核 `AuthResponse` 定义（`shared/src/contracts/auth/api.ts`）：
```ts
export type AuthResponse = AuthLoginSuccess | AuthLoginMfaRequired;
export interface AuthLoginSuccess      { status: 'ok';            user: User; }
export interface AuthLoginMfaRequired  { status: 'mfa_required';  challengeId: string;  expiresAt: number | null; }
```
⇒ `challengeId` 是**非空 `string``**（不是 `string | null`）。而现码（`LoginPage.tsx:150`）写：

```ts
if (response.status === 'mfa_required' && response.challengeId) {   // ← 「&& challengeId」冗余
  setMfaChallenge({ challengeId: response.challengeId, expiresAt: response.expiresAt ?? null });
  return;
}
handleAuthenticated(response.user);   // ← TS2339：此处 response 仍可能是 mfa_required 变体
```

**两个后果**：
1. **类型收窄被破坏**（TS2339 `response.user` / TS2322 回调签名）—— 因为 `challengeId` 可为空串（falsy），
   else 分支在类型上仍保留 `AuthLoginMfaRequired` 变体；
2. **潜在运行时崩溃**：若后端真回了 `challengeId: ''`，控制流会**掉进 `handleAuthenticated(response.user)`**，
   而 mfa 变体**没有 `user` 字段** ⇒ `user` 为 `undefined`。

**最小修法（供 MFA/登录作者裁定，我未改）**：去掉冗余的 `&& response.challengeId`，即
`if (response.status === 'mfa_required') { … }`。这样真分支 100% 是 mfa 变体、else 分支被收窄为
`AuthLoginSuccess` ⇒ 3 条错误（`LoginPage:151`/`LoginPage:290`/`LoginForm:31`）同时消失。
**唯一的边界行为变化**：`challengeId === ''` 时由「掉进 handleAuthenticated(undefined)」改为「进 MFA 面板」——
按 `challengeId: string` 的契约后者才是正确语义；但**是否还要对空串 fail-closed 报错，属作者决定**，
故我**不在本席擅自改**（且该文件与我的 `w/w2/fe-login-dedup` 重叠，改了会造成双分支冲突）。

剩余 2 条（`MfaVerifyPanel.tsx:46/47` `string | null` 未收窄）确属面板自身的可空性处理，同归该作者。

## 4. 环境前置（非代码缺陷，别误判成代码问题）

`check-frontend-size` 除 host `vite build` 外**还需主题产物**：
```bash
npm run build:themes      # 生成 themes/{_template,darkroom}/dist/index.js
```
缺则闸报 `[FAIL] 主题独立产物缺失: themes/…/dist/index.js`（**不是体积超限**）。
另外 pnpm workspace 下各包需各自 `node_modules`（worktree 里用 symlink 指向主 clone 即可）。

## 4b. ★★合并产物验证（**不是补丁模拟**）：三支实 merge 后跑全闸

§2 是用「临时补丁 + 复制文件」模拟三卡齐备；下为**真实合并三条分支**后的输出
（临时 worktree 基于 `origin/main`，依次 `git merge origin/w/w2/fe-login-dedup` →
`origin/w/w2/fe-tsc-mfa-export` → `origin/w/w2/fe-collections-vm`，**三次各 EXIT=0、无冲突**）：

```
git status --porcelain                         ⇒ 无冲突/干净
node scripts/check-frontend-dupes.mjs          ⇒ [PASS] 0 violations（main 那条红消失）
cd shared && tsc -p . --noEmit                 ⇒ EXIT=0
cd host   && tsc -p tsconfig.app.json --noEmit ⇒ EXIT=2，**5 错**（与 §3 逐条一致）
cd host   && vite build                        ⇒ **EXIT=0**
npm run build:themes && check-frontend-size    ⇒ **EXIT=0 / All frontend size & chunking gates PASSED**
cd host   && node --test tests/*.test.ts       ⇒ tests 397 / pass 397 / fail 0（EXIT=0）
check-frontend-component-size.mjs              ⇒ EXIT=0
check-contract-mappers.mjs                     ⇒ EXIT=0
```
⇒ **三条分支合并后：前端「可构建 + 体积闸/dupes 闸全绿」属实**（在真实合并树上复核）。
（临时 worktree 已 `git worktree remove --force` 清理。）

## 5. 取证方法学（含我前次误判的教训）

- **祖先/方向核对**（本次逐分支做）：`rev-list --count origin/main..<B>` / `<B>..origin/main` + `log -1 --date=iso`。
  例：`w/zcode/fe-fix-build-ts` 名似本面但**落后 247 提交**（09-24 旧尝试）；
  `w/w5/fe-tsc-baseline-fix` 是 **main 祖先、零自有提交**；`w/fe2/fe-search-ui` 才是**含实现的那条**（自有 1、10-03 12:46）。
  ⇒ 「某分支删了功能」这类结论**必须先判祖先关系**，否则 `diff main..旧分支` 的反向差会被读成删除。
- 临时改动（A+E 补丁、C 文件）**测完已全部 `git checkout --` 回滚**，本分支只留 B 卡改动。

## 6. 建议动作

1. 合并 `w/w2/fe-login-dedup`（A+E）+ `w/w2/fe-tsc-mfa-export`（B）。
2. **确认 `w/fe2/fe-search-ui` 的 `useCollectionsList.ts` 是否可直接采用**（该分支落后 42 提交且含大量反向差表象，
   建议**只取该文件**而非整支合并；并在其上补 `search` 入参以消 `TS2353`）。
3. 上述落地后：`vite build` 与体积闸恢复可判定；剩 6 条 `tsc` 按 §3 归属派卡。
4. 复跑顺序建议：`npm run build:themes` → host `vite build` → `check-frontend-size` → `tsc`。
## 4c. ★★终态复核（`fe-login-dedup` 追加「收窄修复」后重跑合并树）

`w/w2/fe-login-dedup` 后续追加了一提交（完成 `AuthResponse` 收窄余项，并修好「经登录表单的二因子登录
走不通」这一真实功能缺陷 —— 详见 `FE-LOGIN-DEDUP-AE-W2.md` 附录）。
⇒ 三支重新真实合并（各 EXIT=0、无冲突）后的**终态**：

```
cd host && tsc -p tsconfig.app.json --noEmit   ⇒ **2 错**（此前 5 错）
    仅剩 MfaVerifyPanel.tsx(46,9)/(47,9) 的 'string | null' 可空性（该面板自身处理，归其作者）
cd host && vite build                          ⇒ EXIT=0
npm run build:themes && check-frontend-size    ⇒ EXIT=0 / All frontend size & chunking gates PASSED
cd host && node --test tests/*.test.ts         ⇒ tests 397 / pass 397 / fail 0
check-frontend-dupes.mjs                       ⇒ EXIT=0（PASSED）
check-contract-mappers.mjs                     ⇒ EXIT=0
```
⇒ **三支合并后：总错数 22 → 2，构建与体积/dupes/mapper 闸全绿。** 剩下唯一 2 条属 MFA 面板可空性。

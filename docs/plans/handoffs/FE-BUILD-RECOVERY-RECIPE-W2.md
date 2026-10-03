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

## 4. 环境前置（非代码缺陷，别误判成代码问题）

`check-frontend-size` 除 host `vite build` 外**还需主题产物**：
```bash
npm run build:themes      # 生成 themes/{_template,darkroom}/dist/index.js
```
缺则闸报 `[FAIL] 主题独立产物缺失: themes/…/dist/index.js`（**不是体积超限**）。
另外 pnpm workspace 下各包需各自 `node_modules`（worktree 里用 symlink 指向主 clone 即可）。

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
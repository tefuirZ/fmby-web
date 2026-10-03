# FE-COLLECTIONS-VM-RECOVER 交付（W2 自行立卡）

分支 `w/w2/fe-collections-vm`（worktree `/data/wt-w2-fe-collections`，基于 `origin/main` = `10c5298`）。
卡面：`/root/fmby-orchestra/cards/FE-COLLECTIONS-VM-RECOVER.md`。

## 1. 性质：**采用（recover）**既存实现，非重写

`shared/src/viewmodels/useCollectionsList.ts` 在 main 上**有 317 行却只导出 `queryKeys`**
（一个放错位置的 query key factory），而 `CollectionsListPage.tsx:5,24` 导入并调用
`useCollectionsList`（**全仓无定义**）⇒ 该页不可构建。

**真实现已存在于未合分支 `w/fe2/fe-search-ui`**（fe2 席，2026-10-03 12:46，自有 1 提交、落后 42）。
本卡**取其实现**，并**明确署名**：
> 实现来源：fe2 席分支 `w/fe2/fe-search-ui`（`shared/src/viewmodels/useCollectionsList.ts`）；
> 本卡仅做「接入 main + 补 `search` 入参 + 验证」，非作者。

## 2. 核验过的采用成本（先取证后动手）

| 项 | 结论 |
|---|---|
| 依赖是否在 main | ✅ `viewmodels/useLayoutHint.ts`、`viewmodels/types.ts`（`deriveViewState`/`ViewModel`/`ViewState`/`LayoutHint`）**main 上全都有** ⇒ 只需替换 1 个文件 |
| 后端是否支持 `search` | ✅ `collectionsBrowseApi.listCollections` 的 `CollectionsListParams.search` 已存在并已接 query（空白不传） |
| queryKey 是否支持第 3 参 | ✅ `queryKeys.browse.collections(page, pageSize, search?)` 已支持（注释即「分页 + 检索」） |
| 唯一差量 | fe2 版 hook 未声明/转发 `search`（页面传了它 ⇒ `TS2353`）⇒ **本卡补 3 处（options 类型 / 解构 / queryKey+调用）** |

## 3. 改动（1 文件，含 3 处 `search` 补参）

`shared/src/viewmodels/useCollectionsList.ts`：fe2 实现（94 行）替换 main 的 queryKeys 版本；
新增 `search?: string`（options）、`search = ''`（解构）、`trimmedSearch` 归一后进 `queryKey` 与
`listCollections({ page, pageSize, search: trimmedSearch })`。
（trim 归一理由：与后端「空白=全量」口径一致，避免 `''` 与 `' x '` 产生不同 cache key。）

## 4. RED → GREEN（当次原文）

**① `check-frontend-dupes`（main 那条唯一的红，本卡顺带修掉）**
```
RED  （main 原文件）: [FAIL] Found 1 violation(s):
      [Unique Implementation Violation (queryKeys Factory)] shared/src/viewmodels/useCollectionsList.ts:14
      Code: export const queryKeys = {   Reason: queryKeys definition is only permitted in 'shared/src/query/**'
GREEN（本卡版本）  : [PASS] 0 violations found. All frontend architectural boundaries clean.   （EXIT=0）
```

**② `tsc`（本卡单独）**
```
main             : 22 错（含 CollectionsListPage 2 条 TS2305/TS7006）
本卡             : 22 → 20 —— **CollectionsListPage 清零** ✅
（shared tsc EXIT=0）
```

**③ ★三卡组合终验（A+E + B + 本卡）—— FE 构建恢复的完整证明**
```
cd host && vite build                         ⇒ **EXIT=0**（2475 modules；manifest 正常产出）
npm run build:themes                          ⇒ EXIT=0
node scripts/check-frontend-size.mjs          ⇒ **EXIT=0 / All frontend size & chunking gates PASSED**
cd host && node --test tests/*.test.ts        ⇒ tests 397 / pass 397 / fail 0
tsc -p tsconfig.app.json                      ⇒ 22 → **5 错**（全为语义组，见 §5）
```

## 5. 三卡齐备后剩余 **5 条**（均**不阻 build**）

```
LoginPage.tsx(151,34) TS2339 Property 'user' does not exist on type 'AuthResponse'
LoginPage.tsx(290,22) TS2322 (response: AuthResponse) => void 不可赋给 (user: User) => void
LoginForm.tsx(31,32)  TS2339 同上
MfaVerifyPanel.tsx(46,9) TS2322 'string | null' 不可赋给 'string'
MfaVerifyPanel.tsx(47,9) TS2322 'string | null' 不可赋给 'string | undefined'
```
归属：4 条属 **`AuthResponse` 可辨识联合收窄未完成**（w5 `1cc66f3`「按 status 收窄（返工 2/2）」余项）+
1 条属 MFA 面板可空性 —— **同一语义家族，须 MFA/登录作者定夺**（守 `status` 单独判定？
还是 `mfa_required` 缺 challengeId 时给错误态？）。**esbuild/rollup 不做类型检查 ⇒ 不阻 build**。

## 6. 当次验证输出（全量汇总）

```
cd shared && ./node_modules/.bin/tsc -p . --noEmit                 ⇒ EXIT=0
cd host   && ./node_modules/.bin/tsc -p tsconfig.app.json --noEmit ⇒ 22 → 20（本卡）/ 22 → 5（三卡齐）
cd host   && node --import ./tests/register-aliases.mjs --test tests/*.test.ts
                                                                  ⇒ 397/397 pass（EXIT=0，三卡齐态）
node scripts/check-frontend-dupes.mjs                             ⇒ RED(1) → **GREEN(0)**
cd host && vite build（三卡齐态）                                  ⇒ **EXIT=0**
npm run build:themes && node scripts/check-frontend-size.mjs       ⇒ **PASSED**
```
临时复现的 A+E 补丁与 B 卡改动**测完已全部 `git checkout --` 回滚**，本分支只留 C 卡改动（1 文件）✅

## 7. 取证方法学（含我前次误判的教训）

本卡动门前逐项核了**祖先/方向**（`rev-list --count origin/main..<B>` + `log -1 --date=iso`）：
- `w/fe2/fe-search-ui`：**自有 1 提交、10-03 12:46** ⇒ 真含实现的那条；
- `w/zcode/fe-fix-build-ts`：自有 1 但**落后 247**（09-24 旧尝试）；`w/w5/fe-tsc-baseline-fix`：**main 祖先、零自有提交**。
（教训：`diff main..旧分支` 的反向差会被读成「该分支删了功能」——必须先判祖先关系。）

## 8. ponytail

- **复用既有实现而非重写**（阶梯第 2 级「仓内已有的就复用」）：0 新文件、0 新依赖、0 新抽象。
- **只补差量**：3 处 `search`；无抑制手段（无 `@ts-ignore`）。
- 跳过：`LoginPage`/`LoginForm`/`MfaVerifyPanel` 的 5 条语义错（须作者定 API 语义）；首页/其它页不动。
- `ponytail:` 升级路径：本卡是 build 链的**最后一环**；落地后 `vite build`/体积闸恢复可判定。

## 9. 合并顺序建议

三卡文件**互不重叠**（A+E：`LoginPage.tsx`+`Pan115…`；B：`contracts/auth/index.ts`+`MfaVerifyPanel.tsx`；
本卡：`viewmodels/useCollectionsList.ts`）⇒ 可任意顺序合并；**三条都合后** `vite build` 与
`check-frontend-size` 首次恢复判定（本档 §4③ 已实证）。
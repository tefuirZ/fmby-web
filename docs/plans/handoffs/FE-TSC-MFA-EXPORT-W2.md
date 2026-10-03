# FE-TSC-MFA-EXPORT 交付（W2 自行立卡，承 FE-LOGIN-DEDUP-AE）

分支 `w/w2/fe-tsc-mfa-export`（worktree `/data/wt-w2-fe-tsc-mfa`，基于 `origin/main` = `10c5298`）。
卡面：`/root/fmby-orchestra/cards/FE-TSC-MFA-EXPORT.md`。

## 1. 缺口（两条，均已定位到行）

1. **barrel 漏 re-export**：`SESSION_USERNAME_STORAGE_KEY` 已在
   `shared/src/contracts/auth/api.ts:139` 定义并 `export const`，但
   `shared/src/contracts/auth/index.ts` 只 `export { authApi, mapMeResponse } from './api'`
   ⇒ `MfaVerifyPanel.tsx:14` 报 `TS2305 has no exported member`。
   （正是仓内自查清单第 2 类：「新增导出必接 re-export 链路让门面可达」。）
2. **2 个未用 import**：`MfaVerifyPanel.tsx:13 useQueryClient`、`:17 useSession`（`TS6133`，`noUnusedLocals` 开启）。

## 2. 改了什么（零语义）

| 文件 | 改动 |
|---|---|
| `shared/src/contracts/auth/index.ts` | barrel 补 `SESSION_USERNAME_STORAGE_KEY`（既有导出接上门面，**只是扩大导出面**） |
| `host/src/pages/login/forms/MfaVerifyPanel.tsx` | 删 2 个未用 import |

净 **diff：2 文件 / +4 −3**。

## 3. RED → GREEN（当次原文）

```bash
# RED（本 worktree、本卡分支、未修）
cd host && ./node_modules/.bin/tsc -p tsconfig.app.json --noEmit     # EXIT=2
  总错误数: 22
  本卡目标 3 条:
    MfaVerifyPanel.tsx(13,23): TS6133: 'useQueryClient' is declared but its value is never read.
    MfaVerifyPanel.tsx(14,18): TS2305: Module '"@fmby/v2-shared/contracts/auth"' has no exported member 'SESSION_…'
    MfaVerifyPanel.tsx(17,1):  TS6133: 'useSession' is declared but its value is never read.

# GREEN（同一命令）
  总错误数: 22 → 19
    LoginPage.tsx 13 / CollectionsListPage 2 / MfaVerifyPanel **2**（余可空性）/ LoginForm 1 / Pan115 1
  目标 3 条是否已清: True
```

## 4. ★关键实测：**构建阻断链已完全定位**（这是本档最有价值的部分）

| 阶段 | `vite build` 结果 |
|---|---|
| 原始 main | 51 模块 ⇒ 挂 **A 组**（`mfaChallenge` 重复声明） |
| + `FE-LOGIN-DEDUP-AE`（A+E） | 2477 模块 ⇒ 挂 **B 组**（`SESSION_USERNAME_STORAGE_KEY` 未导出） |
| **+ 本卡**（A+E + B） | **2475 模块 ⇒ 挂 C 组**：<br>`src/pages/browse/CollectionsListPage.tsx (5:9): "useCollectionsList" is not exported by "../shared/src/viewmodels/index.ts"` |

⇒ **`vite build` 只剩一个阻断 = C 组（`useCollectionsList` 全仓无定义）**；
另 2 条 `TS2322`（`MfaVerifyPanel` 可空性）与 `LoginForm`/`LoginPage` 语义错**不阻 build**
（esbuild/rollup 不做类型检查）⇒ 修完 C 组后 `check-frontend-size`（体积闸）即可**首次跑出结论**。

**两卡合并后的类型错数（已实测，非推算）**：`22 → 7`
（`CollectionsListPage` 2 / `LoginPage` 2 / `MfaVerifyPanel` 2 / `LoginForm` 1）。

## 5. 当次验证输出（全量）

```
cd shared && ./node_modules/.bin/tsc -p . --noEmit                 ⇒ EXIT=0
cd host   && ./node_modules/.bin/tsc -p tsconfig.app.json --noEmit ⇒ 22 → 19（§3）；两卡合并 7（§4）
cd host   && node --import ./tests/register-aliases.mjs --test tests/*.test.ts
                                                                  ⇒ tests 397 / pass 397 / fail 0（EXIT=0）
node scripts/check-frontend-component-size.mjs                    ⇒ EXIT=0
node scripts/check-contract-mappers.mjs                           ⇒ EXIT=0
git apply /tmp/fe-login-dedup.patch（临时测两卡合并）后已 `git checkout --` 回滚，工作树仅留本卡改动 ✅
```

## 6. 取证记录（含方向性核对，吸取前次误判教训）

- **祖先/方向核对**（本卡立卡前）：`w/zcode/fe-fix-build-ts` 虽名似本面，但 `rev-list --count origin/main..<它>`=1
  且**落后 247 提交**（2026-09-24 的旧尝试）；`w/w5/fe-tsc-baseline-fix` 是 **main 祖先、零自有提交**（旧快照）
  ⇒ **今天这处 build 破损无人认领**，非重复劳动。
- 常量真实存在性：逐文件扫描 `SESSION_USERNAME_STORAGE_KEY` ⇒ 仅 `contracts/auth/api.ts` 定义（4 处引用），
  **barrel 未暴露** ⇒ 结论「漏 re-export」有据（不是「常量不存在」）。

## 7. ponytail

- **只接线不造物**：补 1 行 re-export + 删 2 行未用 import，净 +4/−3；无新文件、无新依赖、零抑制手段（无 `@ts-ignore`）。
- **跳过**：`MfaVerifyPanel.tsx:47/48` 的 `string|null` 可空性（改用例守卫方式=决定 API 语义，须 MFA 作者）；
  C 组 `useCollectionsList`（实为「实现缺失」，另立；见 §4 —— 它是 build 的**最后**一个阻断）。
- `ponytail:` 升级路径已写明：C 组落地后 build 恢复，体积闸才能判定。

## 8. 合并提示

与 `w/w2/fe-login-dedup`（A+E）**文件不重叠**（本卡：`contracts/auth/index.ts` + `MfaVerifyPanel.tsx`；
A+E：`LoginPage.tsx` + `Pan115DirectoryBrowserSection.tsx`）⇒ 两卡可独立合并；
建议连同 C 组实现卡一起合，以一次性让 `vite build` 通过。
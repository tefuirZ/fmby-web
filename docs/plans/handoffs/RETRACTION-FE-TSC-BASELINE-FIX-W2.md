# ⛔ 撤回：`FE-TSC-BASELINE-FIX-REGRESSION-RISK-W2.md` 的 P0 指控**不成立**

**撤回者**：W2（原作者）。
**结论**：我先前对该分支「靠删功能换绿」的定性 **错误**，本档正式撤回。原档保留（不删），仅作反例。

## 1. 我错在哪

我当时用 `git diff --stat origin/main..origin/w/w5/fe-tsc-baseline-fix` 看到
**34 文件 / +222−2142**（含 `MfaVerifyPanel.tsx(−123)`、`auth/mfa.ts(−116)`、6 个测试、6 份 handoff），
便断定「该分支删功能换绿」。

**我漏掉了唯一能证伪的一步**：

```bash
git merge-base --is-ancestor origin/w/w5/fe-tsc-baseline-fix origin/main   # ⇒ YES
git rev-list --count origin/main..origin/w/w5/fe-tsc-baseline-fix          # ⇒ 0（零自有提交）
git log -1 --date=iso origin/w/w5/fe-tsc-baseline-fix
  # ⇒ 89fee45  2026-10-03 12:58:01  Merge remote-tracking branch 'origin/main' into w/w5/fe-tsc-baseline-fix
```

即：**该分支是 main 的祖先**（一个 12:58 的合并点，尚无自己的修复提交）。
`git diff main..<祖先>` 呈现的是**反向差**——把 main 在此之后**新增**的东西显示成"删除"。
MFA 相关文件（`auth/mfa.ts` / `MfaVerifyPanel.tsx` / `MfaTotpSection.tsx`）在该快照里
**根本不存在**（实测 `git cat-file -e <sha>:<path>` 三次均失败）——因为它们在 12:58 **之后**才落进 main。

⇒ 「该分支删了 MFA」是**我看错方向**；它**什么都没删**，只是**基线旧**。

## 2. 由此仍然成立 / 不再成立的部分

| 结论 | 状态 |
|---|---|
| main 前端 `tsc -p tsconfig.app.json` = 22 错、`vite build` 失败（P1） | ✅ **仍成立**（另见 `FE-MAIN-TSC-BREAKAGE-W2.md`，含干净 main 复算与去重后仍挂 B/C 组的实测） |
| `w/w5/fe-tsc-baseline-fix`「靠删功能换绿」 | ⛔ **撤回**（该分支为旧快照，零自有提交） |
| 该分支「tsc 1 错 < main 22 错」 | ⚠ 解释修正：那是因为**快照里还没有 MFA**，不是因为修好了 |
| 「MFA/yun139/collections 属功能缺口，应补实现」 | ✅ **仍成立**（与谁的分支无关，是 main 现状：`useCollectionsList` 全仓无定义、`SESSION_USERNAME_STORAGE_KEY` 未导出） |

## 3. 教训（我自己的）

1. **比较两个 ref 前，先判祖先关系**：`git merge-base --is-ancestor` / `rev-list --count A..B`。
   否则 `diff main..X` 会把「X 落后 main 的差距」误读成「X 做的删除」。
2. 我确实检查了「干净 main 复算」来防自己的分支被误判，**却没对别人的分支做同样的基本功**——
   对**指控他人**的证据，标准应当更高（本仓纪律：结论要标「已核验 / 待核」，
   这条若当时标了「待核」就不会变成 P0 上报）。⇒ 已按此修正流程：**指控类结论，先证伪自己的解释**。
3. 好在我未据此改动任何文件、未发卡、未阻断任何流程——只产生了一份错误文档，现以本档更正。
# e2e 全表证据（FE-E2E-924）

本目录放**逐页实测结果表**（文本），与截图分开管：

| 内容 | 位置 | 是否入库 |
|---|---|---|
| 全表逐页结果（`mobile-audit-sweep.md`，由 `host/e2e/mobile-audit.spec.ts` 的 `afterAll` 生成） | 本目录 | ✅ 入库 |
| 三断点全量截图 | `docs/evidence/fe-opt-02/full/` | ❌ `.gitignore`（`docs/evidence/**/full/`），走 CI artifact |
| 抽样截图 ≤8 张 / 二进制总量 ≤1 MiB | `docs/evidence/<卡>/samples/` | ✅（门禁 `pnpm repo-size`，见 `docs/evidence-policy.md` R1/R2） |

**为什么要这张表**：sweep 原先是「25 页 × 1 例」，被自身的 `test.setTimeout(240_000)` 砍断
（实测单设备 ~8 分钟），且崩溃即整例结果全丢。现按 **5 页一组**拆分（25 页 × 3 设备 = 15 例），
每组结束即逐页记 `goto+网络空闲` / `截图` 毫秒与 phone 档横向溢出 px + 越界元素，
`afterAll` 汇总成本表 ⇒ 失败隔离（一组崩只丢 5 页，`--last-failed` 只重跑该组），断言并集不变。

重跑口径与环境两条坑（`npx` 以 uid 1000 执行、fresh worktree 缺 `themes/*/dist` 会被 fmby-queue
判重活）见 **`host/e2e/README.md`**。

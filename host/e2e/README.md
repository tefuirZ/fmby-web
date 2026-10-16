# `host/e2e/` 写用例的两条硬约定（FE-E2E-924 立，都有代价）

## 1) `page.waitForResponse` 必须在**触发动作之前**武装

```ts
// ✗ 错（曾以 test.fixme 藏了很久）：响应早已落地，之后再等 = 等一个不会再来的响应
await page.goto('/libraries/1');
await expect.poll(() => requests.length).toBeGreaterThanOrEqual(1);
const resp = await page.waitForResponse((r) => r.url().includes('/api/browse/libraries/1'));  // → 30s timeout

// ✓ 对：先建 promise（武装），再触发动作，最后 await
const respPromise = page.waitForResponse((r) => …, { timeout: 30_000 });
await page.goto('/libraries/1');
const resp = await respPromise;
```

为什么值得单独写：`page.on('response')` 收集 + 读数组末位是**另一种错法**（异步 `json()` push 乱序 ⇒ 可能**假绿**）。
从「末位」改成「`waitForResponse`」方向是对的，但**武装时机放错就从假绿翻成假红**——两边都不是真验证。
判据：任何「等一次具体响应」的用例，`waitForResponse(...)` 这一行必须出现在引起它的 `goto` / `click` /
`selectOption` **之前**，且显式写 `{ timeout }` 不靠默认值。

## 2) 本机跑 e2e 的两个坑（新席位必踩，先说）

- **`npx`/`pnpm` 以 uid 1000（`tefuir`）执行，不是 root**。⇒ 用 root 建的 worktree/目录（755）会让
  playwright 写不进：`EACCES: permission denied, open '<repo>/host/test-results/.last-run.json'`。
  处置：把工作树属主交给 1000。**别对整棵树 `chmod`**——符号链接（`node_modules`、`themes/*/dist`）
  在 Linux 上 `chmod` 会跟到目标，可能改到别人检出的权限；要动链接用 `chown -h`（只改链接本身）。
- **fresh worktree 没有 `themes/*/dist`** ⇒ `start.mjs` 会先跑 `pnpm build:themes`，而本机 fmby-queue
  把它判成重活直接拒绝（`✗ fmby-queue 拒绝：这是重活…`）⇒ webServer 退出码 1，报的却是
  `Process from config.webServer was not able to start`，看着像 e2e 坏了。
  处置（择一）：① 把已构建的 `themes/<id>/dist` **符号链接**到已有检出（本卡用这条，零重活）；
  ② 确需本机跑则 `FMBY_QUEUE_ALLOW_HEAVY_LOCAL=1`（会留痕，须只在机器空闲时用）；
  ③ 主题 dist 的构建归农场/主代理。注：w04 的 PR #52 修的是同一类问题的 pnpm 路径面。

## 3) 可复制的运行口径

```bash
cd host && FMBY_E2E_SERVER_BIN=/data/fmby-build/local-target/debug/fmby-v2-server \
     FMBY_E2E_SEED_BIN=/data/fmby-build/local-target/debug/fmby-e2e-seed \
     FMBY_E2E_WEB_PORT=5315 FMBY_E2E_BACKEND_PORT=18115 \
     npx playwright test e2e/<spec>.spec.ts --project=chromium --reporter=list
```
端口**必须**每席独立（`playwright.config.ts` 里 `reuseExistingServer: false` 且默认写死 5180/18099，
两席同跑会互相抢，报错长得像用例失败）。

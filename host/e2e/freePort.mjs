#!/usr/bin/env node
// 打印一个「当前空闲」的 TCP 端口到 stdout（一行数字）。
//
// 为什么需要它（**实测的假红根因**）：`host/playwright.config.ts` 的 webServer 端口默认写死
// `FMBY_E2E_WEB_PORT ?? 5180`（后端 `?? 18099`），且 `reuseExistingServer: false` ⇒ 只要
// 机器上**任一**别的 e2e 运行（别的 worktree/别的席位，用默认端口）还在监听 5180，本次
// 运行就**起不来**：
//
//   Error: http://127.0.0.1:5180 is already used, make sure that nothing is running on
//          the port/url or set reuseExistingServer:true in config.webServer.
//
// 表现为 `check-e2e.mjs` 的 `[FAIL] playwright 非零退出（exit=1）但 json 报告里 0 条失败`
// —— **一条用例都没跑**，却判成「代码红」（web #52 连续三次被此误判）。
//
// 为什么用**子进程**取端口而不是在 config 里 `net.listen(0)`：Playwright 的 config 模块是
// **同步求值**的（不 await），而 `listen` 是异步 API ⇒ 只能在同步上下文里用子进程拿到结果。
// 本模块自己就是那个子进程（可执行、也被 `execFileSync` 调用）。
//
// 已知边界：探测与真正监听之间存在**竞态**（本函数返回后端口仍可能被抢占）。这是
// 「固定端口必撞」与「完全无竞态」之间的务实取舍；真要绝对无竞态需由 Playwright
// 自己分配端口（上游不支持）。此处只求把「默认端口被占 ⇒ 整轮假红」这一类消掉。
import { createServer } from 'node:net';

const server = createServer();
server.unref();
server.on('error', (err) => {
  console.error(`freePort: 无法探测空闲端口：${err.message}`);
  process.exit(1);
});
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  if (!port) {
    console.error('freePort: 未取得端口号');
    process.exit(1);
  }
  console.log(String(port));
  server.close();
});

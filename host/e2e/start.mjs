/**
 * 真实 E2E 启动器：前种子数据（真实迁移 + admin/media）→ 启动真实 fmby-v2-server
 * → 启动 Vite 前端（/api 经 Vite proxy 打到真实 server + 真实 SQLite）。
 * 禁 mock：全部走真实 HTTP / 真实数据库。
 *
 * WEB-E2E-FULL 两处修复：
 *
 * ① **二进制解析（前端仓无 target/）**：前端仓 `fmby-web` 不含 Rust 产物，
 *    解析优先级为：
 *      1. 环境变量 `FMBY_E2E_SERVER_BIN` / `FMBY_E2E_SEED_BIN`（显式覆盖）；
 *      2. `<repo>/target/<profile>/...`（前端仓内，历史形态）；
 *      3. **主仓 FMBY-V2 默认路径**：`FMBY_E2E_MAIN_REPO`（默认
 *         `/home/tefuir/rustproject/FMBY-V2`）下的 `target/release|debug/...`。
 *    平台后缀 win32 → `.exe`；无二进制 → 跳过（退出 0），由 playwright skip 同步。
 *
 * ② **启动顺序（真缺陷修复）**：原实现「先起 server 再跑 seed」——server 启动即
 *    `bootstrap_multi` 打开三库并持有连接，随后 seed 再 `bootstrap_multi` 同库
 *    → SQLite 写锁竞争 → `E2E seed bootstrap failed`（本卡实测复现）。
 *    正确顺序（对齐 `full_chain_e2e` 先例：bootstrap → seed → server）：
 *    **先 seed（seed 自带 bootstrap_multi 建三库 + 种数据），再起 server**——
 *    server 打开已建好的库，无并发写竞争。
 *
 * ③ **主题产物组装（FE-OPT-03 修复）**：THEME-BUILD-01 起主题改为**运行时外挂**
 *    （host registry 从 `/themes/<id>/*` 拉取，后端静态面映射
 *    `${FMBY_DATA_DIR}/themes/<id>/dist/<rest>`）——但 e2e 启动器未组装
 *    `data/themes/`，导致主题激活 404（asset 回落到 SPA HTML）→ `theme-switch`
 *    在 main 上恒红（实测复现）。本步骤：`pnpm build:themes` 产物
 *    `themes/<id>/dist/**` → `${workDir}/data/themes/<id>/dist/**`。
 */

import { spawn } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer, preview } from 'vite';
import { resolveBinary, describeSearchPaths } from './binaryResolver.mjs';
import { distFreshness } from './distFreshness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// host/e2e → host → 前端仓根
const webRepoRoot = join(here, '..', '..');
// 主仓仅作为 **target 搜索根目录之一**，由共享 resolver 消费
// （binaryResolver.mjs 的 MAIN_REPO_ROOT，可用 FMBY_E2E_MAIN_REPO 覆盖）。

const backendPort = Number(process.env.FMBY_E2E_BACKEND_PORT ?? 18099);
// 前端服务端口（默认 5180；多 worktree 并行时用 FMBY_E2E_WEB_PORT 避让）。
const webPort = Number(process.env.FMBY_E2E_WEB_PORT ?? 5180);
const webOrigin = `http://127.0.0.1:${webPort}`;
// ★LEAK 自愈（GATE-FIX-LEAK 同旨：本仓 /tmp 已积 230+ 个 fmby-e2e-real-*、~2.3G）：
//   本启动器每次跑都会 mkdtemp 一个 workDir（含 seed DB + data，~20M），而 playwrght
//   收尾对 webServer 是**硬杀**（SIGKILL）⇒ 本文件的 SIGINT/SIGTERM 处理器根本不执行
//   ⇒ workDir 每次都残留。SIGKILL 不可捕获，故改为**启动期按 PID 存活自愈**：
//   把 pid 写进 workDir/.fmby-e2e-pid，启动时删掉那些「标记 pid 已死」的旧 workDir
//   （绝不碰活跃 run）。稳态 ≈ 1 个目录。
const PID_MARKER = '.fmby-e2e-pid';
function pruneStaleWorkDirs() {
  let removed = 0;
  try {
    for (const name of readdirSync(tmpdir())) {
      if (!name.startsWith('fmby-e2e-real-')) continue;
      const dir = join(tmpdir(), name);
      // ★#1959 姊妹篇（farm3 根分区 100% ⇒ 920 假红，2026-10-22）：>7 天的 workDir
      //   **无条件视为残留**——即使 PID 标记"存活"（正常会话生命周期以小时计，
      //   7 天 = 纯残留）。无此时限兜底 ⇒ 每会话累积直至磁盘满（实测 25G）。
      let staleOverTtl = false;
      try {
        staleOverTtl = Date.now() - statSync(dir).mtimeMs > 7 * 24 * 3600 * 1000;
      } catch {
        /* 不可读 ⇒ 不按 stale 处理，走原 PID 判定 */
      }
      let alive = false;
      try {
        const pid = Number(readFileSync(join(dir, PID_MARKER), 'utf8').trim());
        alive = Number.isInteger(pid) && pid > 0 && existsSync(`/proc/${pid}`);
      } catch {
        alive = false; // 无标记/不可读 ⇒ 视为僵死
      }
      if (alive && !staleOverTtl) continue;
      try {
        rmSync(dir, { recursive: true, force: true });
        removed += 1;
      } catch {
        /* 无权限等：忽略 */
      }
    }
  } catch {
    /* tmpdir 不可读：忽略（自愈是 best-effort） */
  }
  if (removed > 0) {
    console.log(`[real-server] 清理 ${removed} 个僵死 e2e workDir（/tmp/fmby-e2e-real-*）`);
  }
}
pruneStaleWorkDirs();
const workDir = mkdtempSync(join(tmpdir(), 'fmby-e2e-real-'));
writeFileSync(join(workDir, PID_MARKER), String(process.pid), 'utf8');
const dbPath = join(workDir, 'e2e.db');
const dataDir = join(workDir, 'data');

process.env.FMBY_BACKEND = `http://127.0.0.1:${backendPort}`;
process.env.FMBY_DB_PATH = dbPath;
process.env.FMBY_DATA_DIR = dataDir;
process.env.FMBY_BIND = `127.0.0.1:${backendPort}`;
process.env.FMBY_TRUSTED_ORIGINS = webOrigin;

/**
 * 解析二进制路径 —— **走共享 resolver**（rv01 PR #15 阻断项 ①）。
 * 原实现只找前端仓 target/ 与主仓 target/，而本项目强制
 * `CARGO_TARGET_DIR=/data/fmby-build/local-target` ⇒ 那两处无二进制 ⇒
 * `start.mjs` 走 SKIP 分支，e2e 永不真跑。
 */
function resolveStartBinary(envKey, baseName) {
  return resolveBinary(envKey, baseName);
}

const serverBin = resolveStartBinary('FMBY_E2E_SERVER_BIN', 'fmby-v2-server');
const seedBin = resolveStartBinary('FMBY_E2E_SEED_BIN', 'fmby-e2e-seed');

function skip(reason) {
  console.warn(`[real-server] SKIP: ${reason}`);
  rmSync(workDir, { recursive: true, force: true });
  process.exit(0);
}

if (!serverBin) {
  skip(
    `fmby-v2-server binary not found. 已搜索：${describeSearchPaths()}；` +
      `Build it with 'cargo build -p fmby-v2-server' or set FMBY_E2E_SERVER_BIN.`,
  );
}
if (!seedBin) {
  skip(
    `fmby-e2e-seed binary not found. 已搜索：${describeSearchPaths()}；` +
      `Build it with 'cargo build -p fmby-v2-server' or set FMBY_E2E_SEED_BIN.`,
  );
}

// ---- ① 先 seed（seed 自带 bootstrap_multi 建三库 + 种 admin/media）----
// server 尚未启动，无并发写锁竞争（WEB-E2E-FULL 真缺陷修复）。
function runSeed() {
  return new Promise((resolve) => {
    const seed = spawn(seedBin, [dbPath, dataDir], { stdio: 'inherit', env: process.env });
    seed.once('exit', (code) => resolve(code ?? 1));
  });
}

const seedExit = await runSeed();
if (seedExit !== 0) {
  console.error('[real-server] explicit E2E seed failed');
  rmSync(workDir, { recursive: true, force: true });
  process.exit(1);
}
console.log('[real-server] explicit E2E seed complete');

// ---- ①b 组装主题运行时产物（THEME-BUILD-01 外挂形态）----
// host registry 从 `/themes/<id>/*` 拉 manifest/tokens/index.js；后端静态面映射
// `${FMBY_DATA_DIR}/themes/<id>/dist/<rest>`。故把 `themes/<dir>/dist/**` 复制到
// `${dataDir}/themes/<id>/dist/**`。**目录名与运行时 id 可能不同**（如 `_template`
// 目录 → manifest `id: "template"`）——以 manifest 的 `id` 为准（registry 按 id 请求）。
// 产物缺失时先 `pnpm build:themes`。
function assembleThemes() {
  const themesRoot = join(webRepoRoot, 'themes');
  const dirs = readdirSync(themesRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name);
  let assembled = 0;
  for (const dir of dirs) {
    const srcDist = join(themesRoot, dir, 'dist');
    if (!existsSync(join(srcDist, 'index.js'))) {
      continue; // 未构建的主题跳过
    }
    // 运行时 id 以构建产物 manifest 为准（回退目录名）。
    let runtimeId = dir;
    const distManifest = join(srcDist, 'theme.manifest.json');
    if (existsSync(distManifest)) {
      try {
        const parsed = JSON.parse(readFileSync(distManifest, 'utf8'));
        if (typeof parsed?.id === 'string' && parsed.id.length > 0) {
          runtimeId = parsed.id;
        }
      } catch {
        // manifest 不可解析：回退目录名
      }
    }
    const destDist = join(dataDir, 'themes', runtimeId, 'dist');
    rmSync(destDist, { recursive: true, force: true });
    cpSync(srcDist, destDist, { recursive: true });
    assembled += 1;
  }
  return assembled;
}

let assembled = assembleThemes();
if (assembled === 0) {
  console.log('[real-server] themes/*/dist 缺失，先执行 pnpm build:themes …');
  const built = await new Promise((resolve) => {
    // ★pnpm 解析：仓根 `node_modules/.bin/pnpm` 在本项目**不存在**（pnpm 由独立安装提供，
    //   如 `~/.npm-global/bin/pnpm`）⇒ 直接 spawn 该路径会 ENOENT ⇒ 本文件紧接着
    //   `exit(1)`，**全栈起不来**（fresh worktree 必现；themes dist 已在时该分支被跳过而掩盖）。
    //   照既有写法回退 PATH：仓内有则用仓内，否则用 `pnpm`（不改其它机制）。
    const localPnpm = join(webRepoRoot, 'node_modules', '.bin', 'pnpm');
    const pnpmBin = existsSync(localPnpm) ? localPnpm : 'pnpm';
    // ★REWORK-FE57 后续（实测两轮）：**全新检出差 `themes/*/dist` 时这里必挂** ——
    //   本机 `pnpm` 经 fmby-shim 进「重活串行闸」，**无逃生阀直接拒跑**（实测原文：
    //   「原因：本机 4 核；重活并发会挤爆编译队列…确需本机跑重活：FMBY_QUEUE_ALLOW_HEAVY_LOCAL=1」
    //   ⇒ `pnpm build:themes 失败` ⇒ webServer exit 1 ⇒ playwright 非零退出而**0 条用例失败**，
    //   正是检验线报的 `[FAIL] playwright 非零退出（exit=1）但 json 报告里 0 条失败`）。
    //   只给逃生阀还不够（实测第二轮）：**队列还要排槽** —— 另一席的长 e2e 运行持槽时，
    //   本前置构建排在后面 ⇒ webServer 等到 playwright 的 180s 上限（`Timed out waiting 180000ms`）。
    //   故此处用 `FMBY_QUEUE_DISABLE=1`：**不进队、直接执行**。
    //   依据（为什么要破例）：这是 e2e **自身的前置**，且只是两个主题的 lib 打包
    //   （实测 ~0.3s/主题，非重活）；闸的用意是防「并发重活挤爆 4 核」，不是让测试 harness
    //   在干净检出上永远起不来。作用域仅**这一个子进程**（不改全局 env、不动闸的其它判据）。
    const p = spawn(pnpmBin, ['build:themes'], {
      cwd: webRepoRoot,
      stdio: 'inherit',
      env: { ...process.env, FMBY_QUEUE_DISABLE: '1' },
    });
    p.once('exit', (code) => resolve(code ?? 1));
  });
  if (built !== 0) {
    console.error('[real-server] pnpm build:themes 失败');
    rmSync(workDir, { recursive: true, force: true });
    process.exit(1);
  }
  assembled = assembleThemes();
}
console.log(`[real-server] assembled ${assembled} theme(s) → ${join(dataDir, 'themes')}`);

// ---- ② 再起 server（打开已建好的三库）----
const backend = spawn(serverBin, [], {
  stdio: 'inherit',
  env: process.env,
});
backend.on('exit', (code) => {
  console.error(`[real-server] exited ${code}`);
  process.exit(code ?? 1);
});

// 前端实例句柄（在 ③ 里赋值）；提前声明，供 stop() 与「后端就绪门」安全引用。
let vite;

let stopping = false;
async function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  // vite 可能尚未创建（后端就绪门在 ③ 之前失败时）⇒ 守卫，避免 TDZ/undefined。
  await Promise.allSettled(vite ? [vite.close()] : []);
  backend.kill('SIGTERM');
  rmSync(workDir, { recursive: true, force: true });
  process.exit(exitCode);
}

process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());

// ---- ★等 server 就绪，再起前端（/api/auth/entry/status 应 200）----
// 顺序很关键：playwright 的 webServer 就绪信号是**前端 url**（5180）。若先起前端，
// 5180 一旦可连 playwright 即开跑，而此时后端可能仍在启动窗口 ⇒ **首个 project**
// （chromium）加载登录页时 `/api/auth/entry/status` 代理失败 ⇒ 页面进
// `entryQuery.isError`（「无法连接到服务器」、该态无输入框）；后跑的 project
// （mobile-chrome）后端已就绪 ⇒ 稳定通过 ⇒ **表现成 flaky**（实测：同 dist 下
// chromium 30.1s 超时 / mobile 406ms 通过；重跑双双通过）。
// ⇒ 把就绪门**提到起前端之前**：5180 可连时后端必已 200。
const readyUrl = `http://127.0.0.1:${backendPort}/api/auth/entry/status`;
let ready = false;
for (let i = 0; i < 100; i++) {
  try {
    const resp = await fetch(readyUrl);
    if (resp.ok) {
      console.log(`[real-server] ready at ${process.env.FMBY_BACKEND}`);
      ready = true;
      break;
    }
  } catch {
    // not ready yet
  }
  await new Promise((r) => setTimeout(r, 200));
}
if (!ready) {
  console.error('[real-server] backend did not become ready in time');
  await stop(1);
}

// ---- ③ 起前端（默认服务**已构建产物** host/dist，对齐卡面真实栈口径）----
// 卡面：「主仓二进制 + 前端 host/dist（已构建）」。dev server 会开 React
// StrictMode 双调用（仅 dev），在 VideoPlayer 的异步挂载上暴露竞态
// （实测：dev 下播放页 <video> 不挂载；产物构建无此双调用 → 正常挂载）。
// 产物不存在时先 build；`FMBY_E2E_DEV=1` 可回落到 dev server（调试用）。
const useDevServer = process.env.FMBY_E2E_DEV === '1';
const distIndex = join(webRepoRoot, 'host', 'dist', 'index.html');

if (useDevServer) {
  vite = await createServer({
    root: join(webRepoRoot, 'host'),
    server: {
      host: '127.0.0.1',
      port: webPort,
      strictPort: true,
    },
  });
  await vite.listen();
} else {
  // ★「缺失 **或陈旧**」才 build：原先只在缺失时 build ⇒ 改完源码没重建时会**静默**
  //   服务旧产物，e2e 验证的是过期前端（极难归因）。判据与 scripts/check-e2e.mjs 同源。
  const freshness = distFreshness(distIndex, join(webRepoRoot, 'host'), webRepoRoot);
  if (freshness.missing || freshness.stale) {
    console.log(
      freshness.stale
        ? `[real-server] host/dist 比源码旧（dist ${new Date(freshness.distMtimeMs).toISOString()} < src ${new Date(freshness.srcMtimeMs).toISOString()}），先执行 vite build …`
        : '[real-server] host/dist 缺失，先执行 vite build …',
    );
    const built = await new Promise((resolve) => {
      const p = spawn(
        process.execPath,
        // ★用 vite 的 **JS 入口**（`vite/bin/vite.js`），而不是 `.bin/vite`：后者是
        //   `#!/bin/sh` 包装脚本，经 `process.execPath`（node）执行会 SyntaxError
        //   （实测 `missing ) after argument list`）⇒ 「dist 缺失才 build」这条路径
        //   此前**从未被真正走过**（dist 一直在时被跳过）。
        [join(webRepoRoot, 'host', 'node_modules', 'vite', 'bin', 'vite.js'), 'build'],
        { cwd: join(webRepoRoot, 'host'), stdio: 'inherit', env: process.env },
      );
      p.once('exit', (code) => resolve(code ?? 1));
    });
    if (built !== 0 || !existsSync(distIndex)) {
      console.error('[real-server] vite build 失败或产物仍缺失');
      await stop(1);
    }
  }
  vite = await preview({
    root: join(webRepoRoot, 'host'),
    preview: {
      host: '127.0.0.1',
      port: webPort,
      strictPort: true,
    },
  });
}


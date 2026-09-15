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
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer, preview } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
// host/e2e → host → 前端仓根
const webRepoRoot = join(here, '..', '..');
// 主仓（Rust 产物所在）；可用 FMBY_E2E_MAIN_REPO 覆盖
const mainRepoRoot = process.env.FMBY_E2E_MAIN_REPO ?? '/home/tefuir/rustproject/FMBY-V2';

const backendPort = Number(process.env.FMBY_E2E_BACKEND_PORT ?? 18099);
// 前端服务端口（默认 5180；多 worktree 并行时用 FMBY_E2E_WEB_PORT 避让）。
const webPort = Number(process.env.FMBY_E2E_WEB_PORT ?? 5180);
const webOrigin = `http://127.0.0.1:${webPort}`;
const workDir = mkdtempSync(join(tmpdir(), 'fmby-e2e-real-'));
const dbPath = join(workDir, 'e2e.db');
const dataDir = join(workDir, 'data');

process.env.FMBY_BACKEND = `http://127.0.0.1:${backendPort}`;
process.env.FMBY_DB_PATH = dbPath;
process.env.FMBY_DATA_DIR = dataDir;
process.env.FMBY_BIND = `127.0.0.1:${backendPort}`;
process.env.FMBY_TRUSTED_ORIGINS = webOrigin;

/** 平台可执行后缀：Windows 为 '.exe'，其余为空串。 */
const EXE_SUFFIX = process.platform === 'win32' ? '.exe' : '';

/**
 * 解析二进制路径（环境变量覆盖 > 前端仓 target/ > 主仓 target/，跨 release+debug）。
 * 优先 release（真实构建产物），其次 debug。仍无 → null（不可用，跳过）。
 */
function resolveBinary(envKey, baseName) {
  const overridden = process.env[envKey];
  const profiles = ['release', 'debug'];
  const candidates = [overridden].filter((v) => typeof v === 'string' && v.length > 0);
  for (const root of [webRepoRoot, mainRepoRoot]) {
    for (const profile of profiles) {
      candidates.push(join(root, 'target', profile, `${baseName}${EXE_SUFFIX}`));
      candidates.push(join(root, 'target', profile, baseName));
    }
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

const serverBin = resolveBinary('FMBY_E2E_SERVER_BIN', 'fmby-v2-server');
const seedBin = resolveBinary('FMBY_E2E_SEED_BIN', 'fmby-e2e-seed');

function skip(reason) {
  console.warn(`[real-server] SKIP: ${reason}`);
  rmSync(workDir, { recursive: true, force: true });
  process.exit(0);
}

if (!serverBin) {
  skip(
    `fmby-v2-server binary not found (FMBY_E2E_SERVER_BIN / ${webRepoRoot}/target/{release,debug} / ${mainRepoRoot}/target/{release,debug}). ` +
      `Build it with 'cargo build -p fmby-v2-server' or set FMBY_E2E_SERVER_BIN.`,
  );
}
if (!seedBin) {
  skip(
    `fmby-e2e-seed binary not found (FMBY_E2E_SEED_BIN / ${webRepoRoot}/target/{release,debug} / ${mainRepoRoot}/target/{release,debug}). ` +
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
    const p = spawn(join(webRepoRoot, 'node_modules', '.bin', 'pnpm'), ['build:themes'], {
      cwd: webRepoRoot,
      stdio: 'inherit',
      env: process.env,
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

// ---- ③ 起前端（默认服务**已构建产物** host/dist，对齐卡面真实栈口径）----
// 卡面：「主仓二进制 + 前端 host/dist（已构建）」。dev server 会开 React
// StrictMode 双调用（仅 dev），在 VideoPlayer 的异步挂载上暴露竞态
// （实测：dev 下播放页 <video> 不挂载；产物构建无此双调用 → 正常挂载）。
// 产物不存在时先 build；`FMBY_E2E_DEV=1` 可回落到 dev server（调试用）。
const useDevServer = process.env.FMBY_E2E_DEV === '1';
const distIndex = join(webRepoRoot, 'host', 'dist', 'index.html');

let vite;
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
  if (!existsSync(distIndex)) {
    console.log('[real-server] host/dist 缺失，先执行 vite build …');
    const built = await new Promise((resolve) => {
      const p = spawn(
        process.execPath,
        [join(webRepoRoot, 'host', 'node_modules', '.bin', 'vite'), 'build'],
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

let stopping = false;
async function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  await Promise.allSettled([vite.close()]);
  backend.kill('SIGTERM');
  rmSync(workDir, { recursive: true, force: true });
  process.exit(exitCode);
}

process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());

// ---- 等 server 就绪（/api/auth/entry/status 应 200）----
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

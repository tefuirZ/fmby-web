/**
 * 真实 E2E 启动器：启动真实 fmby-v2-server（FMBY_E2E_SEED=1 种真实数据）+ Vite 前端。
 * 禁 mock：所有 /api 请求经 Vite proxy 打到真实 server + 真实 SQLite。
 *
 * WEB-GOV ③：二进制路径改为**跨平台解析**（原硬编码 `fmby-v2-server.exe` 为
 * Windows 残留，Linux/macOS 下必然 spawn 失败）。解析优先级：
 *   1. 环境变量 `FMBY_E2E_SERVER_BIN` / `FMBY_E2E_SEED_BIN`（显式覆盖，最高优先）；
 *   2. `<repo>/target/<profile>/fmby-v2-server${exeSuffix}`（`exeSuffix` 在 Windows
 *      为 `.exe`，其余平台为空串；profile 由 `FMBY_E2E_PROFILE` 控制，默认 debug）。
 *
 * 无服务端二进制时**跳过而非失败**（`resolveBinary` 返回 null → 退出码 0 且不拉起
 * Vite），配合 playwright 的 `skip: !hasBinary` 让 CI/本机无 Rust 产物时 e2e 被
 * 安全跳过，而不是红一片。
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

const backendPort = Number(process.env.FMBY_E2E_BACKEND_PORT ?? 18099);
const workDir = mkdtempSync(join(tmpdir(), 'fmby-e2e-real-'));
const dbPath = join(workDir, 'e2e.db');
const dataDir = join(workDir, 'data');

process.env.FMBY_BACKEND = `http://127.0.0.1:${backendPort}`;
process.env.FMBY_DB_PATH = dbPath;
process.env.FMBY_DATA_DIR = dataDir;
process.env.FMBY_BIND = `127.0.0.1:${backendPort}`;
process.env.FMBY_TRUSTED_ORIGINS = 'http://127.0.0.1:5180';

/** 平台可执行后缀：Windows 为 '.exe'，其余为空串。 */
const EXE_SUFFIX = process.platform === 'win32' ? '.exe' : '';

/**
 * 解析二进制路径（跨平台 + 环境变量覆盖）。不存在则回退为**无后缀再试一次**
 * （兼容某些构建脚本产出无扩展名产物），仍无则返回 null（表示不可用）。
 */
function resolveBinary(envKey, baseName) {
  const overridden = process.env[envKey];
  const profile = process.env.FMBY_E2E_PROFILE ?? 'debug';
  const candidates = [
    overridden,
    join(repoRoot, 'target', profile, `${baseName}${EXE_SUFFIX}`),
    join(repoRoot, 'target', profile, baseName),
  ].filter((value) => typeof value === 'string' && value.length > 0);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

const serverBin = resolveBinary('FMBY_E2E_SERVER_BIN', 'fmby-v2-server');
const seedBin = resolveBinary('FMBY_E2E_SEED_BIN', 'fmby-e2e-seed');

if (!serverBin) {
  // 无服务端二进制：跳过（退出 0），由 playwright 侧 skip 判定同步。
  console.warn(
    `[real-server] SKIP: fmby-v2-server binary not found ` +
      `(tried FMBY_E2E_SERVER_BIN / target/${process.env.FMBY_E2E_PROFILE ?? 'debug'}/fmby-v2-server${EXE_SUFFIX}). ` +
      `Build it with 'cargo build -p fmby-v2-server' or set FMBY_E2E_SERVER_BIN.`,
  );
  rmSync(workDir, { recursive: true, force: true });
  process.exit(0);
}
if (!seedBin) {
  console.warn(
    `[real-server] SKIP: fmby-e2e-seed binary not found ` +
      `(tried FMBY_E2E_SEED_BIN / target/${process.env.FMBY_E2E_PROFILE ?? 'debug'}/fmby-e2e-seed${EXE_SUFFIX}). ` +
      `Build it with 'cargo build -p fmby-e2e-seed' or set FMBY_E2E_SEED_BIN.`,
  );
  rmSync(workDir, { recursive: true, force: true });
  process.exit(0);
}

const backend = spawn(serverBin, [], {
  stdio: 'inherit',
  env: process.env,
});
backend.on('exit', (code) => {
  console.error(`[real-server] exited ${code}`);
  process.exit(code ?? 1);
});

const vite = await createServer({
  root: process.cwd(),
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
  },
});
await vite.listen();

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

// 等待真实 server 就绪（/api/auth/entry/status 应 200）
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

const seed = spawn(seedBin, [dbPath, dataDir], { stdio: 'inherit', env: process.env });
const seedExit = await new Promise((resolve) => seed.once('exit', resolve));
if (seedExit !== 0) {
  await stop(1);
}
console.log('[real-server] explicit E2E seed complete');

// 真实 E2E 启动器：启动真实 fmby-v2-server（FMBY_E2E_SEED=1 种真实数据）+ Vite 前端。
// 禁 mock：所有 /api 请求经 Vite proxy 打到真实 server + 真实 SQLite。

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const backendPort = Number(process.env.FMBY_E2E_BACKEND_PORT ?? 18099);
const workDir = mkdtempSync(join(tmpdir(), 'fmby-e2e-real-'));
const dbPath = join(workDir, 'e2e.db');
const dataDir = join(workDir, 'data');

process.env.FMBY_BACKEND = `http://127.0.0.1:${backendPort}`;
process.env.FMBY_DB_PATH = dbPath;
process.env.FMBY_DATA_DIR = dataDir;
process.env.FMBY_BIND = `127.0.0.1:${backendPort}`;
process.env.FMBY_TRUSTED_ORIGINS = 'http://127.0.0.1:5180';

const serverBin = process.env.FMBY_SERVER_BIN ?? join(repoRoot, 'target', 'debug', 'fmby-v2-server.exe');
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
for (let i = 0; i < 100; i++) {
  try {
    const resp = await fetch(readyUrl);
    if (resp.ok) {
      console.log(`[real-server] ready at ${process.env.FMBY_BACKEND}`);
      break;
    }
  } catch {
    // not ready yet
  }
  await new Promise((r) => setTimeout(r, 200));
}

const seedBin = process.env.FMBY_E2E_SEED_BIN ?? join(repoRoot, 'target', 'debug', 'fmby-e2e-seed.exe');
const seed = spawn(seedBin, [dbPath, dataDir], { stdio: 'inherit', env: process.env });
const seedExit = await new Promise((resolve) => seed.once('exit', resolve));
if (seedExit !== 0) {
  await stop(1);
}
console.log('[real-server] explicit E2E seed complete');

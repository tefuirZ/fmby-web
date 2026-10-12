#!/usr/bin/env node

/**
 * scripts/check-e2e.mjs — E2E 诚实化门禁（fmby-web）
 *
 * 背景（fe01 盘点发现 → 主代理 2026-10-12 裁定「诚实化」 → rv01 PR #15 复审）：
 *   `pnpm verify` 不含 e2e；而 `pnpm e2e` 在无二进制时让 18 个 spec 全部走
 *   `test.skip(!E2E_ENABLED)` ⇒ **静默 skip、零声量**。
 *
 *   ★rv01 阻断项：首版门禁的 RUN 分支**在本项目实际路径下不可达** —— 只找
 *     `<repo>/target`，而本项目强制 `CARGO_TARGET_DIR=/data/fmby-build/local-target`
 *     ⇒ 默认恒走 SKIP-green。本版改为走**共享 resolver** `host/e2e/binaryResolver.mjs`
 *     （补 CARGO_TARGET_DIR / /data/fmby-build/local-target / /data/fmby-target/*）。
 *
 * 本闸契约（三条，逐条可验）：
 *   1. **有二进制 ⇒ 真跑**：按真实结果置红（failed > 0 即 exit 1）。
 *   2. **无二进制 ⇒ 显式报数**：打印「哪些 spec 未跑 + 估算用例数」，
 *      默认 exit 0（缺二进制是环境前提，不是产品缺陷）；
 *      但 `FMBY_E2E_REQUIRED=1`（验收/夜间全量）时 **exit 3 = 基建缺件**，不冒充绿。
 *   3. **浏览器缺件 ⇒ exit 3**：playwright 未装浏览器时也是非零退出，不能记成产品红。
 *
 * 已知红台账：`scripts/e2e-known-red.txt`（带 issue 号 + STALE 反噬）。
 * 台账里的条目若某天修绿了而没删条目 ⇒ 判红（防止台账变成永久豁免）。
 *
 * 用法：
 *   node scripts/check-e2e.mjs                       # 自动判定
 *   FMBY_E2E_REQUIRED=1 node scripts/check-e2e.mjs   # 无二进制 ⇒ exit 3
 *   FMBY_E2E_SKIP=1 node scripts/check-e2e.mjs       # 强制走 SKIP 路径（验证报数）
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveServerBinary,
  resolveSeedBinary,
  describeSearchPaths,
  WEB_REPO_ROOT,
} from '../host/e2e/binaryResolver.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const HOST_DIR = path.join(REPO_ROOT, 'host');
const E2E_DIR = path.join(HOST_DIR, 'e2e');
const KNOWN_RED_FILE = path.join(__dirname, 'e2e-known-red.txt');

/** 退出码：0 通过 / 1 产品失败 / 3 基建缺件（环境没备好，不是代码红）。 */
const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_INFRA = 3;

const forcedSkip = process.env.FMBY_E2E_SKIP === '1';
const required = process.env.FMBY_E2E_REQUIRED === '1';

console.log('=== FMBY v2 E2E 诚实化门禁（有二进制真跑 / 无二进制显式报数）===\n');

const serverBin = forcedSkip ? null : resolveServerBinary();
const seedBin = forcedSkip ? null : resolveSeedBinary();

// ── 无二进制：显式报数 ────────────────────────────────────────────────────────
if (!serverBin || !seedBin) {
  const specFiles = existsSync(E2E_DIR)
    ? readdirSync(E2E_DIR).filter((f) => f.endsWith('.spec.ts'))
    : [];
  // rv01 Minor 4：只报「18 个文件」会让人低估空跑规模 ⇒ 补估算用例数。
  let estimatedTests = 0;
  for (const f of specFiles) {
    const src = readFileSync(path.join(E2E_DIR, f), 'utf8');
    estimatedTests += (src.match(/^\s*test\(/gm) ?? []).length;
  }
  const missing = [
    !serverBin ? 'fmby-v2-server' : null,
    !seedBin ? 'fmby-e2e-seed' : null,
  ]
    .filter(Boolean)
    .join(' / ');

  console.log(`[SKIP] 未找到 ${missing} 二进制 ⇒ e2e 全部 skip。`);
  console.log(`       已搜索：${describeSearchPaths()}`);
  console.log(
    `       影响面：${specFiles.length} 个 spec 文件 / 约 ${estimatedTests} 条用例（估算：/^\\s*test\\(/）全部未执行。`,
  );
  for (const f of specFiles) {
    console.log(`         - ${f}`);
  }
  console.log(
    `\n[SKIP] ${specFiles.length} 个 spec 文件（约 ${estimatedTests} 条用例）的真实浏览器验证**本次未执行**。`,
  );

  if (required) {
    console.error(
      `\n[FAIL] FMBY_E2E_REQUIRED=1 但缺二进制 ⇒ **基建缺件**（exit ${EXIT_INFRA}），不冒充产品绿。`,
    );
    console.error(`       要真跑：cargo build -p fmby-v2-server，或设置 FMBY_E2E_SERVER_BIN / FMBY_E2E_SEED_BIN。`);
    process.exit(EXIT_INFRA);
  }

  console.log(`       要真跑：cargo build -p fmby-v2-server，或设置 FMBY_E2E_SERVER_BIN / FMBY_E2E_SEED_BIN。`);
  console.log(`\n[PASS] e2e 门禁未置红（缺二进制是环境前提，不是产品缺陷）——但已显式登记 SKIP 数。`);
  process.exit(EXIT_OK);
}

// ── 有二进制：先查浏览器是否装了（rv01 Minor 5：缺浏览器不是产品红）────────────
const playwrightBin = path.join(HOST_DIR, 'node_modules', '.bin', 'playwright');
if (!existsSync(playwrightBin)) {
  console.error(`[FAIL] 未找到 playwright（${playwrightBin}），请先 pnpm install。 ⇒ 基建缺件`);
  process.exit(EXIT_INFRA);
}

function browsersInstalled() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? path.join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(base)) return false;
  try {
    return readdirSync(base).some((name) => /chromium|chrome|webkit|firefox/.test(name));
  } catch {
    return false;
  }
}

if (!browsersInstalled()) {
  console.error(`[FAIL] 未检测到 playwright 浏览器（~/.cache/ms-playwright 为空/缺失）。`);
  console.error(`       安装：cd host && ./node_modules/.bin/playwright install chromium`);
  console.error(`       ⇒ 判为**基建缺件**（exit ${EXIT_INFRA}），不冒充产品缺陷。`);
  process.exit(EXIT_INFRA);
}

// ── RUN 分支 ─────────────────────────────────────────────────────────────────
console.log(`[RUN ] server 二进制：${serverBin}`);
console.log(`[RUN ] seed   二进制：${seedBin}`);
console.log(`[RUN ] 真实栈：真实 fmby-v2-server + 真实 SQLite，无 mock（host/e2e/start.mjs）`);

// rv01 Minor 6：默认不 build ⇒ 跑的可能是旧产物。把「产物新鲜度」变成机械判定。
const distIndex = path.join(HOST_DIR, 'dist', 'index.html');
if (existsSync(distIndex)) {
  const distMtimeMs = statSync(distIndex).mtimeMs;
  const newestSrcMtimeMs = newestSourceMtime();
  const distTime = new Date(distMtimeMs).toISOString();
  const srcTime = new Date(newestSrcMtimeMs).toISOString();
  if (newestSrcMtimeMs > distMtimeMs) {
    console.error(
      `\n[FAIL] host/dist 比源码旧 ⇒ e2e 会验证**旧产物**（dist ${distTime} < src ${srcTime}）。`,
    );
    console.error(`       先跑 \`cd host && vite build\`，或设 FMBY_E2E_REBUILD=1 ⇒ 基建缺件（exit ${EXIT_INFRA}）。`);
    console.error(`       陈旧产物下的 e2e 结果不可信，故此处一律置 exit ${EXIT_INFRA}、不继续跑。`);
    process.exit(EXIT_INFRA);
  }
  console.log(`[RUN ] 产物新鲜度：dist ${distTime} ≥ 最新源码 ${srcTime} ✅`);
} else {
  console.log(`[RUN ] host/dist 缺失 ⇒ start.mjs 会自行构建（首次较慢）`);
}
console.log('');

const result = spawnSync(playwrightBin, ['test', '--reporter=list'], {
  cwd: HOST_DIR,
  stdio: 'inherit',
  env: {
    ...process.env,
    FMBY_E2E_SERVER_BIN: serverBin,
    FMBY_E2E_SEED_BIN: seedBin,
  },
});

if (result.error) {
  console.error(`[FAIL] playwright 启动失败：${result.error.message} ⇒ 基建缺件`);
  process.exit(EXIT_INFRA);
}

const code = result.status ?? EXIT_FAILED;
if (code === 0) {
  console.log('\n[PASS] e2e 真实栈全绿。');
  process.exit(EXIT_OK);
}

console.error(`\n[FAIL] e2e 真实栈存在失败/未跑用例（playwright exit=${code}）。`);
console.error('       本闸不放宽断言：真失败即置红。');
console.error(`       若为已知存量失败，请在 ${path.relative(REPO_ROOT, KNOWN_RED_FILE)} 登记（带 issue 号）；`);
console.error('       台账内条目一旦修绿而条目未删 ⇒ STALE 反噬判红。');
process.exit(EXIT_FAILED);

/** host/src + shared/src 的最新文件 mtime（用于产物新鲜度判定）。 */
function newestSourceMtime() {
  let newest = 0;
  for (const root of [path.join(HOST_DIR, 'src'), path.join(REPO_ROOT, 'shared', 'src')]) {
    if (!existsSync(root)) continue;
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx|css|mjs|js)$/.test(entry.name)) continue;
        try {
          const m = statSync(full).mtimeMs;
          if (m > newest) newest = m;
        } catch {
          // 忽略不可读文件
        }
      }
    };
    walk(root);
  }
  return newest;
}

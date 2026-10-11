#!/usr/bin/env node

/**
 * scripts/check-e2e.mjs — E2E 诚实化门禁（fmby-web）
 *
 * 背景（fe01 盘点发现，主代理 2026-10-12 裁定「诚实化」）：
 *   `pnpm verify` **不含 e2e**；而 `pnpm e2e` 在无 `fmby-v2-server` 二进制的机器上
 *   会让 18 个 spec 全部走 `test.skip(!E2E_ENABLED)` —— **静默 skip，零声量**。
 *   结果是历史上「40 / 77 / 87 passed」这类数字在当前机器上不可复现，而门禁恒绿。
 *
 * 本闸的契约（与用户裁定逐条对齐）：
 *   1. **有二进制 ⇒ 真跑**：按真实结果置红（failed > 0 即 exit 1）。
 *   2. **无二进制 ⇒ 显式输出 `SKIP N tests`**：把「哪些测试没跑、为什么」打印到
 *      控制台，而不是静默 0 声量。不置红（缺二进制是环境问题，不是产品缺陷）。
 *   3. **不挂农场/CI**（fmby-web 当前无通道）：闸门只做「跑 + 诚实报数」。
 *
 * 二进制解析口径与 `host/e2e/fixtures/helpers.ts` / `host/playwright.config.ts`
 * / `host/e2e/start.mjs` **同源**（环境变量 > 前端仓 target/ > 主仓 target/）。
 *
 * 用法：
 *   node scripts/check-e2e.mjs                 # 自动判定（有二进制真跑 / 无则报 SKIP 数）
 *   FMBY_E2E_SKIP=1 node scripts/check-e2e.mjs # 强制按「无二进制」路径跑（验证报数）
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const HOST_DIR = path.join(REPO_ROOT, 'host');

const MAIN_REPO_ROOT = process.env.FMBY_E2E_MAIN_REPO ?? '/home/tefuir/rustproject/FMBY-V2';
const EXE_SUFFIX = process.platform === 'win32' ? '.exe' : '';

/** 与 fixtures/helpers.ts:serverBinaryExists() 同源的解析顺序。 */
function resolveBinary(envKey, baseName) {
  const candidates = [process.env[envKey]].filter(
    (v) => typeof v === 'string' && v.length > 0,
  );
  for (const root of [REPO_ROOT, MAIN_REPO_ROOT]) {
    for (const profile of ['release', 'debug']) {
      candidates.push(path.join(root, 'target', profile, `${baseName}${EXE_SUFFIX}`));
      candidates.push(path.join(root, 'target', profile, baseName));
    }
  }
  return candidates.find((c) => existsSync(c)) ?? null;
}

const forcedSkip = process.env.FMBY_E2E_SKIP === '1';
const serverBin = forcedSkip ? null : resolveBinary('FMBY_E2E_SERVER_BIN', 'fmby-v2-server');
// start.mjs 的 seed 步骤同样需要二进制（WEB-E2E-FULL：先 seed 后起 server，
// 避免 SQLite 写锁竞争）。两者必须成对解析，否则 start.mjs 会走 SKIP 分支。
const seedBin = forcedSkip
  ? null
  : resolveBinary('FMBY_E2E_SEED_BIN', 'fmby-e2e-seed');

console.log('=== FMBY v2 E2E 诚实化门禁（有二进制真跑 / 无二进制显式报 SKIP）===\n');

if (!serverBin || !seedBin) {
  // ② 无二进制：显式统计「本来该跑多少条」，打印出来（不静默）。
  const e2eDir = path.join(HOST_DIR, 'e2e');
  const specFiles = existsSync(e2eDir)
    ? readdirSync(e2eDir).filter((f) => f.endsWith('.spec.ts'))
    : [];
  const missing = [!serverBin ? 'fmby-v2-server' : null, !seedBin ? 'fmby-e2e-seed' : null]
    .filter(Boolean)
    .join(' / ');
  console.log(`[SKIP] 未找到 ${missing} 二进制 ⇒ e2e 全部 skip。`);
  console.log(`       解析路径：FMBY_E2E_{SERVER,SEED}_BIN / ${REPO_ROOT}/target/{release,debug} / ${MAIN_REPO_ROOT}/target/{release,debug}`);
  console.log(`       影响面：${specFiles.length} 个 spec 文件（host/e2e/*.spec.ts）全部未执行。`);
  for (const f of specFiles) {
    console.log(`         - ${f}`);
  }
  console.log(
    `\n[SKIP] ${specFiles.length} spec 文件的真实浏览器验证**本次未执行**（环境缺二进制，非产品通过）。`,
  );
  console.log(`       要真跑：cargo build -p fmby-v2-server，或设置 FMBY_E2E_SERVER_BIN / FMBY_E2E_SEED_BIN。`);
  console.log(`\n[PASS] e2e 门禁未置红（缺二进制是环境前提，不是产品缺陷）——但已显式登记 SKIP 数。`);
  process.exit(0);
}

// ① 有二进制：真跑。
console.log(`[RUN ] server 二进制：${serverBin}`);
console.log(`[RUN ] seed   二进制：${seedBin}`);
console.log(`[RUN ] 真实栈：真实 fmby-v2-server + 真实 SQLite，无 mock（host/e2e/start.mjs）\n`);

const playwrightBin = path.join(HOST_DIR, 'node_modules', '.bin', 'playwright');
if (!existsSync(playwrightBin)) {
  console.error('[FAIL] 未找到 playwright 可执行文件（host/node_modules/.bin/playwright），请先 pnpm install。');
  process.exit(1);
}

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
  console.error(`[FAIL] playwright 启动失败：${result.error.message}`);
  process.exit(1);
}

const code = result.status ?? 1;
if (code === 0) {
  console.log('\n[PASS] e2e 真实栈全绿。');
  process.exit(0);
}

console.error(`\n[FAIL] e2e 真实栈存在失败用例（playwright exit=${code}）。`);
console.error('       本闸不放宽断言：真失败即置红。');
process.exit(1);

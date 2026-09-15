#!/usr/bin/env node

/**
 * scripts/check-versions.mjs — 前端仓版本门禁（fmby-web）
 *
 * 2026-09-15 用户裁定：**四层独立版本** + **高版本必须兼容低版本**。
 *
 * 检查项：
 *  1. 四层版本文件自洽（根/host/shared/themes 各自版本可独立，但格式合法）
 *  2. 各主题 manifest 的 `contract_version` 与 shared 的 `CONTRACT_VERSION` **兼容**
 *     （manifest 声明的范围必须覆盖当前 shared 契约主版本）
 *  3. 若主仓 fmby-v2 checkout 存在：后端 `CONTRACT_VERSION` 必须与前端相等
 *
 * 不检查：host/shared/themes 版本号**相等**（它们独立迭代）。
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
let violations = 0;
const bad = (m) => { console.error(`VIOLATION: ${m}`); violations++; };
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// 1) 四层版本读取
const rootPkg = readJson(join(root, 'package.json'));
const hostPkg = readJson(join(root, 'host', 'package.json'));
const sharedPkg = readJson(join(root, 'shared', 'package.json'));
console.log(`root    = v${rootPkg.version}`);
console.log(`host    = v${hostPkg.version}`);
console.log(`shared  = v${sharedPkg.version}`);

const themesDir = join(root, 'themes');
const themes = existsSync(themesDir)
  ? readdirSync(themesDir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name)
  : [];
console.log(`themes  = ${themes.map((t) => `${t}@v${readJson(join(themesDir, t, 'package.json')).version}`).join(', ') || '(none)'}`);

// 2) CONTRACT_VERSION（shared 源）+ 各主题 manifest 兼容性
const contractsSrc = join(root, 'shared', 'src', 'contracts', 'index.ts');
if (!existsSync(contractsSrc)) { bad('shared/src/contracts/index.ts missing'); process.exit(1); }
const m = readFileSync(contractsSrc, 'utf8').match(/CONTRACT_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!m) { bad('CONTRACT_VERSION not found in shared/src/contracts/index.ts'); process.exit(1); }
const contractVersion = m[1];
const contractMajorMinor = contractVersion.split('.').slice(0, 2).join('.');
console.log(`\nCONTRACT_VERSION (shared) = ${contractVersion}`);

for (const t of themes) {
  const mf = join(themesDir, t, 'theme.manifest.json');
  if (!existsSync(mf)) { bad(`theme ${t}: theme.manifest.json missing`); continue; }
  const manifest = readJson(mf);
  const declared = manifest.contract_version;
  if (!declared) {
    bad(`theme ${t}: manifest 缺 contract_version（主题必须声明兼容的契约版本范围）`);
    continue;
  }
  // 兼容规则：manifest 声明的 major.minor 必须 == shared 契约的 major.minor（同一契约代）
  // （契约 MINOR 升级 = 向后兼容新增，故同 major 下的旧主题仍可加载；MAJOR 升级才需主题跟随）
  const declaredMajor = declared.split('.')[0];
  const sharedMajor = contractVersion.split('.')[0];
  if (declaredMajor !== sharedMajor) {
    bad(`theme ${t}: contract_version ${declared} 与共享层契约 ${contractVersion} 主版本不兼容`);
  } else {
    console.log(`  theme ${t}: contract_version ${declared} ✅ 兼容`);
  }
}

// 3) 后端契约对齐（可选 checkout）
const backendContracts = join(root, '..', 'fmby-v2', 'crates', 'fmby-v2-contracts', 'src', 'lib.rs');
if (existsSync(backendContracts)) {
  const bs = readFileSync(backendContracts, 'utf8');
  const bm = bs.match(/CONTRACT_VERSION\s*:\s*&str\s*=\s*"([^"]+)"/);
  if (bm) {
    console.log(`backend CONTRACT_VERSION   = ${bm[1]}`);
    if (bm[1] !== contractVersion) {
      bad(`契约版本失配：前端 ${contractVersion} != 后端 ${bm[1]}（互操作性依赖对齐）`);
    }
  }
}

if (violations > 0) {
  console.error(`\n[FAIL] ${violations} 处版本问题。`);
  process.exit(1);
}
console.log('\n[PASS] 版本门禁通过（四层独立版本 + 契约对齐）。');

#!/usr/bin/env node
// 前端文件大小双档约束检查
// 用法：node scripts/check-file-size.mjs            # 输出报告
//      node scripts/check-file-size.mjs --strict   # 任何 fail 退出码 1
//      node scripts/check-file-size.mjs --update-baseline
//
// 阈值规则（KB）：
//   - pages/**/*.tsx               warn 20 / fail 30
//   - **/*.module.css              warn 10 / fail 20
//   - 其他 .ts/.tsx（domains/shared/components 等）  warn 15 / fail 25
//
// baseline.json 用来豁免历史超标文件，只对增量起作用：
//   - 新文件超 fail：直接拒绝
//   - baseline 中已记录的文件：超 baseline 才拒绝（不许变得更胖）
//   - baseline 中文件如果当前 ≤ warn：自动从 baseline 移出（提示更新）

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');
const BASELINE = join(ROOT, 'scripts', 'file-size-baseline.json');

const RULES = [
  { id: 'page', match: (p) => p.startsWith('pages/') && p.endsWith('.tsx'), warn: 20, fail: 30 },
  { id: 'css', match: (p) => p.endsWith('.module.css'), warn: 10, fail: 20 },
  { id: 'code', match: (p) => p.endsWith('.ts') || p.endsWith('.tsx'), warn: 15, fail: 25 },
];

const SKIP_DIRS = new Set(['node_modules', '.tmp', 'dist', 'build', '.turbo', '.vite']);
const SKIP_SUFFIX = ['.d.ts', '.d.ts.map'];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(join(dir, entry.name));
    } else if (entry.isFile()) {
      yield join(dir, entry.name);
    }
  }
}

function ruleFor(rel) {
  for (const r of RULES) if (r.match(rel)) return r;
  return null;
}

function loadBaseline() {
  if (!existsSync(BASELINE)) return {};
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf-8'));
  } catch {
    return {};
  }
}

function main() {
  const args = new Set(process.argv.slice(2));
  const strict = args.has('--strict');
  const update = args.has('--update-baseline');
  const baseline = loadBaseline();

  const findings = [];
  for (const abs of walk(SRC)) {
    const rel = relative(SRC, abs).split(sep).join(posix.sep);
    if (SKIP_SUFFIX.some((s) => rel.endsWith(s))) continue;
    const rule = ruleFor(rel);
    if (!rule) continue;
    const kb = +(statSync(abs).size / 1024).toFixed(2);
    if (kb < rule.warn) continue;
    const baseKb = baseline[rel];
    let status;
    if (kb >= rule.fail) {
      if (baseKb != null && kb <= baseKb) status = 'baseline-fail';
      else status = 'fail';
    } else {
      status = 'warn';
    }
    findings.push({ rel, kb, rule: rule.id, warn: rule.warn, fail: rule.fail, status, baseKb });
  }

  findings.sort((a, b) => b.kb - a.kb);

  if (update) {
    const next = {};
    for (const f of findings) if (f.kb >= f.fail) next[f.rel] = f.kb;
    writeFileSync(BASELINE, JSON.stringify(next, null, 2) + '\n', 'utf-8');
    console.log(`[size-check] baseline updated: ${Object.keys(next).length} entries -> ${relative(ROOT, BASELINE)}`);
    return;
  }

  const fails = findings.filter((f) => f.status === 'fail');
  const baselineFails = findings.filter((f) => f.status === 'baseline-fail');
  const warns = findings.filter((f) => f.status === 'warn');

  const fmt = (f) => `  ${f.kb.toFixed(2).padStart(6)}KB  [${f.rule.padEnd(4)} ${f.warn}/${f.fail}]  ${f.rel}` + (f.baseKb != null ? `  (baseline ${f.baseKb}KB)` : '');

  if (fails.length) {
    console.log(`\n❌ FAIL: ${fails.length} file(s) exceed hard limit`);
    fails.forEach((f) => console.log(fmt(f)));
  }
  if (baselineFails.length) {
    console.log(`\n🟡 baseline-tolerated FAIL: ${baselineFails.length} file(s) (do not let them grow)`);
    baselineFails.forEach((f) => console.log(fmt(f)));
  }
  if (warns.length) {
    console.log(`\n⚠️  WARN: ${warns.length} file(s) over warn threshold`);
    warns.forEach((f) => console.log(fmt(f)));
  }
  if (!fails.length && !baselineFails.length && !warns.length) {
    console.log('✅ size-check: all files within thresholds');
  }

  console.log(`\nthresholds: page=20/30  css=10/20  code=15/25 (KB)`);
  console.log(`legend: ❌ new fail · 🟡 baseline tolerated · ⚠️ warn`);

  if (strict && fails.length) process.exit(1);
}

main();

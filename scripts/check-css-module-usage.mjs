#!/usr/bin/env node

/**
 * scripts/check-css-module-usage.mjs — CSS Module「用了但没定义」门禁
 *
 * 背景（rv01 在 PR #15 顺手挖到，同族于 P0-1 的根因形态）：
 *   `styles.X` 在 CSS module 里**没有定义** ⇒ 值为 `undefined` ⇒
 *   `className={undefined}` ⇒ 元素**裸奔无样式**，且**零报错**：
 *     · 运行时不报（React 只是不写 class）；
 *     · axe 管不着（不是可访问性问题）；
 *     · check-frontend-dupes 管主题纯度，不管这个；
 *     · tsc 也管不着（CSS module 的导出面是 any）。
 *   ⇒ 只能靠**机械闸**防。
 *
 * 口径（棘轮 + 存量台账，照 check-frontend-component-size.mjs 的 RB-2 思路）：
 *   1. 扫 host/src + shared/src 的 .tsx/.ts；
 *   2. 解析 `import <alias> from '<...>.module.css'`（也认 `styles` 别名与
 *      `@import`/`composes` 产生的**导出面**）；
 *   3. 收集 `<alias>.<name>` 用法（含模板串 `${styles.x}`、clsx/对象展开里的成员）；
 *   4. 与 CSS 文件的**选择器类集合**做差集；
 *   5. 差集命中 ⇒ 按台账判定：
 *        · 在 `KNOWN_MISSING` 台账里 ⇒ WARN（存量债务，不阻塞）；
 *        · 不在台账里（**新增**）⇒ FAIL；
 *        · 台账里的条目若已修好（不再缺失）⇒ **STALE 反噬 FAIL**
 *          （台账不是永久豁免，修绿必须删条目）。
 *
 * 用法：
 *   node scripts/check-css-module-usage.mjs
 *   node scripts/check-css-module-usage.mjs --update-baseline   # 重写存量台账
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join(__dirname, 'css-module-usage-baseline.txt');

const SCAN_ROOTS = [
  path.join(REPO_ROOT, 'host', 'src'),
  path.join(REPO_ROOT, 'shared', 'src'),
];
const EXTS = ['.tsx', '.ts'];

/**
 * 存量台账（棘轮基线）。格式：`<相对路径>|<类名>`，# 开头为注释。
 * 修好一处 ⇒ 从本文件删掉对应行（否则 STALE 反噬判红）。
 */
function readBaseline() {
  if (!existsSync(BASELINE_FILE)) return new Set();
  const out = new Set();
  for (const line of readFileSync(BASELINE_FILE, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    out.add(trimmed);
  }
  return out;
}

/** 递归列出文件。 */
async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      out.push(...(await walk(full)));
    } else if (EXTS.some((e) => entry.name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * 取 CSS module 中**定义的类名集合**。
 * 只取「选择器位置」的 .class（即在 `{` 之前、且不在声明块内），
 * 以包含 `.a.b`、`.a .b`、`.a:hover` 等复合形态；排除注释里的伪命中。
 */
function cssDefinedClasses(src) {
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = new Set();
  let depth = 0;
  let buf = '';
  for (const ch of noComments) {
    if (ch === '{') {
      if (depth === 0) {
        for (const m of buf.matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)) out.add(m[1]);
      }
      depth += 1;
      buf = '';
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1);
      buf = '';
    } else if (depth === 0) {
      buf += ch;
    }
  }
  // `composes: foo from './x.module.css'` 的行内引用也算「已定义」（经本文件导出）
  for (const m of noComments.matchAll(/composes:\s*([^;]+);/g)) {
    for (const name of m[1].split(/\s+/)) {
      if (name && name !== 'from' && !name.includes('/') && !name.endsWith('.css')) out.add(name);
    }
  }
  return out;
}

/** 收集一个源文件里「CSS module 别名 → 用法类名」以及别名绑定的 css 文件。 */
function collectUsages(src, filePath) {
  /** @type {Map<string, string>} alias -> cssAbsPath */
  const aliasToCss = new Map();
  for (const m of src.matchAll(
    /import\s+(\w+)\s+from\s+['"](\.{1,2}\/[^'"]*?\.module\.css|\.{1,2}\/[^'"]*?\.module\.css)['"]/g,
  )) {
    aliasToCss.set(m[1], path.resolve(path.dirname(filePath), m[2]));
  }
  // 也认 `import styles from './X.module.css'` 之外的命名（如 cardStyles / sharedStyles）
  if (aliasToCss.size === 0) return [];
  const usages = new Map(); // alias -> Set<className>
  for (const alias of aliasToCss.keys()) {
    const set = new Set();
    // alias.name（含对象展开/模板串成员）
    for (const m of src.matchAll(new RegExp(`\\b${alias}\\.([A-Za-z_][A-Za-z0-9_]*)`, 'g'))) {
      set.add(m[1]);
    }
    // 模板串 ${alias.name}
    for (const m of src.matchAll(new RegExp(`\\$\\{\\s*${alias}\\.([A-Za-z_][A-Za-z0-9_]*)`, 'g'))) {
      set.add(m[1]);
    }
    if (set.size) usages.set(alias, set);
  }
  return [...usages.entries()].map(([alias, names]) => ({
    alias,
    cssPath: aliasToCss.get(alias),
    names: [...names],
  }));
}

async function main() {
  const updateBaseline = process.argv.includes('--update-baseline');
  const baseline = readBaseline();
  const files = [];
  for (const root of SCAN_ROOTS) files.push(...(await walk(root)));

  const findings = []; // { file, css, missing }
  const cssCache = new Map();

  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes('.module.css')) continue;
    for (const { alias, cssPath, names } of collectUsages(src, file)) {
      if (!cssPath || !existsSync(cssPath)) continue;
      if (!cssCache.has(cssPath)) {
        cssCache.set(cssPath, cssDefinedClasses(readFileSync(cssPath, 'utf8')));
      }
      const defined = cssCache.get(cssPath);
      const missing = names.filter((n) => !defined.has(n) && n !== 'default');
      if (missing.length) {
        findings.push({
          file: path.relative(REPO_ROOT, file),
          css: path.relative(REPO_ROOT, cssPath),
          alias,
          missing,
        });
      }
    }
  }

  console.log('=== FMBY v2 CSS Module 用法门禁（styles.X 必须已在 module 中定义）===\n');
  console.log(`[1] 扫描 ${files.length} 个源文件（host/src + shared/src 的 .tsx/.ts）`);
  console.log(`[2] 发现 ${findings.length} 个文件存在未定义类引用\n`);

  const newOffenders = [];
  const staleEntries = new Set(baseline);

  for (const f of findings) {
    const keys = f.missing.map((n) => `${f.file}|${n}`);
    const known = keys.filter((k) => baseline.has(k));
    const unknown = keys.filter((k) => !baseline.has(k));
    if (unknown.length) {
      newOffenders.push({ ...f, missing: unknown.map((k) => k.split('|')[1]) });
    }
    for (const k of known) staleEntries.delete(k);
    console.log(
      `  ${f.file}\n     css=${f.css} (alias=${f.alias})\n` +
        `     存量(${known.length}): ${known.map((k) => k.split('|')[1]).join(', ') || '—'}\n` +
        `     新增(${unknown.length}): ${unknown.map((k) => k.split('|')[1]).join(', ') || '—'}`,
    );
  }

  if (updateBaseline) {
    const lines = ['# CSS Module 存量台账（用了但没定义的类）—— 修好一处请删掉对应行', '# 格式：<相对路径>|<类名>'];
    for (const f of findings) {
      for (const n of f.missing) lines.push(`${f.file}|${n}`);
    }
    writeFileSync(BASELINE_FILE, `${lines.join('\n')}\n`);
    console.log(`\n[update-baseline] 已写入 ${findings.reduce((a, f) => a + f.missing.length, 0)} 条 → ${path.relative(REPO_ROOT, BASELINE_FILE)}`);
    return 0;
  }

  let fail = false;
  if (newOffenders.length) {
    fail = true;
    console.error(`\n[FAIL] ${newOffenders.length} 个文件出现**新增**的未定义类引用：`);
    for (const f of newOffenders) {
      console.error(`  - ${f.file} → ${f.missing.join(', ')}（css: ${f.css}）`);
    }
    console.error('\n       `styles.X` 未定义 ⇒ className=undefined ⇒ 元素无样式且零报错。');
    console.error('       修法：在对应 module.css 补定义，或改引用为已存在的类。');
  }
  if (staleEntries.size) {
    fail = true;
    console.error(`\n[FAIL] 台账中 ${staleEntries.size} 条已修好但仍留在基线（STALE 反噬）：`);
    for (const k of staleEntries) console.error(`  - ${k}`);
    console.error('\n       修绿了就删条目 —— 台账不是永久豁免。');
  }
  if (fail) {
    console.error('\n[FAIL] CSS module 用法门禁未通过。');
    return 1;
  }
  console.log('\n[PASS] 无新增未定义类引用；台账无 STALE 条目。');
  return 0;
}

main().then((code) => process.exit(code));

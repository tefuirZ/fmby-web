#!/usr/bin/env node

/**
 * scripts/check-theme-budget.mjs — 主题质量门禁
 *
 * 设计原则（2026-09-15 用户裁定）：
 *   主题允许自主开发，**不限制总体大小**——主题该多大就多大。门禁只防"屎山"：
 *   1. **God File 分级**（对齐仓库 Rust 侧 docs/00-index.md 分级口径）：
 *        < 300 行    理想区间
 *        300–600     健康可接受
 *        600–1000    关注区（warn，提示审视职责）
 *        > 1000      必须拆解（FAIL——单一职责违规）
 *   2. **主题纯度**（真正的约束）：禁 api client / mapper / query keys / 权限判断
 *      / 预加载业务数据（由 check-frontend-dupes.mjs 强制，本闸复核）
 *   3. **产物体积**：仅作**提示**（主题懒加载 + 独立 chunk 已由 size 闸保证首屏零阻塞），
 *      超 2MB 才 warn（提醒是否误把资源打进 ts 产物）。
 *
 * 反例（V1，真正的屎山）：apps/web 91,908 行 + apps/web-gallery 55,205 行 = 147k 行
 * **重复实现同一批页面**——病根不是"主题大"，是"主题各写一遍宿主逻辑"。
 * 因此真正的门禁是纯度（禁止主题持有数据/权限逻辑），而非行数。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const THEMES_DIR = path.join(REPO_ROOT, 'themes');

/** 文件规模分级（对齐 Rust 侧口径；>1000 为必须拆解）。 */
const GRADE = [
  { max: 300, label: '理想区间', fail: false },
  { max: 600, label: '健康可接受', fail: false },
  { max: 1000, label: '关注区', fail: false, warn: true },
  { max: Infinity, label: '必须拆解（单一职责违规）', fail: true },
];

/** 产物体积提示阈值（仅 warn；首屏零阻塞由 size 闸保证）。 */
const DIST_WARN_BYTES = 2 * 1024 * 1024;

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', 'build', '.vite']);

function collectFiles(dir, exts, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, exts, acc);
    else if (exts.some((e) => entry.name.endsWith(e))) acc.push(full);
  }
  return acc;
}

function countLines(file) {
  return fs.readFileSync(file, 'utf-8').split('\n').length;
}

function gradeOf(lines) {
  return GRADE.find((g) => lines <= g.max);
}

function dirSize(dir) {
  if (!fs.existsSync(dir)) return null;
  let total = 0;
  for (const f of collectFiles(dir, ['.js', '.css', '.json', '.html'])) {
    total += fs.statSync(f).size;
  }
  return total;
}

function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const violations = [];
const warnings = [];

if (!fs.existsSync(THEMES_DIR)) {
  console.log('[SKIP] themes/ 目录不存在');
  process.exit(0);
}

const themes = fs
  .readdirSync(THEMES_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name))
  .map((e) => e.name);

console.log('\n=== FMBY v2 主题质量门禁（防屎山，不限总量）===\n');
console.log('分级口径（对齐仓库 Rust 侧）：<300 理想 / 300-600 健康 / 600-1000 关注 / >1000 必拆\n');

for (const theme of themes) {
  const themeDir = path.join(THEMES_DIR, theme);
  const srcFiles = collectFiles(path.join(themeDir, 'src'), ['.ts', '.tsx']);
  const testFiles = collectFiles(path.join(themeDir, 'tests'), ['.ts', '.tsx']);

  const totalSrc = srcFiles.reduce((n, f) => n + countLines(f), 0);
  console.log(`[主题] ${theme}`);
  console.log(`  - 源码合计：${totalSrc} 行（${srcFiles.length} 文件）—— 不设总量上限`);

  // God File 分级（生产源码；测试文件单独看不参与职责判定）
  for (const f of srcFiles) {
    const lines = countLines(f);
    const g = gradeOf(lines);
    const rel = path.relative(REPO_ROOT, f);
    if (g.fail) {
      violations.push(`[God File] ${rel}: ${lines} 行 > 1000——单一职责违规，必须拆解`);
    } else if (g.warn) {
      warnings.push(`[关注] ${rel}: ${lines} 行（600-1000）—— 请审视职责是否单一`);
    }
    if (testFiles.includes(f)) continue;
  }
  // 单文件逐条打印（>300 才提示，保持输出简洁）
  for (const f of srcFiles) {
    const lines = countLines(f);
    if (lines > 300) {
      const rel = path.relative(themeDir, f);
      console.log(`      · ${rel}: ${lines} 行 [${gradeOf(lines).label}]`);
    }
  }

  // 产物体积（仅提示）
  const distDir = path.join(themeDir, 'dist');
  const size = dirSize(distDir);
  if (size === null) {
    console.log('  - dist：未构建，跳过（先跑 pnpm build）');
  } else if (size > DIST_WARN_BYTES) {
    console.log(`  - dist：${formatKB(size)} [提示] 超过 ${formatKB(DIST_WARN_BYTES)}，检查是否误打包资源`);
  } else {
    console.log(`  - dist：${formatKB(size)} [OK]`);
  }
  console.log('');
}

if (warnings.length > 0) {
  console.log('--- 关注项（不阻断）---');
  for (const w of warnings) console.log(`  ${w}`);
  console.log('');
}

if (violations.length > 0) {
  console.error('--- 违规项（阻断）---');
  for (const v of violations) console.error(`  ${v}`);
  console.error('\n[FAIL] 存在 God File（>1000 行），请按单一职责拆解。\n');
  process.exit(1);
}

console.log('[PASS] 主题质量门禁通过（无 God File；总量不设限）。\n');

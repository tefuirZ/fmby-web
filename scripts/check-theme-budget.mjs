#!/usr/bin/env node

/**
 * scripts/check-theme-budget.mjs
 *
 * 主题体量门禁（ADR-001 §3「体量红线」、docs/09-webui.md §6.4）：
 *   1. 单主题 ts/tsx 源码 ≤ 3000 行（防 V1 式主题膨胀：V1 两主题重复约 147k 行）
 *   2. 单主题产物 dist ≤ 1.5MB（未构建时跳过并提示，不误判为失败）
 *
 * 设计：
 * - 只统计 `apps/themes/*` 下真实主题目录（跳过 node_modules/dist/隐藏目录）；
 * - 行数为**物理行**（与 ADR 口径一致），逐文件累加；
 * - 超限以 [FAIL] 汇总后一次性退出（不中途 exit，便于一次看全所有主题）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const THEMES_DIR = path.join(REPO_ROOT, 'themes');

/** 单主题 ts/tsx 源码行数上限（ADR-001 §3）。 */
const MAX_THEME_TS_LINES = 3000;
/** 单主题产物体积上限（ADR-001 §3）：1.5MB。 */
const MAX_THEME_DIST_BYTES = 1.5 * 1024 * 1024;

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', 'build']);

function isThemeDir(entry) {
  return !SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.') && entry.isDirectory();
}

/** 递归收集主题源码文件（ts/tsx）。 */
function collectSourceFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectSourceFiles(full, acc);
      continue;
    }
    if (/\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function countLines(file) {
  const content = fs.readFileSync(file, 'utf-8');
  if (content.length === 0) return 0;
  // 物理行：末尾无换行时也计最后一行。
  return content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
}

function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += dirSize(full);
      continue;
    }
    try {
      total += fs.statSync(full).size;
    } catch {
      // 竞态删除等：忽略
    }
  }
  return total;
}

function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB (${bytes} bytes)`;
}

function run() {
  console.log('=== FMBY v2 Theme Budget Gate ===\n');
  console.log(
    `红线：单主题 ts/tsx ≤ ${MAX_THEME_TS_LINES} 行 / dist ≤ ${formatKB(MAX_THEME_DIST_BYTES)}\n`,
  );

  if (!fs.existsSync(THEMES_DIR)) {
    console.error(`[FAIL] Themes directory not found: ${THEMES_DIR}`);
    process.exit(1);
  }

  const themeDirs = fs
    .readdirSync(THEMES_DIR, { withFileTypes: true })
    .filter(isThemeDir)
    .map((entry) => entry.name)
    .sort();

  let hasFailure = false;

  for (const themeId of themeDirs) {
    const themeDir = path.join(THEMES_DIR, themeId);
    console.log(`[主题] ${themeId}`);

    // 1) 源码行数
    const files = collectSourceFiles(themeDir);
    let lines = 0;
    for (const file of files) {
      lines += countLines(file);
    }
    const linesOk = lines <= MAX_THEME_TS_LINES;
    console.log(
      `  - ts/tsx 源码：${lines} 行（${files.length} 个文件） ` +
        `${linesOk ? '[OK]' : `[FAIL] 超出 ${MAX_THEME_TS_LINES} 行上限`}`,
    );
    if (!linesOk) {
      hasFailure = true;
      // 列出最大的几个文件，便于定位膨胀源
      const biggest = files
        .map((f) => ({ rel: path.relative(themeDir, f), n: countLines(f) }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 5);
      for (const item of biggest) {
        console.log(`      · ${item.rel}: ${item.n} 行`);
      }
    }

    // 2) 产物体积（未构建时跳过）
    const distDir = path.join(themeDir, 'dist');
    if (!fs.existsSync(distDir)) {
      console.log('  - dist：未构建，跳过体积校验（先跑 pnpm build）');
    } else {
      const size = dirSize(distDir);
      const sizeOk = size <= MAX_THEME_DIST_BYTES;
      console.log(
        `  - dist 产物：${formatKB(size)} ` +
          `${sizeOk ? '[OK]' : `[FAIL] 超出 ${formatKB(MAX_THEME_DIST_BYTES)} 上限`}`,
      );
      if (!sizeOk) hasFailure = true;
    }
    console.log('');
  }

  if (hasFailure) {
    console.error('[FAIL] Theme budget gate failed.');
    process.exit(1);
  }
  console.log('[PASS] All themes within budget.');
}

run();

#!/usr/bin/env node

/**
 * scripts/check-frontend-size.mjs
 *
 * 前端体积与分包红线门禁（docs/09-webui.md §6.4）:
 * 1. 业务首屏 JS（entry 递归 imports 闭包）< 300KB gzip
 * 2. 主题总产物（entry async chunk + tokens.css + extraCss）< 400KB gzip
 * 3. 主题 manifest 原始字节 < 2KB (2048 bytes)
 * 4. 零阻塞断言：首屏闭包不得含主题 chunk、不得含 artplayer / dplayer 播放器 chunk
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const HOST_DIST = path.join(REPO_ROOT, 'apps', 'host', 'dist');
const MANIFEST_PATH = path.join(HOST_DIST, '.vite', 'manifest.json');
const THEMES_DIR = path.join(REPO_ROOT, 'apps', 'themes');

// 红线常数
const MAX_INITIAL_JS_GZIP = 300 * 1024; // 300KB
const MAX_THEME_ASSETS_GZIP = 400 * 1024; // 400KB
const MAX_THEME_MANIFEST_RAW = 2048; // 2KB

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB (${bytes} bytes)`;
}

function getGzipSize(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath);
  return zlib.gzipSync(content, { level: 9 }).length;
}

function runSizeCheck() {
  console.log('=== FMBY v2 Frontend Size & Chunking Gate ===\n');

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`[FAIL] Vite manifest not found at ${MANIFEST_PATH}. Did you run 'pnpm build'?`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  let hasFailure = false;

  // 1. 寻找入口 (index.html 或 isEntry)
  let entryKey = null;
  for (const [key, item] of Object.entries(manifest)) {
    if (item.isEntry) {
      entryKey = key;
      break;
    }
  }

  if (!entryKey) {
    console.error('[FAIL] Could not find entry chunk (isEntry) in manifest.');
    process.exit(1);
  }

  console.log(`[1] Entry key identified: ${entryKey} -> ${manifest[entryKey].file}`);

  // 2. 递归收集首屏静态 JS 闭包（沿 imports 遍历，不沿 dynamicImports 遍历）
  const initialClosureChunkKeys = new Set();
  const initialClosureFiles = new Set();

  function collectStaticClosure(key) {
    if (!manifest[key] || initialClosureChunkKeys.has(key)) return;
    initialClosureChunkKeys.add(key);
    if (manifest[key].file && manifest[key].file.endsWith('.js')) {
      initialClosureFiles.add(manifest[key].file);
    }
    const imports = manifest[key].imports || [];
    for (const imp of imports) {
      collectStaticClosure(imp);
    }
  }

  collectStaticClosure(entryKey);

  console.log('\n[2] Initial screen JS closure files:');
  let totalInitialJsGzip = 0;
  for (const relFile of initialClosureFiles) {
    const fullPath = path.join(HOST_DIST, relFile);
    const gz = getGzipSize(fullPath);
    totalInitialJsGzip += gz;
    console.log(`  - ${relFile}: ${formatBytes(gz)} (gzip)`);
  }
  console.log(`  => Total Initial JS Gzip: ${formatBytes(totalInitialJsGzip)} / Limit: ${formatBytes(MAX_INITIAL_JS_GZIP)}`);

  if (totalInitialJsGzip > MAX_INITIAL_JS_GZIP) {
    console.error(`  [FAIL] Initial screen JS exceeds redline: ${formatBytes(totalInitialJsGzip)} > ${formatBytes(MAX_INITIAL_JS_GZIP)}`);
    hasFailure = true;
  } else {
    console.log('  [PASS] Initial screen JS size within budget.');
  }

  // 3. 断言首屏闭包不含主题 chunk 与播放器 chunk
  console.log('\n[3] Verifying zero-theme-blocking & lazy player isolation in initial closure...');
  for (const relFile of initialClosureFiles) {
    const lower = relFile.toLowerCase();
    if (lower.includes('theme') || lower.includes('darkroom') || lower.includes('_template')) {
      console.error(`  [FAIL] Initial closure contains theme chunk: ${relFile}`);
      hasFailure = true;
    }
    if (lower.includes('artplayer') || lower.includes('dplayer')) {
      console.error(`  [FAIL] Initial closure contains player chunk: ${relFile}`);
      hasFailure = true;
    }
  }
  if (!hasFailure) {
    console.log('  [PASS] Zero theme & player chunks in initial screen closure.');
  }

  // 4. 检查各主题包总产物与 manifest 大小
  console.log('\n[4] Checking theme packages (assets + manifest)...');
  const themeDirs = fs.readdirSync(THEMES_DIR).filter((dir) => {
    const full = path.join(THEMES_DIR, dir);
    return fs.statSync(full).isDirectory();
  });

  for (const themeId of themeDirs) {
    const themeDir = path.join(THEMES_DIR, themeId);
    const manifestFile = path.join(themeDir, 'theme.manifest.json');

    console.log(`\n  * Theme: [${themeId}]`);

    // 检查 theme.manifest.json raw bytes
    if (fs.existsSync(manifestFile)) {
      const rawSize = fs.statSync(manifestFile).size;
      console.log(`    - theme.manifest.json: ${rawSize} bytes / Limit: ${MAX_THEME_MANIFEST_RAW} bytes`);
      if (rawSize > MAX_THEME_MANIFEST_RAW) {
        console.error(`    [FAIL] theme.manifest.json exceeds 2KB limit: ${rawSize} bytes`);
        hasFailure = true;
      } else {
        console.log('    [PASS] theme.manifest.json size within 2KB limit.');
      }
    } else {
      console.error(`    [FAIL] Missing theme.manifest.json in ${themeDir}`);
      hasFailure = true;
    }

    // 计算主题构建产物（async chunk + CSS 资产）
    let themeTotalGzip = 0;
    const themeAssets = [];

    // 在 vite manifest 中查找主题入口与 CSS
    for (const [key, item] of Object.entries(manifest)) {
      const matchesTheme = key.includes(`themes/${themeId}`) || key.includes(`themes\\${themeId}`);
      if (matchesTheme) {
        if (item.file) {
          themeAssets.push(item.file);
        }
      }
    }

    for (const relFile of themeAssets) {
      const fullPath = path.join(HOST_DIST, relFile);
      if (fs.existsSync(fullPath)) {
        const gz = getGzipSize(fullPath);
        themeTotalGzip += gz;
        console.log(`    - Asset ${relFile}: ${formatBytes(gz)} (gzip)`);
      }
    }

    console.log(`    => Theme Total Gzip: ${formatBytes(themeTotalGzip)} / Limit: ${formatBytes(MAX_THEME_ASSETS_GZIP)}`);
    if (themeTotalGzip > MAX_THEME_ASSETS_GZIP) {
      console.error(`    [FAIL] Theme assets exceed 400KB limit: ${formatBytes(themeTotalGzip)}`);
      hasFailure = true;
    } else {
      console.log(`    [PASS] Theme [${themeId}] total assets within 400KB limit.`);
    }
  }

  console.log('\n=============================================');
  if (hasFailure) {
    console.error('Frontend size check FAILED.');
    process.exit(1);
  } else {
    console.log('All frontend size & chunking gates PASSED.');
  }
}

runSizeCheck();

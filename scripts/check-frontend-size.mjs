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

const HOST_DIST = path.join(REPO_ROOT, 'host', 'dist');
const MANIFEST_PATH = path.join(HOST_DIST, '.vite', 'manifest.json');
const THEMES_DIR = path.join(REPO_ROOT, 'themes');

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

  // 3b. THEME-BUILD-01：逐 chunk 内容反查（杜绝假绿）——文件名启发式（[3]）
  // 会被 chunk 改名/合并绕过；这里直接扫首屏闭包 JS 字节：命中主题/skin 代码
  // 特征串即 FAIL。注意：主题 **id 字符串**（'darkroom' 等注册表元数据）属
  // host 合法引用，不作标识；特征串必须是主题代码内才会出现的符号。
  console.log('\n[3b] Content-level scan: theme/skin code markers in initial closure...');
  const THEME_CODE_MARKERS = [
    'LibrarySkin',
    'ItemSkin',
    'DomainSkinOutlet',
    'browse.library skin', // manifest/文档级字串
  ];
  const MARKER_SUBSTRINGS = ['data-darkroom']; // darkroom skin 专属 DOM 属性
  let contentClean = true;
  for (const relFile of initialClosureFiles) {
    const full = path.join(HOST_DIST, relFile);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, 'utf-8');
    for (const marker of [...THEME_CODE_MARKERS, ...MARKER_SUBSTRINGS]) {
      if (content.includes(marker)) {
        console.error(`  [FAIL] 首屏 chunk 内联主题代码: ${relFile}（特征串 "${marker}"）`);
        hasFailure = true;
        contentClean = false;
      }
    }
    // 主题构建产物特征：vite library 产物头部带 external import 面，若主题
    // 代码被内联进 host chunk，会在主包内出现对主题源文件路径的 sourcemap
    // 残留（vite 默认 no sourcemap 下残留注释不常见，改用强特征：主题入口
    // 的 capabilities 声明字串）。
    if (content.includes("'browse.library': LibrarySkin") || content.includes('"browse.library": LibrarySkin')) {
      console.error(`  [FAIL] 首屏 chunk 内联主题入口声明: ${relFile}`);
      hasFailure = true;
      contentClean = false;
    }
  }
  if (contentClean) {
    console.log('  [PASS] 首屏闭包逐 chunk 反查零主题代码（LibrarySkin/ItemSkin/DomainSkinOutlet/data-darkroom 均未命中）。');
  }

  // 3c. THEME-BUILD-01：主题独立产物存在性——themes/<id>/dist/index.js 必须
  // 真实产出（vite library 构建）。缺失 = 主题无法外挂（历史真缺口：主题
  // 被内联进 host、dist 从未产出）。
  console.log('\n[3c] Verifying theme dist artifacts exist (library build output)...');
  for (const themeId of fs.readdirSync(THEMES_DIR).filter((dir) => {
    const full = path.join(THEMES_DIR, dir);
    return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'theme.manifest.json'));
  })) {
    const entryFile = path.join(THEMES_DIR, themeId, 'dist', 'index.js');
    if (!fs.existsSync(entryFile)) {
      console.error(`  [FAIL] 主题独立产物缺失: themes/${themeId}/dist/index.js（先跑 pnpm build:themes）`);
      hasFailure = true;
    } else {
      const raw = fs.readFileSync(entryFile, 'utf-8');
      // THEME-BUILD-01/FE-OPT-01：产物为 IIFE（var FmbyTheme = ...，react 由
      // 宿主全局提供，浏览器无 importmap 时 IIFE 是唯一可执行形态）。断言：
      // ① IIFE 全局赋值存在；② react 未被打包进产物（外部化纪律——打包进
      // 去会引入第二份 react 实例，hooks 语义崩坏）。
      const isIife = /(?:var|const)\s+FmbyTheme\s*=/.test(raw);
      if (!isIife) {
        console.error(`  [FAIL] themes/${themeId}/dist/index.js 非 IIFE 产物（缺 FmbyTheme 全局赋值）`);
        hasFailure = true;
      } else if (raw.length > 150_000 || /createElement\("div"\)/.test(raw) === false && raw.includes('react-dom') === false && raw.includes('__SECRET_INTERNALS') ) {
        // 粗检：react 被内联的典型特征是体积暴涨 + 内部 API 字串
        if (raw.includes('__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED') || raw.length > 150_000) {
          console.error(`  [FAIL] themes/${themeId}/dist/index.js 疑似打包了 react（external 失效，${raw.length} bytes）`);
          hasFailure = true;
        } else {
          console.log(`  [PASS] themes/${themeId}/dist/index.js IIFE 产物且 react 外部化`);
        }
      } else {
        console.log(`  [PASS] themes/${themeId}/dist/index.js IIFE 产物且 react 外部化`);
      }
    }
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

  // 5. WEB-PERF-01 ①：主题 chunk 隔离——host 首屏闭包**不得**包含任何主题
  //    动态入口（vite manifest 的 isDynamicEntry 且 src 指向 apps/themes/）。
  //    与 [3] 的"文件名启发式"互补：此处按 manifest 归属精确判定，防止主题
  //    代码因 chunk 改名/合并而悄悄进入主包。
  console.log('\n[5] Verifying theme chunks are isolated async chunks (not in host bundle)...');
  const themeEntryFiles = new Set();
  for (const [key, item] of Object.entries(manifest)) {
    const isThemeSource = key.includes('themes/') || key.includes('themes\\');
    if (isThemeSource && item.file && item.file.endsWith('.js')) {
      themeEntryFiles.add(item.file);
    }
  }
  if (themeEntryFiles.size === 0) {
    console.log('  - 未发现主题 JS 动态入口（纯 CSS 主题）→ 跳过隔离断言');
  } else {
    for (const relFile of themeEntryFiles) {
      const inClosure = initialClosureFiles.has(relFile);
      const isDynamic = Object.values(manifest).some(
        (item) => item.file === relFile && item.isDynamicEntry,
      );
      if (inClosure) {
        console.error(
          `  [FAIL] 主题 chunk 被首屏闭包引用（未隔离）: ${relFile}`,
        );
        hasFailure = true;
      } else if (!isDynamic) {
        console.error(
          `  [FAIL] 主题 chunk 不是独立 async chunk（isDynamicEntry=false）: ${relFile}`,
        );
        hasFailure = true;
      } else {
        console.log(`  [PASS] 主题 chunk 为独立 async chunk 且不进首屏: ${relFile}`);
      }
    }
    if (!hasFailure) {
      console.log('  [PASS] All theme chunks isolated from host initial bundle.');
    }
  }

  // 6. WEB-PERF-01 ②：首屏不加载主题——dist/index.html 直接引用的脚本
  //    （<script src> / <link rel=modulepreload>）不得含 LibrarySkin / 主题代码。
  console.log('\n[6] Verifying index.html direct scripts contain no theme/skin code...');
  const indexPath = path.join(HOST_DIST, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error(`  [FAIL] dist/index.html not found: ${indexPath}`);
    hasFailure = true;
  } else {
    const html = fs.readFileSync(indexPath, 'utf-8');
    // 收集 index.html 直接引用的脚本资源
    const referenced = new Set();
    for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)) referenced.add(m[1]);
    for (const m of html.matchAll(/<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+)["']/g)) {
      referenced.add(m[1]);
    }
    for (const m of html.matchAll(/href=["']([^"']+)["']/g)) {
      if (/\.js$/.test(m[1])) referenced.add(m[1]);
    }

    console.log(`  - index.html 直接引用脚本 ${referenced.size} 个`);
    let htmlClean = true;
    for (const src of referenced) {
      const rel = src.replace(/^\.?\//, '');
      const full = path.join(HOST_DIST, rel);
      if (!fs.existsSync(full)) continue;
      const content = fs.readFileSync(full, 'utf-8');
      // 主题/L3 skin **代码**标识（注意：不含主题 id 字符串——host registry
      // 的 DEFAULT_THEME_ID / manifestUrl 等元数据本就属于主包，属合法引用）。
      for (const marker of ['LibrarySkin', 'DomainSkin', 'SkinProps']) {
        if (content.includes(marker)) {
          console.error(`  [FAIL] 首屏脚本含主题/skin 代码: ${rel}（标识 ${marker}）`);
          hasFailure = true;
          htmlClean = false;
        }
      }
      if (themeEntryFiles.has(rel)) {
        console.error(`  [FAIL] 首屏脚本直接引用主题 chunk: ${rel}`);
        hasFailure = true;
        htmlClean = false;
      }
    }
    if (htmlClean) {
      console.log('  [PASS] 首屏直接引用脚本不含 LibrarySkin / 主题代码。');
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

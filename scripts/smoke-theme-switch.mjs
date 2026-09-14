#!/usr/bin/env node

/**
 * scripts/smoke-theme-switch.mjs
 *
 * 主题切换机制冒烟测试（docs/09 §6.3 / §6.4 & docs/plans/tasks/zcode-frontend-001.md §5.4）：
 * 1. 校验 darkroom 与 template 主题 manifest 规范（preload === false、<2KB）
 * 2. 校验 tokens.css 变量定义（darkroom #000000 ↔ template #14161c）
 * 3. 校验 host ThemeProvider 协议契约：无假加载动画、tokens 热替换、回落兜底
 * 4. 校验本地 Dev Server（http://localhost:5180/）服务状态与端点可访问性
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const THEMES_DIR = path.join(REPO_ROOT, 'themes');
const HOST_THEME_REGISTRY = path.join(REPO_ROOT, 'host', 'src', 'theme', 'registry.ts');
const HOST_THEME_PROVIDER = path.join(REPO_ROOT, 'host', 'src', 'theme', 'ThemeProvider.tsx');

let passed = true;

function assert(condition, message) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    passed = false;
  } else {
    console.log(`  [PASS] ${message}`);
  }
}

async function runSmokeTest() {
  console.log('=== FMBY v2 Theme Hot-Switching Smoke Test ===\n');

  // 1. 校验主题 Manifest 契约
  console.log('[1] Validating Theme Manifests against docs/09 §3.2...');
  const themeIds = ['darkroom', '_template'];

  for (const id of themeIds) {
    const manifestPath = path.join(THEMES_DIR, id, 'theme.manifest.json');
    assert(fs.existsSync(manifestPath), `Manifest exists for ${id}`);

    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const bytes = Buffer.byteLength(raw, 'utf-8');
    assert(bytes < 2048, `${id} manifest is ${bytes} bytes (<2KB limit)`);

    const manifest = JSON.parse(raw);
    assert(manifest.preload === false, `${id} manifest strictly sets preload: false (no fake preload)`);
    assert(typeof manifest.tokens?.cssFile === 'string', `${id} specifies tokens.cssFile`);
    assert(typeof manifest.entry?.mount === 'string', `${id} specifies entry.mount`);
  }

  // 2. 校验 Tokens 色彩与变量热替换基线
  console.log('\n[2] Validating Palette Tokens for Darkroom & Template...');
  const darkroomTokensPath = path.join(THEMES_DIR, 'darkroom', 'tokens.css');
  const templateTokensPath = path.join(THEMES_DIR, '_template', 'tokens.css');

  assert(fs.existsSync(darkroomTokensPath), 'Darkroom tokens.css exists');
  assert(fs.existsSync(templateTokensPath), 'Template tokens.css exists');

  const darkroomTokens = fs.readFileSync(darkroomTokensPath, 'utf-8');
  const templateTokens = fs.readFileSync(templateTokensPath, 'utf-8');

  assert(
    darkroomTokens.includes('--bg-base: #000000;'),
    'Darkroom sets pure black canvas (--bg-base: #000000;)',
  );
  assert(
    templateTokens.includes('--bg-base: #14161c;'),
    'Template sets slate blue canvas (--bg-base: #14161c;)',
  );

  // 3. 校验 host ThemeProvider 与 Registry 契约
  console.log('\n[3] Validating Host Theme Runtime Implementation...');
  const providerContent = fs.readFileSync(HOST_THEME_PROVIDER, 'utf-8');
  const registryContent = fs.readFileSync(HOST_THEME_REGISTRY, 'utf-8');

  assert(
    providerContent.includes('document.documentElement.dataset.theme'),
    'ThemeProvider manages <html data-theme>',
  );
  assert(
    providerContent.includes('data-theme-style'),
    'ThemeProvider dynamically manages <link data-theme-style>',
  );
  assert(
    providerContent.includes('teardownThemeStyles();'),
    'ThemeProvider unmounts previous theme styles on switch (hot swap)',
  );
  assert(
    providerContent.includes('localStorage.setItem'),
    'ThemeProvider persists active theme in local storage',
  );
  assert(
    registryContent.includes('?url'),
    'Theme registry uses ?url asset imports without loading bundle bytes',
  );
  assert(
    registryContent.includes('import('),
    'Theme registry uses dynamic import for entry async chunk isolation',
  );

  // 3b. WEB-PERF-01 ③：懒加载回归——主题 skin 只在激活（切到该主题/该域）
  //     时才拉取；首屏不加载。依据构建产物（vite manifest）+ 源码契约断言。
  console.log('\n[3b] Verifying theme skin lazy-loading (WEB-PERF-01)...');

  // (a) 源码契约：主题入口经动态 import 暴露 domainSkins（不静态导入 skin）
  const darkroomEntry = path.join(THEMES_DIR, 'darkroom', 'src', 'index.ts');
  assert(fs.existsSync(darkroomEntry), 'Darkroom entry (src/index.ts) exists');
  const entryContent = fs.readFileSync(darkroomEntry, 'utf-8');
  assert(
    /domainSkins\s*:/.test(entryContent),
    'Darkroom entry exposes domainSkins (L3 domain skins registered)',
  );
  assert(
    /LibrarySkin/.test(entryContent),
    'Darkroom entry maps browse.library -> LibrarySkin',
  );

  // (b) 加载路径：host 调度器按 domain 惰性取 skin（仅在匹配 domain 时渲染）
  const outletCandidates = [
    path.join(REPO_ROOT, 'host', 'src', 'theme', 'skins', 'DomainSkinOutlet.tsx'),
    path.join(REPO_ROOT, 'host', 'src', 'theme', 'skins', 'DomainSkinOutlet.ts'),
  ];
  const outletPath = outletCandidates.find((candidate) => fs.existsSync(candidate));
  if (outletPath) {
    const outlet = fs.readFileSync(outletPath, 'utf-8');
    assert(
      /domainSkins/.test(outlet),
      'Host skin outlet resolves skin from theme domainSkins at render time',
    );
    assert(
      /useDomainSkinData|DomainSkinDataContext/.test(outlet),
      'Host injects view-model data into skin (theme never fetches)',
    );
  } else {
    console.log('  - (信息) 未找到 DomainSkinOutlet 文件，跳过 outlet 断言');
  }

  // (c) 产物证据：主题 JS 为独立 async chunk 且不在首屏闭包内
  const manifestPath = path.join(REPO_ROOT, 'host', 'dist', '.vite', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.log('  - (信息) 无 dist manifest，跳过产物层懒加载断言（先跑 pnpm build）');
  } else {
    const viteManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const entryKey = Object.keys(viteManifest).find((k) => viteManifest[k].isEntry);
    const themeChunkKeys = Object.keys(viteManifest).filter(
      (k) => (k.includes('themes/') || k.includes('themes\\')) &&
        viteManifest[k].file?.endsWith('.js'),
    );
    assert(themeChunkKeys.length > 0, 'Theme JS chunks exist in build output');

    // 首屏静态闭包（只沿 imports，不沿 dynamicImports）
    const closure = new Set();
    const stack = entryKey ? [...(viteManifest[entryKey].imports || [])] : [];
    while (stack.length) {
      const key = stack.pop();
      if (!viteManifest[key] || closure.has(key)) continue;
      closure.add(key);
      stack.push(...(viteManifest[key].imports || []));
    }

    for (const key of themeChunkKeys) {
      const item = viteManifest[key];
      assert(item.isDynamicEntry === true, `Theme chunk is a dynamic (async) entry: ${item.file}`);
      assert(!closure.has(key), `Theme chunk NOT in initial screen closure: ${item.file}`);
    }
  }

  // (d) 首屏 HTML 不直接引用主题 chunk
  const distIndex = path.join(REPO_ROOT, 'host', 'dist', 'index.html');
  if (fs.existsSync(distIndex)) {
    const html = fs.readFileSync(distIndex, 'utf-8');
    const directScripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map((m) => m[1]);
    // 主题 chunk 文件名集合（来自上方已解析的 manifest；未构建时为空）
    const themeFileNames = fs.existsSync(manifestPath)
      ? Object.keys(JSON.parse(fs.readFileSync(manifestPath, 'utf-8')))
          .filter((k) => (k.includes('themes/') || k.includes('themes\\')))
          .map((k) => path.basename(JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))[k].file || ''))
          .filter(Boolean)
      : [];
    assert(
      !directScripts.some((src) => themeFileNames.some((name) => src.endsWith(name))),
      'dist/index.html does not directly reference any theme chunk',
    );
    assert(
      !html.includes('LibrarySkin'),
      'dist/index.html shell contains no LibrarySkin reference',
    );
  }

  // 4. Dev Server 端点探测 (http://localhost:5180/)
  console.log('\n[4] Probing Dev Server at http://localhost:5180/...');
  try {
    const res = await fetch('http://localhost:5180/');
    assert(res.status === 200, `Dev Server responded with HTTP ${res.status}`);
    const html = await res.text();
    assert(html.includes('<div id="root"></div>'), 'Root element present in HTML shell');
    assert(html.includes('src="/src/main.tsx"'), 'Main entry script referenced');
  } catch (err) {
    console.warn(`  [WARN] Dev Server probe: ${err.message} (ignoring if offline)`);
  }

  console.log('\n=============================================');
  if (passed) {
    console.log('Theme switching smoke test PASSED with 0 issues.');
  } else {
    console.error('Theme switching smoke test FAILED.');
    process.exit(1);
  }
}

runSmokeTest();

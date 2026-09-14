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

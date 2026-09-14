#!/usr/bin/env node

/**
 * scripts/check-theme-parity.mjs
 *
 * 主题能力面 parity 门禁（WEB-GOV ④，ADR-001 §3）：
 * 主题在 `theme.manifest.json` 的 `skins` 中**声明了某个 PageDomain**，就必须覆盖
 * 该 domain 要求的四项能力面（实时显示 / 移动端 / 时区显示 / 授权状态），否则 FAIL。
 *
 * 未声明的 domain 不校验（静默回落 host 默认页面——功能永不缺失）。
 *
 * 能力面声明读取顺序（源码文本解析，不执行主题代码）：
 *   1. 入口模块（manifest.entry.mount，如 `index.ts`）导出/引用的 `capabilities`
 *      常量（形如 `{ global: [...], byDomain: { 'browse.home': [...] } }`）；
 *   2. 若主题无任何 `capabilities` 声明，则视为**未覆盖**（声明即负责）。
 *
 * 危险确认框不做（用户裁决，见 capabilities.ts 的 DANGER_CONFIRM_DECISION）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const THEMES_DIR = path.join(REPO_ROOT, 'themes');

/** 与 contracts 对齐的四项必须能力（避免 import TS 模块，脚本为纯 Node ESM）。 */
const REQUIRED_CAPABILITIES = ['realtime', 'mobile', 'timezone', 'authorization'];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

function listThemes() {
  return fs
    .readdirSync(THEMES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
}

/** 从源码文本中抓取 `capabilities` 声明里出现的能力键（按 domain 归集）。 */
function parseCapabilities(source, domain) {
  const found = new Set();

  // 全局：capabilities = { global: [...] } 或 const capabilities = {...}
  const capBlock = source.match(/capabilities\s*(?::\s*ThemeCapabilitiesDeclaration)?\s*=\s*\{([\s\S]*?)\n?\s*\};/);
  if (capBlock) {
    const block = capBlock[1];
    // global 段：从 `global:` 起至下一个顶层键（`byDomain:`）或块尾
    const globalMatch = block.match(/global\s*:\s*\[([^\]]*)\]/);
    if (globalMatch) {
      for (const key of extractKeys(globalMatch[1])) found.add(key);
    }
    // byDomain 段：按 domain 键取数组
    const byDomainMatch = block.match(/byDomain\s*:\s*\{([\s\S]*)\}/);
    if (byDomainMatch) {
      const domainMatch = byDomainMatch[1].match(
        new RegExp(`['"\`]?${escapeRegExp(domain)}['"\`]?\\s*:\\s*\\[([^\\]]*)\\]`),
      );
      if (domainMatch) {
        for (const key of extractKeys(domainMatch[1])) found.add(key);
      }
    }
  }
  return found;
}

function extractKeys(raw) {
  return raw
    .split(',')
    .map((part) => part.trim().replace(/^['"`]|['"`]$/g, ''))
    .filter((key) => REQUIRED_CAPABILITIES.includes(key));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function run() {
  console.log('=== FMBY v2 Theme Capability Parity Gate ===\n');
  console.log(`必须能力面：${REQUIRED_CAPABILITIES.join(' / ')}`);
  console.log('（危险确认框不做——G-06 用户裁决，见 capabilities.ts）\n');

  if (!fs.existsSync(THEMES_DIR)) {
    console.error(`[FAIL] Themes directory not found: ${THEMES_DIR}`);
    process.exit(1);
  }

  let hasFailure = false;

  for (const themeId of listThemes()) {
    const themeDir = path.join(THEMES_DIR, themeId);
    const manifestPath = path.join(themeDir, 'theme.manifest.json');

    if (!fs.existsSync(manifestPath)) {
      console.log(`[主题] ${themeId}: 无 theme.manifest.json，跳过`);
      continue;
    }

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (error) {
      console.error(`[FAIL] ${themeId}: manifest 解析失败 — ${error.message}`);
      hasFailure = true;
      continue;
    }

    const declaredDomains = Object.keys(manifest.skins ?? {});
    if (declaredDomains.length === 0) {
      console.log(`[主题] ${themeId}: 未声明任何 domain skin → 不校验（回落 host，功能不缺失）`);
      continue;
    }

    // 入口源码（用于读取 capabilities 声明）
    const mount = manifest.entry?.mount ?? 'index.ts';
    const entryPath = path.join(themeDir, 'src', mount);
    const source = fs.existsSync(entryPath) ? fs.readFileSync(entryPath, 'utf-8') : '';

    console.log(`[主题] ${themeId}（声明 ${declaredDomains.length} 个 domain）`);

    for (const domain of declaredDomains) {
      const declared = parseCapabilities(source, domain);
      const missing = REQUIRED_CAPABILITIES.filter((key) => !declared.has(key));

      if (missing.length === 0) {
        console.log(`  - ${domain}: [OK] 四项能力面齐备`);
      } else {
        console.error(
          `  - ${domain}: [FAIL] 缺少能力面 —— ${missing.join(' / ')}` +
            (source ? '' : `（未找到入口源码 ${path.relative(themeDir, entryPath)}）`),
        );
        hasFailure = true;
      }
    }
    console.log('');
  }

  if (hasFailure) {
    console.error('[FAIL] Theme capability parity gate failed.');
    process.exit(1);
  }
  console.log('[PASS] All declared domain skins satisfy required capabilities.');
}

run();

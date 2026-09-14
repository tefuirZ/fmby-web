#!/usr/bin/env node

/**
 * scripts/check-frontend-dupes.mjs
 *
 * 前端重复实现与架构边界门禁（docs/09-webui.md §2, §3, §6.4 & docs/plans/tasks/zcode-frontend-001-gemini.md §5.3）：
 * 1. 主题纯度（Theme Purity）：themes/** 只允许 import @fmby/v2-shared/theme 与相对导入；
 *    禁止引入 api client / query / contracts / errors / permission。
 * 2. raw DTO 不透页面：host/src/pages/** 禁止直接 import raw-types 或 contracts 下的底层 api/raw-types。
 * 3. 唯一实现（Single Source of Truth）：
 *    - Asia/Shanghai / Intl.DateTimeFormat 代码仅在 shared/src/time/**；
 *    - new Headers 封装仅在 shared/src/api/**；
 *    - query key 工厂定义仅在 shared/src/query/**；
 *    - 豁免 host/src/styles/defaults.css（host 默认形象，交接文档 §3.2）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const THEMES_DIR = path.join(REPO_ROOT, 'apps', 'themes');
const HOST_PAGES_DIR = path.join(REPO_ROOT, 'apps', 'host', 'src', 'pages');
const APPS_DIR = path.join(REPO_ROOT, 'apps');

const violations = [];

function walkFiles(dir, filterExt = ['.ts', '.tsx', '.js', '.mjs', '.jsx']) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === '.vite' ||
      entry.name === '.tmp' ||
      entry.name.endsWith('.d.ts')
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, filterExt));
    } else if (entry.isFile()) {
      if (filterExt.some((ext) => entry.name.endsWith(ext))) {
        results.push(full);
      }
    }
  }
  return results;
}

function getRelativePath(fullPath) {
  return path.relative(REPO_ROOT, fullPath).replace(/\\/g, '/');
}

/**
 * 1. 检查主题纯度
 */
function checkThemePurity() {
  console.log('[1] Checking Theme Purity (themes/**)...');
  const themeFiles = walkFiles(THEMES_DIR);

  for (const file of themeFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, lineIdx) => {
      const lineNum = lineIdx + 1;
      const importMatch = line.match(/(?:import|from)\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        const importSpecifier = importMatch[1];
        // 允许相对路径导入 (./ 或 ../)
        if (importSpecifier.startsWith('.')) {
          return;
        }
        // 允许 @fmby/v2-shared/theme
        if (importSpecifier === '@fmby/v2-shared/theme' || importSpecifier.startsWith('@fmby/v2-shared/theme/')) {
          return;
        }

        // 其余任何绝对/包导入在主题中都是非法的
        violations.push({
          rule: 'Theme Purity Violation',
          file: getRelativePath(file),
          line: lineNum,
          content: line.trim(),
          reason: `Theme file can only import from '@fmby/v2-shared/theme' or relative paths, found: '${importSpecifier}'`,
        });
      }

      // 禁止主题内含 API / Query / Permission 关键字调用
      if (/\b(useQuery|useMutation|QueryClient|httpClient|fetch)\b/.test(line) && !line.includes('*') && !line.includes('//')) {
        violations.push({
          rule: 'Theme Purity Logic Violation',
          file: getRelativePath(file),
          line: lineNum,
          content: line.trim(),
          reason: `Theme cannot contain query/mutation/HTTP logic.`,
        });
      }
    });
  }
}

/**
 * 2. 检查 raw DTO 不透页面
 */
function checkRawDtoInPages() {
  console.log('[2] Checking Raw DTO Boundary (host/src/pages/**)...');
  const pageFiles = walkFiles(HOST_PAGES_DIR);

  for (const file of pageFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, lineIdx) => {
      const lineNum = lineIdx + 1;
      const importMatch = line.match(/(?:import|from)\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        const importSpecifier = importMatch[1];
        // 禁止直接引用 raw-types 或 contracts/*/api
        if (
          importSpecifier.includes('raw-types') ||
          /\/contracts\/[^/]+\/api(\/|$)/.test(importSpecifier)
        ) {
          violations.push({
            rule: 'Raw DTO Leaked to Page',
            file: getRelativePath(file),
            line: lineNum,
            content: line.trim(),
            reason: `Page must import mapped domain types from contracts barrel, not raw types or raw api endpoint files: '${importSpecifier}'`,
          });
        }
      }
    });
  }
}

/**
 * 3. 检查唯一实现（Single Source of Truth）
 */
function checkSingleImplementations() {
  console.log('[3] Checking Single Source of Truth Implementations...');
  const allAppFiles = walkFiles(APPS_DIR);

  for (const file of allAppFiles) {
    const relPath = getRelativePath(file);
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, lineIdx) => {
      const lineNum = lineIdx + 1;

      // 3.1 时区 Intl.DateTimeFormat 实例化只允许在 shared/src/time/**
      if (/new\s+Intl\.DateTimeFormat\(/.test(line)) {
        if (!relPath.startsWith('shared/src/time/')) {
          violations.push({
            rule: 'Unique Implementation Violation (DateTimeFormat)',
            file: relPath,
            line: lineNum,
            content: line.trim(),
            reason: `Intl.DateTimeFormat constructor is only permitted in 'shared/src/time/**'`,
          });
        }
      }

      // 3.2 timeZone: 'Asia/Shanghai' 配置只允许在 shared/src/time/**
      if (/timeZone:\s*['"]Asia\/Shanghai['"]/.test(line)) {
        if (!relPath.startsWith('shared/src/time/')) {
          violations.push({
            rule: 'Unique Implementation Violation (Timezone Config)',
            file: relPath,
            line: lineNum,
            content: line.trim(),
            reason: `timeZone: 'Asia/Shanghai' formatter configuration is only permitted in 'shared/src/time/**'`,
          });
        }
      }

      // 3.3 new Headers 构造只允许在 shared/src/api/**
      if (/new\s+Headers\(/.test(line)) {
        if (!relPath.startsWith('shared/src/api/')) {
          violations.push({
            rule: 'Unique Implementation Violation (Headers)',
            file: relPath,
            line: lineNum,
            content: line.trim(),
            reason: `new Headers constructor is only permitted in 'shared/src/api/**'`,
          });
        }
      }

      // 3.4 queryKeys 工厂定义只允许在 shared/src/query/**
      if (/export\s+const\s+queryKeys\s*=/.test(line)) {
        if (!relPath.startsWith('shared/src/query/')) {
          violations.push({
            rule: 'Unique Implementation Violation (queryKeys Factory)',
            file: relPath,
            line: lineNum,
            content: line.trim(),
            reason: `queryKeys definition is only permitted in 'shared/src/query/**'`,
          });
        }
      }
    });
  }
}

function runDupesCheck() {
  console.log('=== FMBY v2 Frontend Dupes & Boundary Gate ===\n');

  checkThemePurity();
  checkRawDtoInPages();
  checkSingleImplementations();

  console.log('\n=============================================');
  if (violations.length > 0) {
    console.error(`[FAIL] Found ${violations.length} violation(s):\n`);
    for (const v of violations) {
      console.error(`  - [${v.rule}] ${v.file}:${v.line}`);
      console.error(`    Code: ${v.content}`);
      console.error(`    Reason: ${v.reason}\n`);
    }
    process.exit(1);
  } else {
    console.log('[PASS] 0 violations found. All frontend architectural boundaries clean.');
  }
}

runDupesCheck();

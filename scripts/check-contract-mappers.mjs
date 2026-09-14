#!/usr/bin/env node

/**
 * scripts/check-contract-mappers.mjs
 *
 * 前端合同对齐与 Mapper 门禁（docs/09-webui.md §2, §7 & docs/plans/tasks/gemini-frontend-002.md §3.4）：
 * 1. 契约覆盖度：auth / browse / playback / manage / settings / theme / assets 各域完备；
 * 2. 双件套契约：每个核心契约域均导出对应 domain mapper 或 mapping helper；
 * 3. raw DTO 零泄漏：host/src/pages/** 严禁直接引用 raw-types；
 * 4. 零自建 HTTP Client：页面域与主题域严禁自建 fetch/axios 实例。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const CONTRACTS_DIR = path.join(REPO_ROOT, 'shared', 'src', 'contracts');
const HOST_PAGES_DIR = path.join(REPO_ROOT, 'host', 'src', 'pages');
const THEMES_DIR = path.join(REPO_ROOT, 'themes');

const REQUIRED_DOMAINS = ['auth', 'browse', 'playback', 'manage', 'settings', 'theme', 'assets'];

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
 * 1. 校验契约域覆盖度
 */
function checkDomainCoverage() {
  console.log('[1] Checking Required Contract Domains (docs/interfaces/webui.md)...');
  for (const domain of REQUIRED_DOMAINS) {
    const domainPath = path.join(CONTRACTS_DIR, domain);
    if (!fs.existsSync(domainPath)) {
      violations.push({
        rule: 'Missing Contract Domain',
        file: `shared/src/contracts/${domain}`,
        line: 1,
        reason: `Required domain '${domain}' missing from shared/src/contracts/`,
      });
    } else {
      console.log(`  [PASS] Domain '${domain}' present.`);
    }
  }
}

/**
 * 2. 校验各域双件套与 Mapper 映射层
 */
function checkMappersPresence() {
  console.log('\n[2] Verifying Mapper and Transformation Helpers in Contracts...');
  for (const domain of REQUIRED_DOMAINS) {
    const domainFiles = walkFiles(path.join(CONTRACTS_DIR, domain));
    let hasMapperOrTransform = false;

    for (const file of domainFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (
        /\b(map[A-Z]\w+|asRecord|readString|readNumber|readArray|isValidThemeManifest)\b/.test(
          content,
        )
      ) {
        hasMapperOrTransform = true;
        break;
      }
    }

    if (!hasMapperOrTransform) {
      violations.push({
        rule: 'Missing Domain Mapper',
        file: `shared/src/contracts/${domain}`,
        line: 1,
        reason: `Domain '${domain}' must provide raw DTO mapping functions or validation helpers.`,
      });
    } else {
      console.log(`  [PASS] Domain '${domain}' has domain mappers / transformation layer.`);
    }
  }
}

/**
 * 3. 校验 raw DTO 零泄漏到页面
 */
function checkRawDtoIsolation() {
  console.log('\n[3] Verifying Raw DTO Zero-Leakage in host pages (host/src/pages/**)...');
  const pageFiles = walkFiles(HOST_PAGES_DIR);

  for (const file of pageFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, lineIdx) => {
      const lineNum = lineIdx + 1;
      const importMatch = line.match(/(?:import|from)\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        const importSpecifier = importMatch[1];
        if (
          importSpecifier.includes('raw-types') ||
          /\/contracts\/[^/]+\/raw-types(\/|$)/.test(importSpecifier)
        ) {
          violations.push({
            rule: 'Raw DTO Leaked to Page',
            file: getRelativePath(file),
            line: lineNum,
            content: line.trim(),
            reason: `Page directly imported raw DTO file: '${importSpecifier}'. Must consume domain mapped types from contracts barrel.`,
          });
        }
      }
    });
  }
  if (violations.filter((v) => v.rule === 'Raw DTO Leaked to Page').length === 0) {
    console.log('  [PASS] Zero raw DTO imports detected across all page domains.');
  }
}

/**
 * 4. 校验页面与主题零自建 HTTP Client
 */
function checkNoAdhocFetch() {
  console.log('\n[4] Verifying No Ad-hoc HTTP Client in Pages & Themes...');
  const pageAndThemeFiles = [...walkFiles(HOST_PAGES_DIR), ...walkFiles(THEMES_DIR)];

  for (const file of pageAndThemeFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, lineIdx) => {
      const lineNum = lineIdx + 1;
      // 检查 axios, 裸 fetch (排除注释与 refetch)
      if (
        /\b(axios\.|new\s+XMLHttpRequest|fetch\s*\()\b/.test(line) &&
        !line.includes('//') &&
        !line.includes('*') &&
        !line.includes('refetch()')
      ) {
        violations.push({
          rule: 'Ad-hoc HTTP Client Violation',
          file: getRelativePath(file),
          line: lineNum,
          content: line.trim(),
          reason: `Ad-hoc HTTP calls forbidden in pages/themes. All requests must go through shared API clients.`,
        });
      }
    });
  }
  if (violations.filter((v) => v.rule === 'Ad-hoc HTTP Client Violation').length === 0) {
    console.log('  [PASS] Zero ad-hoc HTTP client instantiations found.');
  }
}

function runCheck() {
  console.log('=== FMBY v2 Contract Mappers & Alignment Gate ===\n');

  checkDomainCoverage();
  checkMappersPresence();
  checkRawDtoIsolation();
  checkNoAdhocFetch();

  console.log('\n=============================================');
  if (violations.length > 0) {
    console.error(`[FAIL] Found ${violations.length} contract mapper violation(s):\n`);
    for (const v of violations) {
      console.error(`  - [${v.rule}] ${v.file}:${v.line}`);
      if (v.content) console.error(`    Code: ${v.content}`);
      console.error(`    Reason: ${v.reason}\n`);
    }
    process.exit(1);
  } else {
    console.log('[PASS] 0 contract violations found. All contracts & domain mappers cleanly aligned.');
  }
}

runCheck();

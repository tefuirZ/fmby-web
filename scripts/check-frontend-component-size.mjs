#!/usr/bin/env node

/**
 * scripts/check-frontend-component-size.mjs
 *
 * 前端组件行数门禁（CONSTRAINTS MD-3：组件 >400 行给拆分计划）。
 *
 * 背景：MD-3 只写了红线，前端此前**没有任何一条门禁**卡它（check-frontend-size.mjs
 * 只卡 bundle 体积）——与后端「函数 >120 行无门禁」同型空档（第三方审计 C-2 点名）。
 * 实测存量 20 个 .tsx 超线，门禁一进来就红 → 必被绕过。故本闸采用 RB-2 棘轮
 * （ratchet）思路：**存量基线 + 只降不升**。
 *
 * 口径（**棘轮优先**——红线只卡增量，存量按债务记账，否则门禁一进来就红、必被绕过）：
 * 1. 扫描 host/src + shared/src 下所有 .tsx（排除 .d.ts）；
 * 2. 分级显示：>400 行 = WARN（须有拆分计划），>500 行 = 超硬红线；
 * 3. 判定 FAIL 的三条（且仅有这三条）：
 *    a. 基线外**新增**超线文件（>400）→ FAIL（新代码必须干净）；
 *    b. 基线内文件行数**上升** → FAIL（存量只许降不许升）；
 *    c. 超硬红线（>500）**且**行数上升/新增 → 已含于 a/b。
 * 4. 基线内、未上升的超线文件 → **WARN 不阻塞**：它是已记账的拆分债务
 *    （本卡拆 2 个，余量见 handoff 拆分计划）；降到 ≤400 后由
 *    `--update-baseline` 回收出基线。
 * 5. `--update-baseline`：重写基线清单。**只许减不许增**——若某文件本次行数
 *    高于基线记录值，拒绝写入并 FAIL（防止把变胖洗进基线）。
 *
 * 基线（纯数据）：docs/plans/v2-dev/evidence/fe-component-size-baseline.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const SCAN_DIRS = [
  path.join(REPO_ROOT, 'host', 'src'),
  path.join(REPO_ROOT, 'shared', 'src'),
];
const BASELINE_PATH = path.join(
  REPO_ROOT,
  'docs',
  'plans',
  'v2-dev',
  'evidence',
  'fe-component-size-baseline.json',
);

/** MD-3 红线：>400 warn（需拆分计划），>500 fail。 */
const WARN_LINES = 400;
const FAIL_LINES = 500;

const UPDATE_FLAG = process.argv.includes('--update-baseline');

function getRelativePath(fullPath) {
  return path.relative(REPO_ROOT, fullPath).replace(/\\/g, '/');
}

/** 递归收集 .tsx（排除声明文件与测试快照目录惯例的 .d.ts）。 */
function walkTsx(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkTsx(full));
    } else if (entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.endsWith('.d.tsx')) {
      results.push(full);
    }
  }
  return results;
}

function countLines(file) {
  const content = fs.readFileSync(file, 'utf-8');
  // 末尾空行不计（与 wc -l 口径一致：以换行符计数）
  const normalized = content.replace(/\n$/, '');
  return normalized === '' ? 0 : normalized.split('\n').length;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));
}

const files = SCAN_DIRS.flatMap(walkTsx);
const measured = files
  .map((f) => ({ file: getRelativePath(f), lines: countLines(f) }))
  .filter((m) => m.lines > WARN_LINES)
  .sort((a, b) => b.lines - a.lines);

const baseline = loadBaseline();
const baselineMap = new Map((baseline?.files ?? []).map((f) => [f.file, f.lines]));

const violations = [];
const warnings = [];

// ── --update-baseline：只许减不许增 ────────────────────────────────────────
if (UPDATE_FLAG) {
  console.log('=== FMBY v2 前端组件行数基线更新（只许减不许增）===\n');
  const grew = measured.filter((m) => {
    const prev = baselineMap.get(m.file);
    return prev !== undefined && m.lines > prev;
  });
  if (grew.length > 0) {
    for (const g of grew) {
      console.error(
        `  [FAIL] ${g.file}: ${baselineMap.get(g.file)} → ${g.lines} 行（变胖，禁止洗进基线）`,
      );
    }
    console.error('\n基线更新被拒：先拆分降行，再更新基线。');
    process.exit(1);
  }
  const next = {
    note:
      '前端组件行数基线（CONSTRAINTS MD-3 棘轮）。只许减不许增：新增超线文件即 FAIL，' +
      '存量行数上升即 FAIL。更新：pnpm component-size --update-baseline',
    warnLines: WARN_LINES,
    failLines: FAIL_LINES,
    generatedAt: new Date().toISOString(),
    files: measured,
  };
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`  [PASS] 基线已写入 ${getRelativePath(BASELINE_PATH)}（${measured.length} 个超线文件）`);
  for (const m of measured) {
    const prev = baselineMap.get(m.file);
    const delta = prev === undefined ? '新增' : `${prev} → ${m.lines}`;
    console.log(`    - ${m.file}: ${m.lines} 行（${delta}）`);
  }
  process.exit(0);
}

// ── 常规检查 ──────────────────────────────────────────────────────────────
console.log('=== FMBY v2 前端组件行数门禁（CONSTRAINTS MD-3 棘轮）===\n');
console.log(`[1] 扫描 host/src + shared/src 的 .tsx（> ${WARN_LINES} 行 warn / > ${FAIL_LINES} 行 fail）...`);

if (!baseline) {
  violations.push({
    rule: 'Missing Baseline',
    file: getRelativePath(BASELINE_PATH),
    reason: '基线清单缺失，无法执行棘轮比对。先跑 --update-baseline 生成。',
  });
} else {
  console.log(`  - 基线：${baseline.files.length} 个超线文件\n`);
}

for (const m of measured) {
  const prev = baselineMap.get(m.file);

  if (prev === undefined) {
    // a. 基线外新增：新增代码必须干净，一律 FAIL
    violations.push({
      rule: 'New Over-Limit Component',
      file: m.file,
      reason:
        `${m.lines} 行超 ${WARN_LINES} 红线，且**不在基线清单内**（新增组件必须干净）。` +
        `拆到 ${WARN_LINES} 行以内，或确认是存量漏登后更新基线。`,
    });
    continue;
  }

  if (m.lines > prev) {
    // b. 存量变胖：棘轮回退，FAIL
    violations.push({
      rule: 'Component Grew Past Baseline',
      file: m.file,
      reason: `棘轮回退：基线 ${prev} 行 → 现 ${m.lines} 行（存量只许降不许升）。`,
    });
    continue;
  }

  // 基线内且未上升 → 已记账债务，WARN 不阻塞（含超硬红线 >500 的存量）
  warnings.push({ ...m, prev });
}

// 基线内已降到红线以下的文件（提示更新基线，不阻塞）
const stale = baseline
  ? baseline.files.filter((b) => {
      const now = measured.find((m) => m.file === b.file);
      return !now;
    })
  : [];

console.log(`[2] 超线文件 ${measured.length} 个（新增/变胖计 FAIL；基线内未上升计 WARN 债务）...\n`);
for (const m of measured) {
  const prev = baselineMap.get(m.file);
  const tag = prev === undefined ? '新增' : `${prev} → ${m.lines}`;
  const grew = prev !== undefined && m.lines > prev;
  const level = prev === undefined || grew ? 'FAIL' : m.lines > FAIL_LINES ? 'WARN(>500)' : 'WARN';
  console.log(`  [${level}] ${m.file}: ${m.lines} 行（${tag}）`);
}
if (warnings.length > 0) {
  const overHard = warnings.filter((w) => w.lines > FAIL_LINES).length;
  console.log(
    `\n  - 已记账债务 ${warnings.length} 个（其中 ${overHard} 个超硬红线 ${FAIL_LINES}）：` +
    '本门禁不阻塞，按 handoff 拆分计划逐卡清偿；降到 ≤400 后回收基线。',
  );
}

if (stale.length > 0) {
  console.log('\n[3] 已降到红线以下、可从基线移除的文件：');
  for (const s of stale) {
    console.log(`  - ${s.file}（基线 ${s.lines} 行 → 现已 ≤ ${WARN_LINES}）`);
  }
  console.log('  → 跑 `pnpm component-size --update-baseline` 回收基线。');
}

console.log('\n=============================================');
if (violations.length > 0) {
  console.error(`[FAIL] ${violations.length} 个组件行数违规：\n`);
  for (const v of violations) {
    console.error(`  - [${v.rule}] ${v.file}`);
    console.error(`    ${v.reason}\n`);
  }
  process.exit(1);
}
if (warnings.length > 0) {
  console.log(
    `[PASS] 0 违规；${warnings.length} 个存量超线文件在基线内且未上升（棘轮允许，须有拆分计划）。`,
  );
} else {
  console.log('[PASS] 0 违规，无超线组件。');
}

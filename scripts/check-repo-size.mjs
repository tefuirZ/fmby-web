#!/usr/bin/env node

/**
 * scripts/check-repo-size.mjs — 仓库二进制产物门禁（REPO-HYGIENE-01）
 *
 * 背景：FE-OPT-02 一次性入库 76 张 playwright 截图（3.9MB PNG），前端仓会随每轮
 * UI 审计持续膨胀——与「仓库保持轻量」原则冲突（V1 70 万行教训同源）。
 *
 * 本闸守住两件事：
 *   ① **仓库级总量**（主守卫，默认 1 MiB）：`git ls-files` 列出的所有**二进制/产物**
 *      文件的字节总量不得超过 `MAX_TOTAL`。这是防膨胀的**真正不变量**——只卡单次
 *      diff 无法阻止「每次加一点」的慢性膨胀。
 *   ② **单次提交增量**（可选，`REPO_SIZE_BASE_REF`）：以 `REPO_SIZE_BASE_REF` 为
 *      基线，HEAD 相对它**新增**的二进制字节数不得超过 `MAX_DELTA`——供 CI 在 PR
 *      场景下精确拦截「本次提交的超量入库」。
 *
 * 计数口径：`git ls-files`（索引：已提交 + 已 staged）→ 对每个 blob 取 `git
 * cat-file` 的真实字节大小（不读工作树，避免未跟踪文件噪声，也能发现已 staged
 * 的大文件）。故 `git add` 了大文件但未 commit 时，本闸即会失败（预提交守卫）。
 *
 * 判定为「产物」的扩展名见 ARTIFACT_EXT（图片/字体/归档/媒体/数据库/可执行/wasm/pdf）。
 * 文本类（.ts/.css/.md/.json…）不计入——它们由 size/dupes/file-size 等闸约束。
 *
 * 策略与抽样规则见 docs/evidence-policy.md。
 */

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/** 二进制/产物扩展名（小写，不含点）。命中即计入体积预算。 */
const ARTIFACT_EXT = new Set([
  // 图片
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'tif', 'tiff', 'svgz',
  // 字体
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  // 归档 / 包
  'zip', 'gz', 'tgz', 'bz2', 'xz', 'zst', '7z', 'rar', 'tar', 'jar',
  // 媒体
  'mp3', 'mp4', 'm4a', 'm4v', 'mov', 'avi', 'mkv', 'webm', 'wav', 'flac', 'ogg', 'ogv',
  // 数据库 / 数据
  'db', 'sqlite', 'sqlite3', 'wasm',
  // 文档 / 二进制
  'pdf', 'psd', 'ai',
  // 可执行 / 库
  'exe', 'dll', 'so', 'dylib', 'bin', 'node',
]);

/** 由 `REPO_SIZE_MAX_TOTAL` 覆盖（bytes，或带 K/M 后缀）。默认 1 MiB。 */
const DEFAULT_MAX_TOTAL = 1024 * 1024;
/** 单次提交增量上限（bytes）。默认 1 MiB；仅当 `REPO_SIZE_BASE_REF` 提供时生效。 */
const DEFAULT_MAX_DELTA = 1024 * 1024;

function parseSize(raw, fallback) {
  if (raw === undefined || raw === '') return fallback;
  const m = String(raw).trim().match(/^(\d+(?:\.\d+)?)\s*([kKmM])?[bB]?$/);
  if (!m) return fallback;
  const n = Number(m[1]);
  const unit = (m[2] ?? '').toLowerCase();
  if (unit === 'k') return Math.round(n * 1024);
  if (unit === 'm') return Math.round(n * 1024 * 1024);
  return Math.round(n);
}

function fmt(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts });
}

/** 扩展名（小写，不含点）；无扩展名返回空串。 */
function extOf(p) {
  const base = p.slice(p.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/** 列出被跟踪（索引）文件路径。 */
function listTracked() {
  const out = git(['ls-files', '-z']);
  return out.split('\0').filter((s) => s.length > 0);
}

/**
 * 用 `git cat-file --batch-check` 批量取 blob 真实字节大小。
 * 返回 Map<path, {size, oid}>（只含 blob）。
 *
 * 注意：内容相同的文件共享同一 blob oid（如重复截图）——故必须**按 path 累加**，
 * 不能以 oid 作键（会把多文件折叠成一份而少算）。此处先按 oid 收集 size，
 * 再对每个 path 回写。
 */
function blobSizes(paths) {
  const info = new Map();
  if (paths.length === 0) return info;
  // `ls-files -s` 给出 <mode> <oid> <stage>\t<path>；筛选常规文件（mode 100644/100755/120000）。
  const lsOut = git(['ls-files', '-s', '-z']);
  const records = lsOut.split('\0').filter((s) => s.length > 0);
  const wanted = new Set(paths);
  const oids = new Set();
  const pathOids = [];
  for (const rec of records) {
    // 格式：<mode> <oid> <stage>\t<path>
    const tab = rec.indexOf('\t');
    if (tab < 0) continue;
    const meta = rec.slice(0, tab).split(' ');
    const path = rec.slice(tab + 1);
    const mode = meta[0];
    const oid = meta[1];
    if (!wanted.has(path)) continue;
    if (mode !== '100644' && mode !== '100755' && mode !== '120000') continue;
    oids.add(oid);
    pathOids.push({ path, oid });
  }
  if (pathOids.length === 0) return info;
  const oidList = [...oids];
  const bc = git(['cat-file', '--batch-check'], { input: `${oidList.join('\n')}\n` });
  const sizeByOid = new Map();
  for (const line of bc.split('\n')) {
    // <oid> blob <size>
    const m = line.match(/^([0-9a-f]{4,64}) blob (\d+)$/);
    if (!m) continue;
    sizeByOid.set(m[1], Number(m[2]));
  }
  // 按 path 回写（同 oid 多 path 各自计数）。
  for (const { path, oid } of pathOids) {
    const size = sizeByOid.get(oid);
    if (size !== undefined) info.set(path, { size, oid });
  }
  return info;
}

const errors = [];
const warnings = [];

// ---- ① 仓库级总量 ----
const tracked = listTracked();
const artifacts = tracked.filter((p) => ARTIFACT_EXT.has(extOf(p)));
const sizes = blobSizes(artifacts);

let total = 0;
const byDir = new Map();
const entries = [];
for (const [path, { size }] of sizes) {
  total += size;
  const top = path.includes('/') ? path.slice(0, path.indexOf('/')) : '(root)';
  const second = path.split('/').slice(0, 2).join('/');
  byDir.set(second, (byDir.get(second) ?? 0) + size);
  entries.push({ path, size });
}
entries.sort((a, b) => b.size - a.size);

const maxTotal = parseSize(process.env.REPO_SIZE_MAX_TOTAL, DEFAULT_MAX_TOTAL);

console.log('=== FMBY v2 Repo Artifact Budget Gate (REPO-HYGIENE-01) ===\n');
console.log(`二进制/产物文件：${entries.length} 个`);
console.log(`总量：${fmt(total)} / 上限：${fmt(maxTotal)}（${(100 * total / maxTotal).toFixed(0)}%）`);
console.log('');

if (byDir.size > 0) {
  console.log('按目录（Top）：');
  for (const [dir, size] of [...byDir.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`  ${fmt(size).padStart(10)}  ${dir}`);
  }
  console.log('');
}

if (entries.length > 0) {
  console.log('最大文件（Top 5）：');
  for (const e of entries.slice(0, 5)) {
    console.log(`  ${fmt(e.size).padStart(10)}  ${e.path}`);
  }
  console.log('');
}

if (total > maxTotal) {
  errors.push(
    `仓库二进制产物总量 ${fmt(total)} 超过上限 ${fmt(maxTotal)}` +
      `（超出 ${fmt(total - maxTotal)}）。请将审计产物外置（CI artifact）并只保留抽样——` +
      `策略见 docs/evidence-policy.md；可用 REPO_SIZE_MAX_TOTAL 调整上限（需主代理裁定）。`,
  );
}

// ---- ② 单次提交增量（可选） ----
const baseRef = process.env.REPO_SIZE_BASE_REF;
if (baseRef) {
  const maxDelta = parseSize(process.env.REPO_SIZE_MAX_DELTA, DEFAULT_MAX_DELTA);
  let added = [];
  try {
    const out = git(['diff', '--name-only', '--diff-filter=A', `${baseRef}..HEAD`]);
    added = out
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && ARTIFACT_EXT.has(extOf(s)));
  } catch (e) {
    warnings.push(`无法解析基线 ${baseRef}（${String(e.message).split('\n')[0]}），跳过增量检查`);
  }

  if (added.length > 0) {
    const info = blobSizes(added);
    let delta = 0;
    const detail = [];
    for (const [p, { size }] of info) {
      delta += size;
      detail.push({ path: p, size });
    }
    detail.sort((a, b) => b.size - a.size);
    console.log(`单次提交增量（基线 ${baseRef}）：${fmt(delta)} / 上限：${fmt(maxDelta)}`);
    for (const d of detail.slice(0, 5)) {
      console.log(`  +${fmt(d.size).padStart(9)}  ${d.path}`);
    }
    console.log('');
    if (delta > maxDelta) {
      errors.push(
        `本次提交新增二进制产物 ${fmt(delta)} 超过上限 ${fmt(maxDelta)}（相对 ${baseRef}）——` +
          `请外置或抽样，策略见 docs/evidence-policy.md。`,
      );
    }
  }
}

if (warnings.length > 0) {
  console.log('--- 关注项（不阻断）---');
  for (const w of warnings) console.log(`  ${w}`);
  console.log('');
}

if (errors.length > 0) {
  console.error('--- 违规项（阻断）---');
  for (const e of errors) console.error(`  ${e}`);
  console.error('\n[FAIL] 仓库体积门禁未通过。\n');
  process.exit(1);
}

console.log('[PASS] 仓库二进制产物在预算内（策略见 docs/evidence-policy.md）。\n');

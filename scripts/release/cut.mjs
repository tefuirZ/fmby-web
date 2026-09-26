#!/usr/bin/env node
// scripts/release/cut.mjs — 前端发版最小工具（fmby-web 自己的 release/cut）
//
// 背景：前端此前无 release/cut 脚本 —— 版本号（根 package.json）+ CHANGELOG 节 + tag 全靠手工，
// 且 `CHANGELOG.md` 只在发布提交里存在（分支上没有），于是「版本号/CHANGELOG/tag 三者对齐」
// 无人机械校验。本脚本只做这件事，不引入依赖、不碰 node_modules/锁文件、不 push 任何东西。
//
// 三个模式（**默认 --dry-run，任何写入都必须显式 --apply**）：
//   node scripts/release/cut.mjs                # --dry-run：打印下一版本号 + CHANGELOG 草稿 + 待执行命令（零写入）
//   node scripts/release/cut.mjs --check        # 发布线对齐校验（给 `pnpm verify` 用；非发布分支自动 SKIP）
//   node scripts/release/cut.mjs --apply        # 落盘：改 package.json 版本 + 前插 CHANGELOG 节 + commit + 打 tag
//   ──bump patch|minor|major（默认 patch）、--date YYYY-MM-DD（默认今天）
//
// 纪律（写在代码里，防止后来人顺手扩权）：不 `git push`、不改锁文件、不改 host/shared/themes 的独立版本、
// 不生成「发布说明」以外的东西。tag 一定指向 HEAD 且只在 --apply 后创建。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : d);
const mode = has('--apply') ? 'apply' : has('--check') ? 'check' : 'dry-run';
const bump = val('--bump', 'patch');
const date = val('--date', new Date().toISOString().slice(0, 10));

const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const pkgPath = join(root, 'package.json');
const logPath = join(root, 'CHANGELOG.md');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

const TYPE_LABEL = {
  feat: '功能', fix: '修复', docs: '文档/证据', refactor: '重构', test: '测试',
  perf: '性能', style: '样式', chore: '杂项/发布', build: '构建', ci: 'CI',
};
const nextVersion = (v, kind) => {
  const [maj, min, pat] = v.split('.').map(Number);
  if ([maj, min, pat].some(Number.isNaN)) throw new Error(`package.json version 不是 x.y.z：${v}`);
  return kind === 'major' ? `${maj + 1}.0.0` : kind === 'minor' ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;
};
const newestSection = (text) => text.match(/^## \[([^\]]+)\]/m)?.[1] ?? null;
const changelogVersion = existsSync(logPath) ? newestSection(readFileSync(logPath, 'utf8')) : null;

// ── --check：发布线三方对齐（版本号 == CHANGELOG 首节 == 存在的 tag，且 tag 是 HEAD 祖先）
if (mode === 'check') {
  if (!existsSync(logPath)) {
    console.log('SKIP(release-check)：本分支无 CHANGELOG.md（非发布线）——对齐校验只在发布提交上成立。');
    process.exit(0);
  }
  const v = pkg.version;
  const bad = [];
  if (changelogVersion !== v) bad.push(`package.json v${v} ≠ CHANGELOG 首节 [${changelogVersion}]`);
  const tag = `v${v}`;
  const hasTag = git('tag', '--list', tag) === tag;
  if (!hasTag) bad.push(`缺 tag ${tag}`);
  else if (execFileSync('git', ['merge-base', '--is-ancestor', tag, 'HEAD'], { cwd: root }).status) bad.push(`tag ${tag} 不是 HEAD 的祖先`);
  if (bad.length) {
    console.error('RELEASE-CHECK VIOLATION:\n  ' + bad.join('\n  '));
    process.exit(1);
  }
  console.log(`[PASS] 发布线对齐：package.json v${v} == CHANGELOG 首节 == tag ${tag}（HEAD 祖先）`);
  process.exit(0);
}

// ── 收集「相对上一版」的事实（--dry-run 与 --apply 共用）
const taggedAtHead = git('tag', '--points-at', 'HEAD').split('\n').filter(Boolean);
const prevTag = (() => {
  try { return git('describe', '--tags', '--abbrev=0', taggedAtHead.length ? 'HEAD^' : 'HEAD'); }
  catch { return null; }
})();
const range = prevTag ? `${prevTag}..HEAD` : 'HEAD';
const commits = git('log', '--no-merges', '--pretty=%h%x09%s', range).split('\n').filter(Boolean)
  .map((l) => { const [sha, subject] = l.split('\t'); return { sha, subject }; });
const shortstat = (() => { try { return git('diff', '--shortstat', range); } catch { return '(无差异统计)'; } })();
const version = nextVersion(pkg.version, bump);

const byType = new Map();
for (const c of commits) {
  const t = c.subject.match(/^([a-z]+)(\([^)]*\))?:/)?.[1] ?? 'other';
  if (!byType.has(t)) byType.set(t, []);
  byType.get(t).push(c);
}
const sections = [...byType.entries()]
  .map(([t, cs]) => `#### ${t}（${TYPE_LABEL[t] ?? '其它'}）（${cs.length}）\n\n` + cs.map((c) => `- ${c.subject}（\`${c.sha}\`）`).join('\n'))
  .join('\n\n');
const section = `## [${version}] - ${date}

**本版提交**：${commits.length} 个 ｜ **改动**：${shortstat}

### 本版做了什么

${sections || '（无提交）'}

### 相对上版

- 上版 tag：${prevTag ?? '（无——首版）'}
- ${shortstat}

### 验证

- 发布前必须 \`pnpm verify\` rc=0（本脚本不代跑、不代贴原文）
`;
const commitMsg = `chore(release): v${version} —— CHANGELOG 本版条目（${commits.length} 提交）`;

if (mode === 'dry-run') {
  console.log(`== 当前版本 v${pkg.version}（上一版 tag ${prevTag ?? '无'}）→ 拟发布 v${version}（--bump ${bump}）==`);
  console.log(`== 本版提交 ${commits.length} 个 ==`);
  console.log('\n---- CHANGELOG 拟插入节（前插到文件头）----\n' + section);
  console.log('---- --apply 将执行的写入 ----');
  console.log(`  1) package.json  version: "${pkg.version}" → "${version}"`);
  console.log(`  2) CHANGELOG.md  前插上面那一节（保留既有全部内容）`);
  console.log(`  3) git add CHANGELOG.md package.json && git commit -m '${commitMsg}'`);
  console.log(`  4) git tag -a v${version} -m 'fmby-web v${version}'`);
  console.log('  5) （不代推）人工：git push origin HEAD && git push origin v' + version);
  console.log('\n零写入（--dry-run）。确认后加 --apply。');
  process.exit(0);
}

// ── --apply：落盘 + commit + tag（**不 push**）
if (git('status', '--porcelain')) {
  console.error('--apply 要求工作树干净（git status --porcelain 为空）。');
  process.exit(1);
}
if (changelogVersion === version) {
  console.error(`CHANGELOG 已有 [${version}] 节，拒绝重复发布。`);
  process.exit(1);
}
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
writeFileSync(logPath, section + '\n' + (existsSync(logPath) ? readFileSync(logPath, 'utf8') : ''));
execFileSync('git', ['add', 'CHANGELOG.md', 'package.json'], { cwd: root, stdio: 'inherit' });
execFileSync('git', ['commit', '-m', commitMsg], { cwd: root, stdio: 'inherit' });
execFileSync('git', ['tag', '-a', `v${version}`, '-m', `fmby-web v${version}`], { cwd: root, stdio: 'inherit' });
console.log(`\n已本地提交并打 tag v${version}（未 push）。下一步：git push origin HEAD && git push origin v${version}`);

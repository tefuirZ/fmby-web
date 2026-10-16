#!/usr/bin/env node
/**
 * scripts/check-css-module-usage.selftest.mjs —— CSS Module 用法闸的**判据自测**
 *
 * 为什么必须有：这条闸曾把「定义在 `@media` 里的触屏热区类」判成「CSS 未定义」，
 * 而假阳性的代价不是噪声——是**有人照着结论去改产品代码**（把真导出的类名删掉/改名，
 * 热区就真失效了）。修判据没有回归自测 = 下一次照样换个写法漏（AGENTS.md「没有自测
 * + 没有实测生效，就等于没修」同一口径）。
 *
 * 双向都要钉：
 *   ① 类名收在 `@media` / `@supports` / `@layer` **嵌套里** ⇒ 不得报缺失（假阳性侧）；
 *   ② 类名**真不存在** ⇒ 必须报缺失且 rc=1（放宽侧 —— 证明这不是把闸调哑）；
 *   ③ `composes:` 引用的类 ⇒ 视为已导出；
 *   ④ 台账里已修好的条目仍留着 ⇒ STALE 反噬 rc=1（台账不是永久豁免）。
 *
 * 跑法：node scripts/check-css-module-usage.selftest.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATE = path.join(HERE, 'check-css-module-usage.mjs');

let failures = 0;
function check(name, cond, detail = '') {
  const ok = Boolean(cond);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ` —— ${detail}`}`);
  if (!ok) failures += 1;
}

/**
 * 搭一棵最小仓（`REPO_ROOT = scripts/..` ⇒ 放 tmp 目录里就能隔离跑，不碰真仓）。
 * @param {{css: string, tsx: string, baseline?: string}} fixture
 */
function runGate(fixture) {
  const root = mkdtempSync(path.join(tmpdir(), 'css-usage-selftest-'));
  try {
    mkdirSync(path.join(root, 'scripts'), { recursive: true });
    mkdirSync(path.join(root, 'host', 'src'), { recursive: true });
    mkdirSync(path.join(root, 'shared', 'src'), { recursive: true });
    writeFileSync(path.join(root, 'scripts', 'check-css-module-usage.mjs'),
      // 主脚本无外部 import ⇒ 直接复用真身，保证测的是同一份判据
      fixture.gateSource,
      'utf8');
    writeFileSync(path.join(root, 'host', 'src', 'x.module.css'), fixture.css, 'utf8');
    writeFileSync(path.join(root, 'host', 'src', 'a.tsx'), fixture.tsx, 'utf8');
    if (fixture.baseline !== undefined) {
      writeFileSync(path.join(root, 'scripts', 'css-module-usage-baseline.txt'), fixture.baseline, 'utf8');
    }
    let out = '';
    let code = 0;
    try {
      out = execFileSync(process.execPath, [path.join(root, 'scripts', 'check-css-module-usage.mjs')], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
      code = err.status ?? 1;
    }
    return { out, code };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const gateSource = readFileSync(GATE, 'utf8');

const TSX_ALL_DEFINED = `
import styles from './x.module.css';
export const A = () => <div className={styles.topLevel}>x</div>;
export const B = () => <td className={styles.inMedia}>y</td>;
export const C = () => <button className={styles.inMediaBtn}>z</button>;
export const D = () => <p className={styles.inSupports}>w</p>;
export const E = () => <p className={styles.inLayer}>v</p>;
export const F = () => <p className={styles.composed}>u</p>;
`;

// ① 嵌套在 at-rule 里的类名必须被认成「已定义」；composes 也算导出
const nested = runGate({
  gateSource,
  tsx: TSX_ALL_DEFINED,
  css: `
.topLevel { color: red; }
.composed { composes: topLevel from './x.module.css'; }
@media (hover: none) and (pointer: coarse) {
  .inMedia { position: relative; }
  .inMediaBtn::after { content: ''; position: absolute; inset: 0; }
}
@supports (display: grid) {
  .inSupports { display: grid; }
}
@layer components {
  .inLayer { color: blue; }
}
`,
});
check('① 嵌套在 @media/@supports/@layer 里的类名不再被判缺失（假阳性侧）',
  nested.code === 0 && nested.out.includes('发现 0 个文件'),
  `rc=${nested.code}｜${nested.out.slice(0, 240)}`);

// ② 真缺失仍必须报红（证明这不是把闸调哑）
const trulyMissing = runGate({
  gateSource,
  tsx: `
import styles from './x.module.css';
export const A = () => <div className={styles.topLevel}>x</div>;
export const B = () => <div className={styles.noSuchClass}>y</div>;
export const C = () => <div className={styles.alsoNoSuch}>z</div>;
`,
  css: `.topLevel { color: red; }
@media (hover: none) { .inMedia { position: relative; } }
`,
});
check('② 真不存在的类名仍判缺失且 rc=1（不放宽判据）',
  trulyMissing.code === 1 &&
    trulyMissing.out.includes('noSuchClass') &&
    trulyMissing.out.includes('alsoNoSuch'),
  `rc=${trulyMissing.code}｜${trulyMissing.out.slice(0, 300)}`);

// ②b at-rule 里**没定义**的类，不能因为「会看嵌套了」就被顺手放过
const missingInsideMedia = runGate({
  gateSource,
  tsx: `
import styles from './x.module.css';
export const A = () => <div className={styles.ghostInMedia}>x</div>;
`,
  css: `@media (hover: none) { .realOne { position: relative; } }`,
});
check('②b at-rule 内缺失的类名同样判红（收割范围扩大≠放过）',
  missingInsideMedia.code === 1 && missingInsideMedia.out.includes('ghostInMedia'),
  `rc=${missingInsideMedia.code}｜${missingInsideMedia.out.slice(0, 300)}`);

// ④ STALE 反噬：台账条目指向已不缺失的类 ⇒ 仍 rc=1
const stale = runGate({
  gateSource,
  tsx: TSX_ALL_DEFINED,
  css: `.topLevel { color: red; }
.composed { composes: topLevel from './x.module.css'; }
@media (hover: none) and (pointer: coarse) {
  .inMedia { position: relative; }
  .inMediaBtn::after { content: ''; }
}
@supports (display: grid) { .inSupports { display: grid; } }
@layer components { .inLayer { color: blue; } }
`,
  baseline: `# 台账\nhost/src/a.tsx|inMedia\n`,
});
check('④ 台账里已修好的条目仍触发 STALE 反噬 rc=1（台账不是永久豁免）',
  stale.code === 1 && stale.out.includes('STALE'),
  `rc=${stale.code}｜${stale.out.slice(0, 300)}`);

console.log(`\n${failures === 0 ? 'SELFTEST PASS' : 'SELFTEST FAIL'} （4 条判据，失败 ${failures}）`);
process.exit(failures === 0 ? 0 : 1);

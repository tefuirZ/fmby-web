#!/usr/bin/env node
// generate-error-contract.selftest.mjs —— 夹具 md → 解析/生成/--check 三态自测。
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = new URL('./generate-error-contract.mjs', import.meta.url).pathname;
const root = mkdtempSync('.genc-');
const fixture = join(root, 'catalog.md');
writeFileSync(fixture, [
  '# 错误码目录',
  '| `AUTH_RATE_LIMITED` | 429 | 限流 |',
  '| `PLAYBACK_SESSION_LIMIT_EXCEEDED` | 429 | 并发上限 |',
  '| `INSTALL_RATE_LIMITED` | 429 | 安装限流 |',
  '| `NOT_FOUND` | 404 | 不存在 |',
  '| `INTERNAL` | 500 | 内部错误 |',
  '',
].join('\n'));
const out = join(root, 'error-catalog.generated.ts');
const run = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { encoding: 'utf8' });

let fail = 0;
const t = (name, cond, detail) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (cond ? '' : ` :: ${detail}`)); if (!cond) fail++; };

const r1 = run('--catalog', fixture, '--out', out);
t('写出成功 rc=0', r1.status === 0, r1.stderr || r1.stdout);
const gen = readFileSync(out, 'utf8');
t('429 白名单含三码', ['AUTH_RATE_LIMITED','PLAYBACK_SESSION_LIMIT_EXCEEDED','INSTALL_RATE_LIMITED'].every(c => gen.includes(`'${c}'`)), gen.slice(0,200));
t('值域含全量（含 404/500）', gen.includes("'NOT_FOUND'") && gen.includes("'INTERNAL'"));
const r2 = run('--catalog', fixture, '--out', out, '--check');
t('--check 一致 rc=0', r2.status === 0, r2.stdout + r2.stderr);
writeFileSync(out, gen.replace("'INTERNAL',", ""));
const r3 = run('--catalog', fixture, '--out', out, '--check');
t('--check 篡改检出 rc=1', r3.status === 1, r3.stdout);

rmSync(root, { recursive: true, force: true });
process.exit(fail ? 1 : 0);

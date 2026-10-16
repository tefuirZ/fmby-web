import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  nextWizardStep,
  prevWizardStep,
  stepDone,
  stepProblem,
  WIZARD_STEPS,
  type WizardValues,
} from '../src/pages/install/installWizard.ts';

/**
 * #640「三步向导」的**步骤门控**纯函数实测。
 *
 * ★措辞口径（rb01 N1）：结构三步，但第 ② 步（服务器配置）**不收集输入、恒过**，
 *   实为核对页 ⇒ 对外称「两步填写 + 一步核对」。
 *
 * 为什么要抽出来：门控是「哪页填齐了才能往下走」的分支逻辑，塞进组件就测不到
 * （本仓无 jsdom）。判定本体仍归 `passwordPolicy.ts` / `pgConnection.ts`，
 * 这里只做编排 —— 不重写规则（honesty 测试⑩钉着）。
 */

const empty: WizardValues = {
  dbKind: 'sqlite',
  sqlitePath: '',
  cacheKind: 'builtin',
  redisUrl: '',
  pg: { host: '', port: '', database: '', username: '', password: '' },
  adminUsername: '',
  adminPassword: '',
  adminConfirm: '',
  adminDisplayName: '',
};

test('① 两步结构（SIMPLIFY-INSTALL-WIZARD：server 核对步并入 admin）', () => {
  assert.deepEqual(WIZARD_STEPS.map((s) => s.id), ['database', 'admin']);
  assert.deepEqual(WIZARD_STEPS.map((s) => s.title), ['数据库 / 缓存', '管理员']);
});

test('② SQLite + 内置缓存：第 1 页零输入即完成（卡面「留空用内置默认」）', () => {
  assert.equal(stepProblem('database', empty), null);
  assert.equal(stepDone('database', empty), true);
});

test('③ SQLite 填了路径但 PG 无关字段不该参与判定', () => {
  assert.equal(stepProblem('database', { ...empty, sqlitePath: './data/fmby.db' }), null);
});

test('④ PostgreSQL：五项不全就拦在第 1 页，且原因来自 pgConnection（不重写）', () => {
  assert.equal(
    stepProblem('database', { ...empty, dbKind: 'postgresql' }),
    '请填写数据库主机',
  );
  assert.equal(
    stepProblem('database', {
      ...empty,
      dbKind: 'postgresql',
      pg: { host: 'h', port: '5432', database: 'd', username: 'u', password: 'p' },
    }),
    null,
  );
});

test('⑤ Redis 缓存：连接串必填；内置缓存不要求任何输入', () => {
  assert.equal(stepProblem('database', { ...empty, cacheKind: 'redis' }), '请填写 Redis 连接串');
  assert.equal(stepProblem('database', { ...empty, cacheKind: 'redis', redisUrl: '  ' }), '请填写 Redis 连接串');
  assert.equal(stepProblem('database', { ...empty, cacheKind: 'redis', redisUrl: 'redis://127.0.0.1:6379' }), null);
  assert.equal(stepProblem('database', { ...empty, cacheKind: 'builtin', redisUrl: '' }), null);
});

test('⑥ 生效值核对并入管理员步（原独立 server 步已删，不再有恒过的 server 门控）', () => {
  // SIMPLIFY-INSTALL-WIZARD：原第 ②「服务器配置」核对页（恒过、不收集输入）并入 admin 步，
  // 向导收敛为两步；不再有 'server' 步。
  assert.deepEqual(WIZARD_STEPS.map((s) => s.id), ['database', 'admin']);
});

test('⑦ 第 3 页管理员：用户名必填 + 口令判定委托 passwordPolicy（弱口令拦下）', () => {
  assert.equal(stepProblem('admin', empty), '请填写管理员用户名');
  assert.equal(
    stepProblem('admin', { ...empty, adminUsername: 'root' }),
    '请先设置管理员密码',
  );
  const strong = 'Abcdefghij1!2345678';
  assert.equal(
    stepProblem('admin', { ...empty, adminUsername: 'root', adminPassword: strong, adminConfirm: '' }),
    '请再次输入口令以确认',
  );
  assert.equal(
    stepProblem('admin', { ...empty, adminUsername: 'root', adminPassword: strong, adminConfirm: `${strong}x` }),
    '两次输入的口令不一致',
  );
  assert.equal(stepDone('admin', { ...empty, adminUsername: 'root', adminPassword: strong, adminConfirm: strong }), true);
});

test('⑧ 用户名允许中文（卡面硬要求：不得按 ASCII 拦）', () => {
  const strong = 'Abcdefghij1!2345678';
  assert.equal(
    stepProblem('admin', { ...empty, adminUsername: '张 管理员', adminPassword: strong, adminConfirm: strong }),
    null,
  );
});

test('⑨ 翻页边界：第一页没有上一页，最后一页没有下一步（两步）', () => {
  assert.equal(prevWizardStep('database'), null);
  assert.equal(nextWizardStep('database'), 'admin');
  assert.equal(nextWizardStep('admin'), null);
  assert.equal(prevWizardStep('admin'), 'database');
});
test('⑩ 未完成时不能跳页往前冲（未填 PG 就想到第 3 页 ⇒ 拦）', () => {
  assert.equal(stepDone('database', { ...empty, dbKind: 'postgresql' }), false);
  assert.equal(stepDone('database', { ...empty, dbKind: 'sqlite' }), true);
});

test('⑪ 显示名可选：填了不影响判定，不填也不拦（不是门控项）', () => {
  const strong = 'Abcdefghij1!2345678';
  const base = { ...empty, adminUsername: 'root', adminPassword: strong, adminConfirm: strong };
  assert.equal(stepProblem('admin', base), null);
  assert.equal(stepProblem('admin', { ...base, adminDisplayName: '运维小张' }), null);
});

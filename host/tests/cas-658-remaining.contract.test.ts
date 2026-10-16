// FE-658-REMAINING：#658 剩余真缺的回归契约（**行为级**，照本模块自己的纪律）。
//
// 背景（先核实真缺，再动手）：
//   · 后端 `crates/fmby-v2-contracts/src/dto/cas_admin.rs` 的 `CasContentListItemDto`
//     已含 `source_kind`（#861，注释**点名**「#658 ④ 前端「秒传来源」徽章消费」）与
//     `deferred_gate` / `grace_remaining_ms`（#862 · #658 ⑤），且 `CasFanoutStatusDto.deferred`
//     提供三闸逐闸明细 —— 而前端契约此前**没有**这些字段 ⇒ 真缺。
//   · 本文件把「接上之后不许撒谎」钉住：`cas/formatCasDrive.ts` 的存在理由就是
//     「这些函数决定徽章会不会对用户撒谎，必须能被**直接调用**验证」⇒ 故此处**直接调用**，
//     不做源码字符串断言（那种断言对「把未知默认成已成功」恒绿）。
//
// 跑法：cd host && node --import ./tests/register-aliases.mjs --test tests/cas-658-remaining.contract.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const HOST_ROOT = join(import.meta.dirname, '..');
const readSrc = (rel: string) => readFile(join(HOST_ROOT, 'src', rel), 'utf8');

// Node 24 原生剥离类型 ⇒ 纯 TS 助手模块可直接 import（无 JSX/无 CSS 依赖）。
const {
  resolveSourceKindLabel,
  resolveSourceKindTone,
  resolveDeferredGateLabel,
  formatGraceRemaining,
} = await import('../src/pages/manage/cas/formatCasDrive.ts');

test('④ 秒传来源：已知码翻中文、未知码原样透出、缺失显 —（不编造）', () => {
  assert.equal(resolveSourceKindLabel('rapid_upload'), '秒传命中', 'rapid_upload = 秒传命中');
  assert.equal(resolveSourceKindLabel('publish'), '发布入库');
  assert.equal(resolveSourceKindLabel('share'), '分享转存');
  assert.equal(resolveSourceKindLabel('offline'), '离线下载');
  assert.equal(resolveSourceKindLabel('scan'), '扫描入库');
  // 未知码必须原样透出（不得默认成已知来源）
  assert.equal(resolveSourceKindLabel('quantum_teleport'), 'quantum_teleport');
  // 缺失/空串 ⇒ —（不编造）
  for (const missing of [null, undefined, '']) {
    assert.equal(resolveSourceKindLabel(missing), '—', String(missing));
  }
  // 色调：只有秒传命中用成功色
  assert.equal(resolveSourceKindTone('rapid_upload'), 'success');
  assert.equal(resolveSourceKindTone('share'), 'neutral');
  assert.equal(resolveSourceKindTone(null), 'neutral');
});

test('⑤ 三闸：在挡的闸翻中文、未知码原样透出、缺失显 —；宽限期剩余按档位格式化', () => {
  assert.equal(resolveDeferredGateLabel('none'), '可回收（无闸在挡）');
  assert.equal(resolveDeferredGateLabel('session_open'), '闸① 播放会话未关闭');
  assert.equal(resolveDeferredGateLabel('lease_active'), '闸② 租约 TTL 未到');
  assert.equal(resolveDeferredGateLabel('grace'), '闸③ 宽限期未满');
  assert.equal(resolveDeferredGateLabel('reaped'), '已回收（终态）');
  assert.equal(resolveDeferredGateLabel('unknown_gate'), 'unknown_gate');
  for (const missing of [null, undefined, '']) {
    assert.equal(resolveDeferredGateLabel(missing), '—', String(missing));
  }
  // 宽限期剩余：无关/已过/已回收后端恒 0 ⇒ 显示「—」，不显示 0s
  assert.equal(formatGraceRemaining(0), '—');
  assert.equal(formatGraceRemaining(null), '—');
  assert.equal(formatGraceRemaining(undefined), '—');
  assert.equal(formatGraceRemaining(3661000), '1h1m');
  assert.equal(formatGraceRemaining(65000), '1m5s');
  assert.equal(formatGraceRemaining(9000), '9s');
});

test('接线：三个助手不是死代码 —— 契约字段 + mapper + 两个页面都在用', async () => {
  const types = await readFile(
    join(HOST_ROOT, '..', 'shared', 'src', 'contracts', 'manage', 'casAdmin', 'types.ts'),
    'utf8',
  );
  assert.match(types, /sourceKind: string \| null/, '域契约必须有 sourceKind');
  assert.match(types, /deferredGate: string \| null/, '域契约必须有 deferredGate');
  assert.match(types, /graceRemainingMs: number \| null/, '域契约必须有 graceRemainingMs');
  assert.match(types, /deferred: CasDeferredGate \| null/, 'fanout 契约必须有 deferred 明细');

  const api = await readFile(
    join(HOST_ROOT, '..', 'shared', 'src', 'contracts', 'manage', 'casAdmin', 'api.ts'),
    'utf8',
  );
  assert.match(api, /sourceKind: raw\?\.source_kind \?\? null/, 'mapper 必须映射 source_kind（缺失⇒null）');
  assert.match(api, /deferredGate: raw\?\.deferred_gate \?\? null/, 'mapper 必须映射 deferred_gate');
  assert.match(api, /graceRemainingMs: raw\?\.grace_remaining_ms \?\? null/, 'mapper 必须映射 grace_remaining_ms');

  const listPage = await readSrc('pages/manage/CasContentListPage.tsx');
  assert.match(listPage, /秒传来源/, '列表必须有「秒传来源」列');
  assert.match(listPage, /删除安全（在挡的闸）/, '列表必须有「删除安全」列');
  assert.match(listPage, /resolveSourceKindLabel\(item\.sourceKind\)/, '列必须消费真字段');
  assert.match(listPage, /resolveDeferredGateLabel\(item\.deferredGate\)/, '列必须消费真字段');
  // 过时的 fixme 必须已被替换（后端 DTO 已合）
  assert.ok(
    !listPage.includes('后端无 DTO（fmby-v2 #862）'),
    '「后端无 DTO」fixme 必须已随接线移除（#862 已合）',
  );

  const fanoutPage = await readSrc('pages/manage/CasPublishOrchestrationPage.tsx');
  assert.match(fanoutPage, /fanoutQuery\.data\?\.deferred/, '扇出面必须消费三闸明细');
  assert.match(fanoutPage, /resolveDeferredGateLabel/, '扇出面必须用同族标签（不另造一套）');
});

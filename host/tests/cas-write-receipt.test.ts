// FE-CAS-G4（fmby-web#671 写回执）：CAS 写操作回执的分支断言。
// 运行：node --import ./tests/register-aliases.mjs --test tests/cas-write-receipt.test.ts
//
// 钉的是「UI 会不会对用户撒谎」这一类：接线初版把两个回执都映射成 Promise<void>，
// UI 只剩「已触发 / 已重试」——于是 `created=false`（幂等命中）被说成新建、
// `copy_state=failed` 被说成已重试、`pending`（回落常规上传，非错误）无处表达。

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveReconcileReceiptView,
  resolveRetryCopyView,
} from '../src/pages/manage/cas/casWriteReceipt';
import {
  mapCasReconcileTrigger,
  mapCasRetryCopy,
} from '@fmby/v2-shared/contracts/manage/casAdmin';

const retry = (over: Partial<ReturnType<typeof mapCasRetryCopy>> = {}) => ({
  driveId: 7,
  copyState: 'present',
  reasonCode: null,
  reasonDetail: null,
  reasonCodePresent: false,
  ...over,
});

test('① 对账回执：created=true 说「已入队」，created=false 必须说「幂等命中·未重复入队」', () => {
  const fresh = resolveReconcileReceiptView({ taskId: 42, created: true });
  assert.ok(fresh.label.includes('已入队'), `新建应说已入队，实际：${fresh.label}`);
  assert.ok(fresh.label.includes('42'), '必须带 task_id，便于用户去任务面核对');
  assert.equal(fresh.tone, 'success');

  const hit = resolveReconcileReceiptView({ taskId: 42, created: false });
  assert.ok(hit.label.includes('幂等命中'), `幂等命中必须明说，实际：${hit.label}`);
  assert.ok(hit.label.includes('未重复入队'), '必须否定「又排了一个队」');
  assert.ok(!hit.label.includes('已入队对账任务'), 'created=false 不得写成「已入队」');
  assert.notEqual(hit.tone, 'success', '幂等命中不是成功新建的语气');
  // 两态可分（折叠成一态就是本卡的病因）
  assert.notEqual(hit.label, fresh.label);
});

test('② 重试回执：pending 是「回落常规上传」，文案里**不得**出现失败字样', () => {
  const v = resolveRetryCopyView(retry({ copyState: 'pending' }));
  assert.doesNotMatch(v.label, /失败|错误地|异常/, `pending 不能写成失败，实际：${v.label}`);
  assert.ok(v.label.includes('常规上传'), `须说明回落常规上传，实际：${v.label}`);
  assert.ok(v.label.includes('非错误'), '须显式声明这不是错误（后端 DTO 注释原口径）');
  assert.equal(v.tone, 'warning');
});

test('③ 重试回执：failed 必须显示失败并带出 reason_code（不得被「已重试」掩盖）', () => {
  const v = resolveRetryCopyView(
    retry({ copyState: 'failed', reasonCode: 'CAS_COPY_FAILED', reasonCodePresent: true }),
  );
  assert.match(v.label, /失败/, `failed 必须显式失败：${v.label}`);
  assert.equal(v.tone, 'danger');
  // 有原因必须与「无原因」可分（复用 formatCasDrive 的原因表，不另起一份文案）
  const bare = resolveRetryCopyView(retry({ copyState: 'failed' }));
  assert.notEqual(v.label, bare.label, `带原因的文案必须不同于无原因：${v.label} / ${bare.label}`);
  assert.ok(v.label.length > bare.label.length, '原因后缀必须实际出现');
  // 未知码：原样带出（不折叠成「有原因」了事）
  const unk = resolveRetryCopyView(
    retry({ copyState: 'failed', reasonCode: 'CASbrand_new_code', reasonCodePresent: true }),
  );
  assert.ok(unk.label.includes('CASbrand_new_code'), `未知原因码须原样透出：${unk.label}`);
});

test('④ 重试回执：未知 copy_state 原样透出，不折叠成成功/失败（后端是开放字符串）', () => {
  const v = resolveRetryCopyView(retry({ copyState: 'queued' }));
  assert.ok(v.label.includes('queued'), `须原样透出新态，实际：${v.label}`);
  assert.notEqual(v.tone, 'success', '未知态不得默认成功');
  assert.notEqual(v.tone, 'danger', '未知态不得默认失败');
  // 后端漏给状态 ⇒ 说「未返回」，也不猜
  const none = resolveRetryCopyView(retry({ copyState: '' }));
  assert.ok(none.label.includes('未识别'), `缺状态须承认未知：${none.label}`);
});

test('⑤ 契约层映射：created 缺失按 false（不假定新建）；reason key 缺失 ≠ 存在但为空', () => {
  assert.equal(mapCasReconcileTrigger({ task_id: 9 }).created, false, '缺 created 不得当新建');
  assert.equal(mapCasReconcileTrigger({ task_id: 9, created: true }).created, true);
  assert.equal(mapCasReconcileTrigger(null).taskId, 0, '整个回执缺失 ⇒ taskId 0 + created false（不编造 id）');

  const absent = mapCasRetryCopy({ drive_id: 1, copy_state: 'failed' });
  const emptyButPresent = mapCasRetryCopy({
    drive_id: 1,
    copy_state: 'failed',
    reason_code: '',
  });
  assert.equal(absent.reasonCodePresent, false);
  assert.equal(emptyButPresent.reasonCodePresent, true, 'skip_serializing_if ⇒ key 缺失才是「无原因」');
  assert.notEqual(
    resolveRetryCopyView(absent).label,
    resolveRetryCopyView(emptyButPresent).label,
    '「无原因」与「给了 key 却空值」的展示必须可分（禁止 ?? 归一）',
  );
});

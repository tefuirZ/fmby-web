// fmby-web#658 / #671：CAS 失败原因（`reason_code` / `reason_detail`）行为断言。
// 运行：node --import ./tests/register-aliases.mjs --test tests/cas-failure-reason.test.ts
//
// 字段形态来自 rb01 → fe01（#671，PR #678）：wire `reason_code` / `reason_detail`
// 为 `Option<String>` + skip_serializing_if ⇒ **无原因时 key 缺失**。
// 约定：「key 缺失 ⇒ 无原因」，**不得**用 `?? ''` 渲染空串
//   —— 那会把「健康」画成「有原因但空白」。

import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCasDriveStatus } from '@fmby/v2-shared/contracts/manage/casAdmin';
import {
  KNOWN_REASON_CODES,
  hasFailureReason,
  resolveReasonDetail,
  resolveReasonLabel,
} from '../src/pages/manage/cas/formatCasDrive';

test('①a key **不存在** ⇒ 无原因（健康形态，pending/present 正常）', () => {
  // ★rb01 硬要求第 1 条：与「存在但为空」分开处理，且各一条断言。
  assert.equal(hasFailureReason(null, false), false, 'key 不存在 ⇒ 无原因');
  assert.equal(resolveReasonLabel(null, false), '', 'key 不存在 ⇒ 不渲染（空文案）');
  // 即便误传了码，只要 key 不存在也以不存在为准。
  assert.equal(hasFailureReason('CAS_COPY_FAILED', false), false);
  assert.equal(resolveReasonLabel('CAS_COPY_FAILED', false), '');
});

test('①b key **存在但为空** ⇒ 不等于「无原因」，按 fail-closed 显示「原因未提供」', () => {
  // ★rb01 硬要求第 2 条：不得与「不存在」混同（用 ?? \'\' 归一就会混同）。
  assert.equal(hasFailureReason('', true), false, '空串不是有效原因码');
  assert.equal(hasFailureReason('   ', true), false);
  const label = resolveReasonLabel('', true);
  assert.notEqual(label, '', '存在但为空**不得**返回空文案（那等于说「没原因」）');
  assert.ok(label.includes('原因未提供'), `须明确说「原因未提供」，实际：${label}`);
  // 与 ①a 的结果必须不同 —— 这正是「分开处理」的可观测证据。
  assert.notEqual(
    resolveReasonLabel('', true),
    resolveReasonLabel(null, false),
    '「存在但为空」与「key 不存在」的展示必须不同（禁止 ?? 归一）',
  );
});

test('①c 契约层：key 缺失与 key 存在但为空，映射结果必须可分', () => {
  const absent = mapCasDriveStatus({ drive_id: 1, copy_state: 'present' });
  const emptyButPresent = mapCasDriveStatus({
    drive_id: 2,
    copy_state: 'failed',
    reason_code: '',
  });
  assert.equal(absent.reasonCodePresent, false, 'key 缺失 ⇒ present=false');
  assert.equal(emptyButPresent.reasonCodePresent, true, 'key 存在 ⇒ present=true');
  assert.equal(absent.reasonCode, null);
  assert.equal(emptyButPresent.reasonCode, '', '存在但为空 ⇒ 空串（**不是** null）');
});

test('② 契约层：wire key 缺失 ⇒ null，**不是空串**（防 ?? \x27\x27 渲染）', () => {
  // 后端「pending / present 时两个 key 都不出现」的真实形态。
  const mapped = mapCasDriveStatus({
    drive_id: 1,
    provider_type: 'local',
    drive_ref: 'd1',
    copy_state: 'present',
  });
  assert.equal(mapped.reasonCode, null, 'key 缺失 ⇒ null');
  assert.equal(mapped.reasonDetail, null);
  assert.equal(mapped.reasonCodePresent, false);
  assert.notEqual(mapped.reasonCode as unknown, '', '绝不能是空串');
  // 端到端：无原因时展示层文案为空（调用方据此整行不渲染）。
  assert.equal(resolveReasonLabel(mapped.reasonCode, mapped.reasonCodePresent), '');
});

test('③ 已知两码 ⇒ 中文文案（与 #671 取值集合逐一对齐）', () => {
  assert.equal(resolveReasonLabel('CAS_COPY_FAILED', true), '盘上实体丢失');
  assert.equal(resolveReasonLabel('CAS_COPY_TOMBSTONED', true), '上游文件已删 / 墓碑化');
});

test('④ 已知集合**精确等于** #671 的两码（不多不少，防发明 / 漏登记）', () => {
  assert.deepEqual([...KNOWN_REASON_CODES].sort(), [
    'CAS_COPY_FAILED',
    'CAS_COPY_TOMBSTONED',
  ]);
  for (const ghost of ['CAS_COPY_MISSING', 'COPY_FAILED', 'failed']) {
    assert.ok(!KNOWN_REASON_CODES.includes(ghost), `${ghost} 后端未定义，不得发明`);
  }
});

test('⑤ 未知新码 ⇒ fail-closed **显示原文码**，绝不静默归入「无原因」', () => {
  const label = resolveReasonLabel('CAS_COPY_SOMETHING_NEW', true);
  assert.notEqual(label, '', '未知码不得返回空（那等于说「没原因」）');
  assert.ok(
    label.includes('CAS_COPY_SOMETHING_NEW'),
    `未知码须带原文码以便上报，实际：${label}`,
  );
});

test('⑥ 明细：空 / 纯空白 / 缺失 ⇒ 空串（调用方据此不渲染孤立空行）', () => {
  assert.equal(resolveReasonDetail(null), '');
  assert.equal(resolveReasonDetail(''), '');
  assert.equal(resolveReasonDetail('   '), '');
  assert.equal(resolveReasonDetail(' 上游 404 '), '上游 404', '有效明细需 trim 后保留');
});

test('⑦ 有原因 + 有明细 ⇒ 两者都给（端到端形态）', () => {
  const mapped = mapCasDriveStatus({
    drive_id: 2,
    provider_type: 'local',
    drive_ref: 'd2',
    copy_state: 'failed',
    reason_code: 'CAS_COPY_FAILED',
    reason_detail: '校验和不匹配',
  });
  assert.equal(hasFailureReason(mapped.reasonCode, mapped.reasonCodePresent), true);
  assert.equal(
    resolveReasonLabel(mapped.reasonCode, mapped.reasonCodePresent),
    '盘上实体丢失',
  );
  assert.equal(resolveReasonDetail(mapped.reasonDetail), '校验和不匹配');
});

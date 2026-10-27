// W-A-RESUME 契约锁：媒体条目状态词表对齐后端二元真值，防再漂。
//
// 后端真源（fmby-v2 main，当次核对原文）：
// - source   ∈ {mounted, missing}     （catalog_repo read.rs:195 / pg:251）
// - metadata ∈ {identified, missing}   （read.rs:202 / pg:253）
// - mount    ∈ {configured, unavailable, maintenance, verified}
//              （dto/manage.rs:188-202 单一真源；未挂载 wire=null → convert.rs 诚实缺省 missing）
// - /api/search 筛选白名单（query_mapping.rs:49-66）：source=mounted|missing、
//   metadata=identified|missing、mount=四值；**V1 词表值 → 400 fail-closed**
//   （search_route_tests.rs:532 "sourceStatus=Broken" 用例）。
//
// 旧 FE mapper 只认 V1 词表（playable/success/…）⇒ mounted/identified 全落
// default ⇒ 列表每行「状态缺失/元数据缺失」（每行说假话的 live bug）。

import test from 'node:test';
import assert from 'node:assert/strict';

const { mapSourceStatus, mapMetadataStatus, mapMountStatus, mapSourceStatusToApi, mapMetadataStatusToApi, mapMountStatusToApi } =
  await import('../src/contracts/manage/media-items/api/mappers-enum.ts');

test('source：mounted → mounted（不再落 default 伪造「缺失」）', () => {
  assert.equal(mapSourceStatus('mounted'), 'mounted');
  assert.equal(mapSourceStatus('MOUNTED'), 'mounted');
});

test('metadata：identified → identified（不再落 default 伪造「缺失」）', () => {
  assert.equal(mapMetadataStatus('identified'), 'identified');
  assert.equal(mapMetadataStatus('Identified'), 'identified');
});

test('mount：四值全认识（configured/unavailable/maintenance/verified）', () => {
  assert.equal(mapMountStatus('configured'), 'configured');
  assert.equal(mapMountStatus('unavailable'), 'unavailable');
  assert.equal(mapMountStatus('maintenance'), 'maintenance');
  assert.equal(mapMountStatus('verified'), 'verified');
});

test('未知值 fail-soft → missing（不伪造已知态；default 分支保留）', () => {
  assert.equal(mapSourceStatus('playable'), 'missing', 'V1 旧值不得再被认成已知态');
  assert.equal(mapSourceStatus(null), 'missing');
  assert.equal(mapSourceStatus(''), 'missing');
  assert.equal(mapMetadataStatus('success'), 'missing');
  assert.equal(mapMetadataStatus(undefined), 'missing');
  assert.equal(mapMountStatus('active'), 'missing');
  assert.equal(mapMountStatus('disabled'), 'missing');
});

test('ToApi：missing 必须直发（筛选「缺失」不再被吞成 undefined）', () => {
  assert.equal(mapSourceStatusToApi('missing'), 'missing');
  assert.equal(mapSourceStatusToApi('mounted'), 'mounted');
  assert.equal(mapMetadataStatusToApi('identified'), 'identified');
  assert.equal(mapMetadataStatusToApi('missing'), 'missing');
  // mount 白名单无 missing ⇒ 不发（undefined），防 /api/search 400
  assert.equal(mapMountStatusToApi('missing'), undefined);
  assert.equal(mapMountStatusToApi('verified'), 'verified');
});

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

const enumMappers = await import('../src/contracts/manage/media-items/api/mappers-enum.ts');
const { mapSourceStatus, mapMetadataStatus, mapMountStatus, mapSourceStatusToApi, mapMetadataStatusToApi } = enumMappers as typeof import('../src/contracts/manage/media-items/api/mappers-enum');
const { mapQueryParams } = await import('../src/contracts/manage/media-items/api/mappers-payload.ts');
const { mapListRecord } = await import('../src/contracts/manage/media-items/api/mappers-record.ts');

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
});

test('FE-1：query params 不再发死契约参 mountStatus/hasPoster/hasSubtitle', () => {
  // 旧 mapQueryParams 把这三个键恒发（值 undefined）或按不存在的后端筛选发 ——
  // 后端 MediaItemsQuery 连下划线名都不接（dto/manage.rs），发即静默丢弃。
  const params = mapQueryParams({
    page: 2,
    pageSize: 20,
    keyword: 'matrix',
    libraryId: '1',
    mediaType: 'movie',
    sourceStatus: 'mounted',
    metadataStatus: 'identified',
    hasLocalOverride: true,
    sortBy: 'updated_at',
    sortOrder: 'desc',
  } as Parameters<typeof mapQueryParams>[0]) as Record<string, unknown>;
  const keys = Object.keys(params);
  assert.equal('mountStatus' in params, false, 'mountStatus 是死契约参，不得再发');
  assert.equal('hasPoster' in params, false, 'hasPoster 是死契约参，不得再发');
  assert.equal('hasSubtitle' in params, false, 'hasSubtitle 是死契约参，不得再发');
  assert.equal(keys.includes('mount_status'), false, '下划线名同样不得发（后端不收）');
  assert.deepEqual(keys.sort(), [
    'hasLocalOverride', 'keyword', 'libraryId', 'mediaType',
    'metadataStatus', 'page', 'pageSize', 'sortBy', 'sortOrder', 'sourceStatus',
  ]);
  assert.equal(params.sourceStatus, 'mounted');
  assert.equal(params.metadataStatus, 'identified');
});

test('FE-1：列表 mapper 读的是真实下划线 wire 名（source_status/metadata_status/mount_status）', () => {
  // 响应侧一直是对的：mapListRecord 读 raw.source_status（mappers-record.ts:53-55）。
  // 本用例锁住：字段名换回 camelCase 或其它拼写时立即红。
  const rec = mapListRecord({
    id: '501',
    library_id: '1',
    library_name: 'movies',
    title: 'The Matrix',
    media_type: 'movie',
    type_label: '电影',
    source_status: 'mounted',
    mount_status: 'verified',
    metadata_status: 'identified',
    has_local_override: false,
    has_local_metadata_override: false,
    has_local_artwork_override: false,
    has_local_subtitle_override: false,
    has_poster: true,
    has_subtitle: false,
    updated_at: 1_700_000_000_000,
  } as Parameters<typeof mapListRecord>[0]);
  assert.equal(rec.sourceStatus, 'mounted', '读的是 source_status（下划线）');
  assert.equal(rec.mountStatus, 'verified', '读的是 mount_status（下划线）');
  assert.equal(rec.metadataStatus, 'identified', '读的是 metadata_status（下划线）');
  assert.equal(rec.hasPoster, true);
  assert.equal(rec.hasSubtitle, false);
});

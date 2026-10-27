// W-METAFAMILY 契约锁：把 **BE 真实 wire 形状**冻结成 FE 侧判据，防再漂移。
//
// 背景（fmby-v2 #2263 / 报告 W-METAFAMILY.md §①）：
// - BE `base_metadata`/`effective_metadata` 曾恒 null ⇒ `mapMetadata(null)`
//   无守卫访问 ⇒ **详情页整页 TypeError**（e2e 基线红 38 条同族）；
// - BE `local_metadata_override` 为**扁平**形状（V1 wrapper 漂移），原 mapper
//   直取 `raw.metadata` ⇒ 有覆写的条目二次 TypeError；
// - `premiered` wire = RFC3339 UTC 字符串（V1 `DateTime<Utc>` parity），
//   `useMetadataForm.toDateInputValue` 只认它；
// - `metadata_status` BE 用 V2 字段名（base_state/…），FE 按 V1 名读 ⇒ 降级
//   `missing`（有意登记，非崩溃）。
//
// 形状来源：fmby-v2 `crates/fmby-v2-server/src/tests/media_metadata_override_read_tests.rs`
// 与 `bridges/manage_media.rs::metadata_override_wire`（当次核对原文）。

import test from 'node:test';
import assert from 'node:assert/strict';

const { mapDetailRecord } = await import('../src/contracts/manage/media-items/api/mappers-metadata.ts');
const { mapUpdatePayloadToApi } = await import('../src/contracts/manage/media-items/api/mappers-payload.ts');

// BE 真实 detail wire（V2 扁平 override + V2 metadata_status 字段名 +
// base/effective 真装配后的形态——外层键名以 BE `ManagedMediaItemDetailResponse` 为准）。
const BE_DETAIL_WIRE = {
  item: {
    id: '5031',
    library_id: '1',
    library_name: 'movies',
    title: 'The Matrix',
    original_title: 'The Matrix',
    media_type: 'movie',
    year: 1999,
    has_local_override: true,
  },
  // 旧 BE（修复前）恒 null ⇒ 不得崩，映射为空记录：
  base_metadata: null,
  effective_metadata: null,
  remote_metadata: null,
  scraped_metadata: null,
  scraped_artworks: [],
  local_metadata_override: {
    // ★扁平：审计归属字段缺失（undefined），覆写键平铺。
    title: '改过的标题',
    sort_title: 'matrix',
    overview: '人工写的简介',
    community_rating: 9.1,
    premiered: '2024-01-01T00:00:00.000Z',
    genres: ['科幻'],
    studios: [],
  },
  metadata_status: {
    // BE V2 字段名（FE 按 V1 名读 ⇒ 降级 missing，登记非崩溃）。
    base_state: 'ready',
    scrape_state: 'missing',
    effective_source: 'unknown',
    has_override: true,
  },
  sources: [],
  remote_assets: [],
  artwork_overrides: [],
  subtitle_overrides: [],
};

test('BE 扁平 local_metadata_override 不崩（原 raw.metadata 直取 = TypeError 崩溃点）', () => {
  const rec = mapDetailRecord(structuredClone(BE_DETAIL_WIRE));
  // metadata_status 按 V1 名读（has_local_override 缺失）⇒ 降级 undefined（登记非崩溃）。
  assert.equal(rec.metadataStatus.hasLocalOverride, undefined);
  // 扁平 override 映射成功：审计字段 undefined 不崩，metadata 正确落位。
  assert.equal(rec.localMetadataOverride?.updatedBy, undefined);
  assert.equal(rec.localMetadataOverride?.metadata.title, '改过的标题');
  assert.equal(rec.localMetadataOverride?.metadata.premiered, '2024-01-01T00:00:00.000Z');
});

test('base/effective_metadata 为 null 时映射为空记录（修复前 = mapMetadata(null) 整页崩）', () => {
  const wire = {
    ...structuredClone(BE_DETAIL_WIRE),
    local_metadata_override: null,
  } as unknown as Parameters<typeof mapDetailRecord>[0];
  const rec = mapDetailRecord(wire);
  assert.deepEqual(rec.baseMetadata, {
    title: undefined,
    originalTitle: undefined,
    sortTitle: undefined,
    year: undefined,
    overview: undefined,
    communityRating: undefined,
    genres: [],
    directors: [],
    actors: [],
    studios: [],
    premiered: undefined,
    externalIds: [],
  });
  assert.deepEqual(rec.effectiveMetadata, rec.baseMetadata);
});

test('BE 真装配后的 base/effective（RFC3339 premiered）端到端可读', () => {
  const wire = {
    ...structuredClone(BE_DETAIL_WIRE),
    base_metadata: {
      title: 'The Matrix',
      original_title: 'The Matrix',
      year: 1999,
      overview: '刮削来的简介',
      community_rating: 7.5,
      premiered: '1999-03-31T00:00:00.000Z',
      genres: ['科幻'],
      studios: [],
      external_ids: [{ provider: 'tmdb', id: '603' }],
    },
    effective_metadata: {
      title: '改过的标题',
      original_title: 'The Matrix',
      year: 1999,
      overview: '人工写的简介',
      community_rating: 9.1,
      premiered: '2024-01-01T00:00:00.000Z',
      genres: ['科幻'],
      studios: [],
      external_ids: [{ provider: 'tmdb', id: '603' }],
    },
    local_metadata_override: {
      title: '改过的标题',
      overview: '人工写的简介',
      premiered: '2024-01-01T00:00:00.000Z',
    },
  } as unknown as Parameters<typeof mapDetailRecord>[0];
  const rec = mapDetailRecord(wire);
  // base：表单初值真源（原恒 null ⇒ 表单永不起初值）。
  assert.equal(rec.baseMetadata.title, 'The Matrix');
  assert.equal(rec.baseMetadata.overview, '刮削来的简介');
  assert.equal(rec.baseMetadata.premiered, '1999-03-31T00:00:00.000Z');
  // effective：覆写优先 + RFC3339 直达表单日期输入。
  assert.equal(rec.effectiveMetadata.title, '改过的标题');
  assert.equal(rec.effectiveMetadata.premiered, '2024-01-01T00:00:00.000Z');
  // override 扁平：审计字段 undefined 不崩；metadata 正确落位。
  assert.equal(rec.localMetadataOverride?.updatedBy, undefined);
  assert.equal(rec.localMetadataOverride?.metadata.title, '改过的标题');
  assert.equal(rec.localMetadataOverride?.metadata.premiered, '2024-01-01T00:00:00.000Z');
});

test('FE→BE PATCH payload：12 键形状冻结（后端契约测试镜像，BE 侧同形状锁在 contracts）', () => {
  const payload = mapUpdatePayloadToApi({
    title: '黑客帝国',
    originalTitle: 'The Matrix',
    sortTitle: 'matrix',
    year: 1999,
    overview: '概览',
    communityRating: 8.5,
    genres: ['科幻'],
    directors: ['导演甲', '导演甲'],
    actors: [{ name: '基努·里维斯', role: 'Neo' }],
    studios: [],
    premiered: '2024-01-01',
  });
  assert.deepEqual(Object.keys(payload).sort(), [
    'actors',
    'community_rating',
    'directors',
    'genres',
    'original_title',
    'overview',
    'premiered',
    'sort_title',
    'studios',
    'title',
    'year',
  ]);
  assert.equal(payload.actors?.[0]?.name, '基努·里维斯');
  assert.equal((payload.actors?.[0] as Record<string, unknown>)['thumb_url'], undefined);
});

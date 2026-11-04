// PROVIDER-SEARCH-MAPPER：`GET /api/manage/media-items/{id}/provider-search` 的
// snake_case wire → 域类型（camelCase）映射回归。
//
// 为什么要有它（2026-11-04，真机事故链）：
//   后端 `ManagedProviderCandidateDto`（crates/fmby-v2-http/src/dto/manage_media_scrape.rs:108-120）
//   **裸派生、无 rename_all**，wire 是 `provider_item_id` / `entity_type` / `original_title` /
//   `external_ids[]`；前端 `types.ts:454-464` 声明 camelCase；而 `queries.ts` 的
//   `searchMediaItemProvider` 直接 `return raw` **没有 mapper** ⇒ 运行时
//   `c.providerItemId` 恒 undefined ⇒ 人工匹配面板「外部编号恒空、点候选后
//   matchProviderItemId.trim() 抛 TypeError、所有候选同时高亮」。
//
// 该缺陷藏在 check-contract-sync 的「映射后域类型」盲区里（非 Raw* 类型不做字段级对账），
// 故用前端契约测试钉住。

import test from 'node:test';
import assert from 'node:assert/strict';

(globalThis as { window?: unknown }).window = { location: { origin: 'http://localhost:5173' } };

const captured: Array<{ method: string; url: string }> = [];
let nextJson: unknown = {};

(globalThis as { fetch?: unknown }).fetch = async (input: unknown, init: Record<string, unknown> = {}) => {
  const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input);
  captured.push({ method: String(init.method ?? 'GET').toUpperCase(), url });
  return new Response(JSON.stringify(nextJson), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

const { mediaItemsApi } = await import('@fmby/v2-shared/contracts/manage/media-items');

test('provider-search：后端 snake_case 候选必须映射为 camelCase 域字段', async () => {
  // 后端真实 wire（无 rename_all）
  nextJson = {
    provider: 'tmdb',
    query: 'matrix',
    candidates: [
      {
        provider: 'tmdb',
        entity_type: 'movie',
        provider_item_id: '12345',
        title: 'The Matrix',
        original_title: 'The Matrix',
        year: 1999,
        overview: '...',
        confidence: 0.97,
        external_ids: [{ provider: 'tvdb', id: '999' }],
        evidence_json: {},
      },
    ],
  };

  const res = await mediaItemsApi.searchMediaItemProvider('7', { provider: 'tmdb', query: 'matrix' });

  // 请求侧
  assert.equal(captured.at(-1)!.method, 'GET');
  assert.equal(new URL(captured.at(-1)!.url).pathname, '/api/manage/media-items/7/provider-search');
  assert.equal(new URL(captured.at(-1)!.url).searchParams.get('q'), 'matrix');

  // 响应侧：这四个字段是本次事故的核心（此前恒 undefined）
  const c = res.candidates[0]!;
  assert.equal(c.providerItemId, '12345', 'provider_item_id 必须映射到 providerItemId');
  assert.equal(c.entityType, 'movie', 'entity_type 必须映射到 entityType');
  assert.equal(c.originalTitle, 'The Matrix', 'original_title 必须映射到 originalTitle');
  assert.equal(c.externalId, '999', 'external_ids[0].id 必须映射到 externalId');

  // 同名/可空字段
  assert.equal(c.provider, 'tmdb');
  assert.equal(c.title, 'The Matrix');
  assert.equal(c.year, 1999);
  assert.equal(c.confidence, 0.97);
  assert.equal(res.provider, 'tmdb');
  assert.equal(res.query, 'matrix');
});

test('provider-search：可选字段缺失时收敛为 null（不伪造）', async () => {
  nextJson = {
    provider: 'douban',
    query: 'x',
    candidates: [
      {
        provider: 'douban',
        entity_type: 'tv',
        provider_item_id: '42',
        title: 'T',
        confidence: 1,
        external_ids: [],
        evidence_json: {},
      },
    ],
  };

  const res = await mediaItemsApi.searchMediaItemProvider('7', { provider: 'douban', query: 'x' });
  const c = res.candidates[0]!;
  assert.equal(c.originalTitle, null);
  assert.equal(c.year, null);
  assert.equal(c.overview, null);
  assert.equal(c.externalId, null);
});
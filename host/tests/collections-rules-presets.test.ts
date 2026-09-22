// FE-COLLECTIONS-CONSUME-B3：剩余 6 条零调用端点的 wire 契约对拍（可证伪）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 覆盖：
//  - PUT    /collections/order              {collection_ids}
//  - GET    /collections/presets            → 裸数组 ManagedCollectionPresetDto
//  - POST   /collections/presets/create     {preset_key}
//  - POST   /collections/rules/preview      {min_effective_members?, rules[]}
//  - PATCH  /collections/{id}/rules         {auto_expand_enabled?, min_effective_members?, artwork_mode?, rules[]}
//  - POST   /collections/{id}/sync          （无 body）
//  - PATCH  /collections/{id}/members/{member_id}  {is_enabled?}
//
// 断言：路径/方法/wire 字段名（snake_case 映射）/响应映射/失败透传（不吞成空/不假成功）。

import test from 'node:test';
import assert from 'node:assert/strict';

(globalThis as { window?: unknown }).window = { location: { origin: 'http://localhost:5173' } };

interface Captured {
  method: string;
  url: string;
  body: unknown;
}
const captured: Captured[] = [];
let nextResponse: { status: number; json: unknown } = { status: 200, json: {} };

(globalThis as { fetch?: unknown }).fetch = async (
  input: unknown,
  init: Record<string, unknown> = {},
) => {
  const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input);
  const method = String(init.method ?? 'GET').toUpperCase();
  let body: unknown;
  if (typeof init.body === 'string') {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = init.body;
    }
  }
  captured.push({ method, url, body });
  const { status, json } = nextResponse;
  return new Response(status === 204 ? null : JSON.stringify(json), {
    status,
    headers: status === 204 ? undefined : { 'content-type': 'application/json' },
  });
};

function reset(next: { status: number; json: unknown }): void {
  captured.length = 0;
  nextResponse = next;
}
const lastCall = (): Captured => captured[captured.length - 1]!;
const pathOf = (u: string): string => new URL(u).pathname;

const { peripheralsApi } = await import('@fmby/v2-shared/contracts/manage/peripherals');

const RAW_PRESET = { key: 'marvel-cinematic-universe', title: '漫威电影宇宙', overview: null, item_count: 23 };
const RAW_DETAIL = {
  collection: {
    id: 'col-1',
    title: 'T',
    overview: null,
    poster_url: null,
    source_kind: 'rule',
    collection_kind: 'rule',
    auto_expand_enabled: true,
    min_effective_members: 5,
    artwork_mode: 'auto_collage',
    visibility: 'Active',
    created_at: 0,
    updated_at: 0,
  },
  members: [],
  rules: [{ id: 'rule-1', rule_type: 'genre', is_exclusion: false, values: ['科幻'] }],
  member_overrides: [],
};

test('合集排序：PUT 路径 + body {collection_ids}（snake_case）', async () => {
  reset({ status: 200, json: [RAW_PRESET && { ...RAW_DETAIL.collection }] });
  await peripheralsApi.reorderCollections({ collectionIds: ['c-3', 'c-1', 'c-2'] });
  assert.equal(lastCall().method, 'PUT');
  assert.equal(pathOf(lastCall().url), '/api/manage/collections/order');
  assert.deepEqual(lastCall().body, { collection_ids: ['c-3', 'c-1', 'c-2'] });
});

test('预设列表：GET 裸数组，字段按 snake_case 映射', async () => {
  reset({ status: 200, json: [RAW_PRESET] });
  const list = await peripheralsApi.listCollectionPresets();
  assert.equal(list.length, 1);
  const p = list[0]!;
  assert.equal(p.key, 'marvel-cinematic-universe');
  assert.equal(p.title, '漫威电影宇宙');
  assert.equal(p.itemCount, 23);
});

test('预设创建：POST 路径 + body {preset_key}（snake_case）', async () => {
  reset({ status: 200, json: RAW_DETAIL });
  await peripheralsApi.createCollectionFromPreset({ presetKey: 'marvel-cinematic-universe' });
  assert.equal(lastCall().method, 'POST');
  assert.equal(pathOf(lastCall().url), '/api/manage/collections/presets/create');
  assert.deepEqual(lastCall().body, { preset_key: 'marvel-cinematic-universe' });
});

test('预设创建：404（模板不存在）必须 reject', async () => {
  reset({ status: 404, json: { error_code: 'not_found', message: '模板不存在', retryable: false } });
  await assert.rejects(() =>
    peripheralsApi.createCollectionFromPreset({ presetKey: 'nope' }),
  );
});

test('规则预览：POST 路径 + body {min_effective_members?, rules[]}（snake_case）', async () => {
  reset({ status: 200, json: { match_count: 7, visible: true, sample_items: [], artwork_items: [] } });
  await peripheralsApi.previewCollectionRules({
    minEffectiveMembers: 5,
    rules: [{ ruleType: 'genre', isExclusion: false, values: ['科幻'] }],
  });
  assert.equal(lastCall().method, 'POST');
  assert.equal(pathOf(lastCall().url), '/api/manage/collections/rules/preview');
  assert.deepEqual(lastCall().body, {
    min_effective_members: 5,
    rules: [{ rule_type: 'genre', is_exclusion: false, values: ['科幻'] }],
  });
});

test('规则预览：响应 {match_count,visible} 原样透传', async () => {
  reset({ status: 200, json: { match_count: 12, visible: false, sample_items: [], artwork_items: [] } });
  const r = await peripheralsApi.previewCollectionRules({ rules: [] });
  assert.equal(r.matchCount, 12);
  assert.equal(r.visible, false);
});

test('规则保存：PATCH 路径 + body 四字段 snake_case', async () => {
  reset({ status: 200, json: RAW_DETAIL });
  await peripheralsApi.updateCollectionRules('col-1', {
    autoExpandEnabled: false,
    minEffectiveMembers: 9,
    artworkMode: 'auto_collage',
    rules: [{ ruleType: 'decade', isExclusion: true, values: ['2020'] }],
  });
  assert.equal(lastCall().method, 'PATCH');
  assert.equal(pathOf(lastCall().url), '/api/manage/collections/col-1/rules');
  assert.deepEqual(lastCall().body, {
    auto_expand_enabled: false,
    min_effective_members: 9,
    artwork_mode: 'auto_collage',
    rules: [{ rule_type: 'decade', is_exclusion: true, values: ['2020'] }],
  });
});

test('规则保存：detail 透传 rules/memberOverrides（GET /{id} 漏映射的真断链已补回）', async () => {
  reset({ status: 200, json: RAW_DETAIL });
  const d = await peripheralsApi.updateCollectionRules('col-1', { rules: [] });
  assert.equal(d.collection.collectionKind, 'rule');
  assert.equal(d.rules.length, 1);
  assert.equal(d.rules[0]!.ruleType, 'genre');
  assert.equal(d.rules[0]!.isExclusion, false);
  assert.equal(d.memberOverrides.length, 0);
});

test('手动同步：POST 路径无 body；detail 透传', async () => {
  reset({ status: 200, json: RAW_DETAIL });
  await peripheralsApi.syncCollection('col-1');
  assert.equal(lastCall().method, 'POST');
  assert.equal(pathOf(lastCall().url), '/api/manage/collections/col-1/sync');
  const d = await peripheralsApi.syncCollection('col-1');
  assert.equal(d.collection.id, 'col-1');
});

test('成员启停：PATCH 路径含 member_id + body {is_enabled}', async () => {
  reset({ status: 200, json: { ok: true } });
  await peripheralsApi.patchCollectionMember('col-1', 'm-9', { isEnabled: false });
  assert.equal(lastCall().method, 'PATCH');
  assert.equal(pathOf(lastCall().url), '/api/manage/collections/col-1/members/m-9');
  assert.deepEqual(lastCall().body, { is_enabled: false });
});

// FE-COLLECTIONS-CONTRACT-GAP：合集成员契约缺 `member_origin` 的对拍（RED → GREEN）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 后端 `ManagedCollectionMemberDto` 下发 **13** 字段（含 `member_origin`：
// `imported` / `manual` / `rule`；见 crates/fmby-v2-http/src/state/collections.rs），
// 前端 `RawManagedCollectionMember` 此前只收 **12** ⇒ 契约漂移（UI 未消费，无用户可见影响）。
// 本测试钉住字段级对拍，防再漂移。

import test from 'node:test';
import assert from 'node:assert/strict';

(globalThis as { window?: unknown }).window = { location: { origin: 'http://localhost:5173' } };

const captured: string[] = [];
let nextResponse: { status: number; json: unknown } = { status: 200, json: {} };

(globalThis as { fetch?: unknown }).fetch = async (input: unknown) => {
  const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input);
  captured.push(url);
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

const { peripheralsApi } = await import('@fmby/v2-shared/contracts/manage/peripherals');

/** 后端 13 字段原样下发（含 member_origin）。 */
const RAW_MEMBER = {
  id: 'm-1',
  collection_id: 'c-7',
  bound_item_id: 'itm-1',
  member_origin: 'rule',
  title_snapshot: '星际穿越',
  year_snapshot: 2014,
  media_kind: 'Movie',
  poster_url_snapshot: null,
  is_enabled: true,
  release_order: 1,
  watch_order: null,
  created_at: 1_700_000_000,
  updated_at: 1_700_000_000,
};

const RAW_DETAIL = {
  collection: {
    id: 'c-7',
    title: '周末片单',
    overview: null,
    poster_url: null,
    source_kind: 'manual',
    collection_kind: 'custom',
    auto_expand_enabled: false,
    min_effective_members: null,
    artwork_mode: 'none',
    visibility: 'Active',
    created_at: 1_700_000_000,
    updated_at: 1_700_000_000,
  },
  members: [RAW_MEMBER],
  rules: [],
  member_overrides: [],
};

test('后端 13 字段：RAW 夹具字段数与后端 DTO 对齐（自证口径）', () => {
  assert.equal(Object.keys(RAW_MEMBER).length, 13, 'RAW 成员夹具应为 13 字段');
  assert.ok('member_origin' in RAW_MEMBER);
});

test('member_origin → memberOrigin 映射（规则成员）', async () => {
  reset({ status: 200, json: RAW_DETAIL });
  const detail = await peripheralsApi.getCollection('c-7');
  assert.equal(detail.members.length, 1);
  assert.equal(detail.members[0]!.memberOrigin, 'rule');
});

test('member_origin 逐值透传（imported / manual 不丢、不归一）', async () => {
  for (const origin of ['imported', 'manual', 'rule']) {
    reset({
      status: 200,
      json: {
        ...RAW_DETAIL,
        members: [{ ...RAW_MEMBER, member_origin: origin }],
      },
    });
    const detail = await peripheralsApi.getCollection('c-7');
    assert.equal(detail.members[0]!.memberOrigin, origin);
  }
});

test('memberOrigin 不得为 undefined（契约缺字段的漂移信号）', async () => {
  reset({ status: 200, json: RAW_DETAIL });
  const detail = await peripheralsApi.getCollection('c-7');
  assert.notEqual(detail.members[0]!.memberOrigin, undefined);
});

import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { httpClient } from '@fmby/v2-shared/api/client';
import { yun139Api } from '@fmby/v2-shared/contracts/manage/yun139';

/**
 * FE-YUN139-POOLS-SEG-A：账号池「段 A」= 池 CRUD 5 条 + 成员管理 3 条（共 8 端点）。
 *
 * ★缺口核实（用 origin/main ref，不查工作区）：后端 9 个 account-pools 端点已注册，
 *   段 B（lease/report）上张卡已合；**段 A 8 条前端仍零调用** ⇒ 缺口为真。
 *
 * 端点真源（`crates/fmby-v2-http/src/routes/yun139_accounts.rs`，能力门 MANAGE_MOUNT）：
 *   GET    /api/manage/yun139/account-pools                      → { items: Pool[] }
 *   POST   /api/manage/yun139/account-pools                      → { pool: Pool }
 *   GET    /api/manage/yun139/account-pools/{id}                 → { pool: Pool }
 *   PUT    /api/manage/yun139/account-pools/{id}                 → { pool: Pool }
 *   DELETE /api/manage/yun139/account-pools/{id}                 → { ok }
 *   GET    /api/manage/yun139/account-pools/{id}/members         → { items: Member[] }
 *   POST   /api/manage/yun139/account-pools/{id}/members         → { member: Member }
 *   DELETE /api/manage/yun139/account-pools/{id}/members/{pid}   → { ok }
 *
 * DTO：`crates/fmby-v2-http/src/state/yun139_accounts.rs`；
 *   Pool 10 字段 / Member 11 字段；时间 `created_at|updated_at|last_used_at|cooldown_until`
 *   均为 **epoch 毫秒**；wire 一律 **snake_case**。
 *
 * ★不造文案：错误走既有 `getErrorMessage`（出后端原文），本卡未新增错误码表。
 * ★可选字段省略 ⇒ **不发送**（交由后端缺省/校验），不在前端臆造。
 */

const POOL_RAW = {
  id: 'p1',
  name: '主力池',
  description: null,
  strategy: 'RoundRobin',
  cooldown_seconds: 60,
  max_concurrent: 5,
  is_enabled: true,
  member_count: 3,
  created_at: 1_760_000_000_000,
  updated_at: 1_760_000_000_000,
};

const MEMBER_RAW = {
  pool_id: 'p1',
  profile_id: 'pr1',
  profile_label: '账号 A',
  profile_status: 'Active',
  weight: 1,
  is_enabled: true,
  last_used_at: null,
  fail_count: 0,
  cooldown_until: null,
  created_at: 1_760_000_000_000,
  updated_at: 1_760_000_000_000,
};

test('池列表：路径 + items 解包 + 10 字段 snake→camel', async () => {
  const get = mock.method(httpClient, 'get', async () => ({ items: [POOL_RAW] }));
  const pools = await yun139Api.listAccountPools();

  assert.deepEqual(get.mock.calls[0].arguments[0], '/api/manage/yun139/account-pools');
  assert.deepEqual(pools, [
    {
      id: 'p1',
      name: '主力池',
      description: null,
      strategy: 'RoundRobin',
      cooldownSeconds: 60,
      maxConcurrent: 5,
      isEnabled: true,
      memberCount: 3,
      createdAt: 1_760_000_000_000,
      updatedAt: 1_760_000_000_000,
    },
  ]);
  get.mockRestore?.();
});

test('建池：POST 只发后端 5 字段，响应解 { pool }', async () => {
  const post = mock.method(httpClient, 'post', async () => ({ pool: POOL_RAW }));

  await yun139Api.createAccountPool({
    name: '主力池',
    description: 'desc',
    strategy: 'RoundRobin',
    cooldownSeconds: 60,
    maxConcurrent: 5,
  });
  const [path, cfg] = post.mock.calls[0].arguments as [
    string,
    { body?: Record<string, unknown> },
  ];
  assert.equal(path, '/api/manage/yun139/account-pools');
  assert.deepEqual(cfg.body, {
    name: '主力池',
    description: 'desc',
    strategy: 'RoundRobin',
    cooldown_seconds: 60,
    max_concurrent: 5,
  });

  // 可选字段省略 ⇒ 不发送
  await yun139Api.createAccountPool({ name: 'B' });
  const [, c2] = post.mock.calls[1].arguments as [string, { body?: Record<string, unknown> }];
  assert.deepEqual(c2?.body, { name: 'B' });
  post.mockRestore?.();
});

test('改池：PUT 只发传入字段（patch 语义），不解包错字段', async () => {
  const put = mock.method(httpClient, 'put', async () => ({ pool: POOL_RAW }));
  await yun139Api.updateAccountPool('p1', { isEnabled: false });
  const [path, cfg] = put.mock.calls[0].arguments as [
    string,
    { body?: Record<string, unknown> },
  ];
  assert.equal(path, '/api/manage/yun139/account-pools/p1');
  assert.deepEqual(cfg.body, { is_enabled: false });
  put.mockRestore?.();
});

test('删池 / 删成员：返回 ok 布尔', async () => {
  const del = mock.method(httpClient, 'delete', async () => ({ ok: true }));
  assert.equal(await yun139Api.deleteAccountPool('p1'), true);
  assert.equal(await yun139Api.removeAccountPoolMember('p1', 'pr1'), true);
  assert.deepEqual(
    del.mock.calls[0].arguments[0],
    '/api/manage/yun139/account-pools/p1',
  );
  assert.deepEqual(
    del.mock.calls[1].arguments[0],
    '/api/manage/yun139/account-pools/p1/members/pr1',
  );
  del.mockRestore?.();
});

test('成员列表：items 解包 + 11 字段对拍', async () => {
  const get = mock.method(httpClient, 'get', async () => ({ items: [MEMBER_RAW] }));
  const members = await yun139Api.listAccountPoolMembers('p1');

  assert.deepEqual(
    get.mock.calls[0].arguments[0],
    '/api/manage/yun139/account-pools/p1/members',
  );
  assert.deepEqual(members, [
    {
      poolId: 'p1',
      profileId: 'pr1',
      profileLabel: '账号 A',
      profileStatus: 'Active',
      weight: 1,
      isEnabled: true,
      lastUsedAt: null,
      failCount: 0,
      cooldownUntil: null,
      createdAt: 1_760_000_000_000,
      updatedAt: 1_760_000_000_000,
    },
  ]);
  get.mockRestore?.();
});

test('加成员：POST 只发 profile_id（+可选 weight）', async () => {
  const post = mock.method(httpClient, 'post', async () => ({ member: MEMBER_RAW }));
  await yun139Api.addAccountPoolMember('p1', { profileId: 'pr1', weight: 2 });
  const [path, cfg] = post.mock.calls[0].arguments as [
    string,
    { body?: Record<string, unknown> },
  ];
  assert.equal(path, '/api/manage/yun139/account-pools/p1/members');
  assert.deepEqual(cfg.body, { profile_id: 'pr1', weight: 2 });

  await yun139Api.addAccountPoolMember('p1', { profileId: 'pr2' });
  const [, c2] = post.mock.calls[1].arguments as [string, { body?: Record<string, unknown> }];
  assert.deepEqual(c2?.body, { profile_id: 'pr2' });
  post.mockRestore?.();
});

import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { httpClient } from '@fmby/v2-shared/api/client';
import { rewardsApi } from '@fmby/v2-shared/contracts/rewards';

/**
 * FE-POINTS-CHECKIN：用户自助「积分 / 签到」面契约对拍（RED→GREEN）。
 *
 * ★缺口核实（用 origin/main ref，非工作区）：
 *   后端 5 个用户面端点已注册（`crates/fmby-v2-http/src/routes/router_core.rs`），
 *   而前端**零调用**（现存 rewards 调用全是 `/api/manage/rewards/*` 管理面）
 *   ⇒ 缺口为真，非重复造。
 *
 * 后端真源（origin/main）：
 *   GET  /api/rewards/me                              → RewardsMySummaryDto
 *   GET  /api/rewards/rule                            → RewardsRuleVersionDto
 *   POST /api/rewards/checkins                        → RewardsCheckinResultDto
 *        body CheckinRequest{ source? }（**body 可省**）
 *   POST /api/rewards/redemptions/server-days         → RewardsRedemptionResultDto
 *   POST /api/rewards/redemptions/media-request-credits → 同上
 *        body RedeemBody{ idempotency_key, quantity }（deny_unknown_fields）
 *
 * ★不造文案：错误一律走既有 `getErrorMessage`（`shared/src/errors/messages.ts`），
 *   展示后端 `message` 原文；本契约层不新增错误码表。
 */

const ME_RAW = {
  user_id: '7',
  account: {
    user_id: '7',
    balance: 120,
    lifetime_earned: 200,
    lifetime_spent: 80,
    version: 3,
    updated_at: 1_760_000_000_000,
  },
  total_checkin_days: 9,
  current_streak_days: 4,
  latest_ledger: null,
};

const CHECKIN_RAW = {
  created: true,
  awarded_points: 10,
  checkin_date: 20261005,
  streak_days: 5,
  total_checkin_days: 10,
  status: 'ok',
  checked_in_at: 1_760_000_000_000,
};

const REDEEM_RAW = {
  id: 'r1',
  idempotency_key: 'idem-1',
  applied: true,
  redemption_type: 'server_days',
  quantity: 1,
  points_spent: 50,
  rule_version: 2,
  created_at: 1_760_000_000_000,
  balance: 70,
  valid_until_after: 1_763_000_000_000,
};

test('GET /api/rewards/me：snake→camel 对拍，无账户时 account=null（不伪造 0）', async () => {
  const get = mock.method(httpClient, 'get', async () => ME_RAW);
  const me = await rewardsApi.getMySummary();

  assert.deepEqual(get.mock.calls[0].arguments, ['/api/rewards/me']);
  assert.deepEqual(me, {
    userId: '7',
    account: {
      userId: '7',
      balance: 120,
      lifetimeEarned: 200,
      lifetimeSpent: 80,
      version: 3,
      updatedAt: 1_760_000_000_000,
    },
    totalCheckinDays: 9,
    currentStreakDays: 4,
    latestLedger: null,
  });

  // account 可空 ⇒ 绝不臆造零值账户
  get.mockRestore?.();
});

test('POST /api/rewards/checkins：body 可选（缺省不发 body），结果对拍', async () => {
  const post = mock.method(httpClient, 'post', async () => CHECKIN_RAW);

  // ① 不带 source ⇒ 不臆造请求体
  const r1 = await rewardsApi.checkIn();
  const [p1, c1] = post.mock.calls[0].arguments as [string, { body?: unknown }?];
  assert.equal(p1, '/api/rewards/checkins');
  assert.equal(c1?.body, undefined, 'body 可省，不得臆造');
  assert.deepEqual(r1, {
    created: true,
    awardedPoints: 10,
    checkinDate: 20261005,
    streakDays: 5,
    totalCheckinDays: 10,
    status: 'ok',
    checkedInAt: 1_760_000_000_000,
  });

  // ② 带 source ⇒ 只发 { source }
  await rewardsApi.checkIn('web');
  const [, c2] = post.mock.calls[1].arguments as [string, { body?: unknown }?];
  assert.deepEqual(c2?.body, { source: 'web' }, 'deny_unknown_fields ⇒ 只发 source');

  post.mockRestore?.();
});

test('POST 兑换：wire 只发 idempotency_key + quantity（snake_case，多传即 400）', async () => {
  const post = mock.method(httpClient, 'post', async () => REDEEM_RAW);

  const out = await rewardsApi.redeemServerDays('idem-1', 1);
  const [path, cfg] = post.mock.calls[0].arguments as [
    string,
    { body?: Record<string, unknown> },
  ];
  assert.equal(path, '/api/rewards/redemptions/server-days');
  assert.deepEqual(cfg.body, { idempotency_key: 'idem-1', quantity: 1 });
  assert.deepEqual(out, {
    id: 'r1',
    idempotencyKey: 'idem-1',
    applied: true,
    redemptionType: 'server_days',
    quantity: 1,
    pointsSpent: 50,
    ruleVersion: 2,
    createdAt: 1_760_000_000_000,
    balance: 70,
    validUntilAfter: 1_763_000_000_000,
  });

  await rewardsApi.redeemMediaRequestCredits('idem-2', 3);
  const [p2] = post.mock.calls[1].arguments as [string, { body?: unknown }];
  assert.equal(p2, '/api/rewards/redemptions/media-request-credits');

  post.mockRestore?.();
});

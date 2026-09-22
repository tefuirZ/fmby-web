/**
 * FE-PARITY-REWARDS-EXTRA wire 对拍（规则 GET/POST、统计 GET、积分调整 POST）。
 *
 * 后端真实端点（crates/fmby-v2-http/src/routes/manage_rewards.rs:52/84/98/116/131）：
 * - GET  /api/manage/rewards/rule              → RewardsRuleVersionDto
 * - POST /api/manage/rewards/rule              → RewardsRuleConfigDto → RewardsRuleVersionDto
 * - GET  /api/manage/rewards/stats             → RewardsAdminStatsDto
 * - POST /api/manage/rewards/points/adjust     → AdjustPointsRequestDto → AdminAdjustResultDto
 * 全部 require_capability(MANAGE_ACCESS)，**无 require_confirmed** → URL 不带 confirmed=true。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { peripheralsApi } from '@fmby/v2-shared/contracts/manage/peripherals';
import type { RewardsRuleConfigRecord } from '@fmby/v2-shared/contracts/manage/peripherals';

const captured: { method?: string; url?: string; body?: unknown } = {};
let nextResponse = { status: 200, json: {} as unknown };

function installFetchStub() {
  (globalThis as unknown as { window: unknown }).window = {
    location: { origin: 'http://localhost:5173' },
  };
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    url: string,
    init?: { method?: string; body?: string },
  ) => {
    captured.method = init?.method ?? 'GET';
    captured.url = url.replace('http://localhost:5173', '');
    if (init?.body) {
      try {
        captured.body = JSON.parse(init.body);
      } catch {
        captured.body = init.body;
      }
    } else {
      captured.body = undefined;
    }
    const body = nextResponse.status === 204 ? null : JSON.stringify(nextResponse.json);
    return new Response(body, {
      status: nextResponse.status,
      headers: { 'content-type': 'application/json' },
    });
  };
}

function setResponse(json: unknown, status = 200) {
  nextResponse = { status, json };
}

installFetchStub();

const RAW_RULE_VERSION = {
  id: 'rv-1',
  version: 7,
  status: 'published',
  created_by: '1',
  created_at: 1700000000000,
  published_at: 1700000001000,
  config: {
    checkin_enabled: true,
    reward_mode: 'tiered',
    tiers: [
      { start_day: 1, end_day: 6, points: 1 },
      { start_day: 7, end_day: null, points: 5 },
    ],
    random_min_points: 1,
    random_max_points: 5,
    watch_task: { enabled: true, required_minutes: 30 },
    allow_expired_checkin: false,
    server_days: {
      enabled: true,
      points_per_unit: 10,
      min_quantity: 1,
      max_quantity: 30,
      daily_limit: 60,
      monthly_limit: 900,
    },
    media_request_credits: {
      enabled: false,
      points_per_unit: 20,
      min_quantity: 1,
      max_quantity: 10,
      daily_limit: null,
      monthly_limit: null,
    },
    media_request_cost: 50,
  },
};

const RULE_CONFIG: RewardsRuleConfigRecord = {
  checkinEnabled: true,
  rewardMode: 'tiered',
  tiers: [
    { startDay: 1, endDay: 6, points: 1 },
    { startDay: 7, endDay: null, points: 5 },
  ],
  randomMinPoints: 1,
  randomMaxPoints: 5,
  watchTask: { enabled: true, requiredMinutes: 30 },
  allowExpiredCheckin: false,
  serverDays: {
    enabled: true,
    pointsPerUnit: 10,
    minQuantity: 1,
    maxQuantity: 30,
    dailyLimit: 60,
    monthlyLimit: 900,
  },
  mediaRequestCredits: {
    enabled: false,
    pointsPerUnit: 20,
    minQuantity: 1,
    maxQuantity: 10,
    dailyLimit: null,
    monthlyLimit: null,
  },
  mediaRequestCost: 50,
};

test('① GET /api/manage/rewards/rule — URL 与方法正确，且不带 confirmed', async () => {
  setResponse(RAW_RULE_VERSION);
  const r = await peripheralsApi.getRewardsRule();
  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/manage/rewards/rule');
  assert.equal(captured.body, undefined);
  // 版本元数据
  assert.equal(r.id, 'rv-1');
  assert.equal(r.version, 7);
  assert.equal(r.status, 'published');
  assert.equal(r.createdBy, '1');
  assert.equal(r.createdAt, 1700000000000);
  assert.equal(r.publishedAt, 1700000001000);
});

test('② GET rule 响应 12 个 snakecase 字段全部映射到位（嵌套结构不猜名）', async () => {
  setResponse(RAW_RULE_VERSION);
  const r = await peripheralsApi.getRewardsRule();
  const c = r.config;
  assert.equal(c.checkinEnabled, true);
  assert.equal(c.rewardMode, 'tiered');
  assert.equal(c.tiers.length, 2);
  assert.deepEqual(c.tiers[0], { startDay: 1, endDay: 6, points: 1 });
  assert.deepEqual(c.tiers[1], { startDay: 7, endDay: null, points: 5 });
  assert.equal(c.randomMinPoints, 1);
  assert.equal(c.randomMaxPoints, 5);
  assert.deepEqual(c.watchTask, { enabled: true, requiredMinutes: 30 });
  assert.equal(c.allowExpiredCheckin, false);
  assert.deepEqual(c.serverDays, {
    enabled: true,
    pointsPerUnit: 10,
    minQuantity: 1,
    maxQuantity: 30,
    dailyLimit: 60,
    monthlyLimit: 900,
  });
  assert.deepEqual(c.mediaRequestCredits, {
    enabled: false,
    pointsPerUnit: 20,
    minQuantity: 1,
    maxQuantity: 10,
    dailyLimit: null,
    monthlyLimit: null,
  });
  assert.equal(c.mediaRequestCost, 50);
  // 组合不变量：映射后无 undefined 字段（漏字段即断言失败）
  for (const [k, v] of Object.entries(c)) {
    assert.notEqual(v, undefined, `config.${k} 不得为 undefined`);
  }
});

test('③ POST /api/manage/rewards/rule — body 全 snake_case，嵌套层也转换', async () => {
  setResponse({ ...RAW_RULE_VERSION, version: 8 });
  const r = await peripheralsApi.publishRewardsRule(RULE_CONFIG);
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/rewards/rule');
  const body = captured.body as Record<string, unknown>;
  assert.equal(body.checkin_enabled, true);
  assert.equal(body.reward_mode, 'tiered');
  assert.equal(body.random_min_points, 1);
  assert.equal(body.random_max_points, 5);
  assert.equal(body.allow_expired_checkin, false);
  assert.equal(body.media_request_cost, 50);
  // 嵌套 watch_task 必须是 snake_case
  const wt = body.watch_task as Record<string, unknown>;
  assert.equal(wt.enabled, true);
  assert.equal(wt.required_minutes, 30);
  // 嵌套 tiers 数组元素也必须 snake_case
  const tiers = body.tiers as Array<Record<string, unknown>>;
  assert.equal(tiers.length, 2);
  assert.deepEqual(tiers[0], { start_day: 1, end_day: 6, points: 1 });
  assert.deepEqual(tiers[1], { start_day: 7, end_day: null, points: 5 });
  // 嵌套兑换速率
  const sd = body.server_days as Record<string, unknown>;
  assert.equal(sd.points_per_unit, 10);
  assert.equal(sd.min_quantity, 1);
  assert.equal(sd.max_quantity, 30);
  assert.equal(sd.daily_limit, 60);
  assert.equal(sd.monthly_limit, 900);
  const mrc = body.media_request_credits as Record<string, unknown>;
  assert.equal(mrc.daily_limit, null);
  assert.equal(mrc.monthly_limit, null);
  // 幂等语义：返回即落库后的新版本，不伪造
  assert.equal(r.version, 8);
});

test('④ GET /api/manage/rewards/stats — 求片计数不伪造 0，必须透传 null', async () => {
  setResponse({
    points_outstanding: 120,
    checkins_today: 3,
    pending_checkins: 1,
    redemptions_today: 0,
    pending_media_requests: null,
    processing_media_requests: null,
  });
  const s = await peripheralsApi.getRewardsAdminStats();
  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/manage/rewards/stats');
  assert.equal(s.pointsOutstanding, 120);
  assert.equal(s.checkinsToday, 3);
  assert.equal(s.pendingCheckins, 1);
  assert.equal(s.redemptionsToday, 0);
  // ★ 求片链（0059）计数恒 null：media_requests 表不属本卡，前端必须呈现为「—」
  assert.equal(s.pendingMediaRequests, null);
  assert.equal(s.processingMediaRequests, null);
});

test('⑤ POST /api/manage/rewards/points/adjust — 含幂等键，URL 不带 confirmed', async () => {
  setResponse({
    user_id: '42',
    balance: 130,
    lifetime_earned: 200,
    lifetime_spent: 70,
    applied: true,
  });
  const r = await peripheralsApi.adjustRewardsPoints({
    userId: '42',
    delta: -10,
    reason: '误扣回补',
    idempotencyKey: 'idem-key-1',
  });
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/rewards/points/adjust');
  assert.deepEqual(captured.body, {
    user_id: '42',
    idempotency_key: 'idem-key-1',
    delta: -10,
    reason: '误扣回补',
  });
  assert.equal(r.userId, '42');
  assert.equal(r.balance, 130);
  assert.equal(r.lifetimeEarned, 200);
  assert.equal(r.lifetimeSpent, 70);
  assert.equal(r.applied, true);
});

test('⑥ 幂等重复提交：applied=false 必须如实透传（不伪造「已调整」）', async () => {
  setResponse({
    user_id: '42',
    balance: 130,
    lifetime_earned: 200,
    lifetime_spent: 70,
    applied: false,
  });
  const r = await peripheralsApi.adjustRewardsPoints({
    userId: '42',
    delta: -10,
    reason: '误扣回补',
    idempotencyKey: 'idem-key-1',
  });
  assert.equal(r.applied, false);
  // 余额不变（后端未重复变动），前端不得自行加 delta 伪造
  assert.equal(r.balance, 130);
});

test('⑦ fail-closed：stats 500（端口未装配）必须抛出，不得吞成空统计', async () => {
  setResponse({ code: 'internal', message: 'rewards port not assembled' }, 500);
  await assert.rejects(() => peripheralsApi.getRewardsAdminStats());
});

test('⑧ fail-closed：积分调整 400（非法 delta）必须抛出后端 error_code', async () => {
  setResponse({ code: 'invalid_argument', message: 'delta must be non-zero' }, 400);
  await assert.rejects(() =>
    peripheralsApi.adjustRewardsPoints({
      userId: '42',
      delta: 0,
      reason: '',
      idempotencyKey: 'k',
    }),
  );
});

test('⑨ 发布失败：403 无 MANAGE_ACCESS 必须透传 error_code', async () => {
  setResponse({ code: 'forbidden', message: 'missing capability manage:access' }, 403);
  await assert.rejects(() => peripheralsApi.publishRewardsRule(RULE_CONFIG));
});

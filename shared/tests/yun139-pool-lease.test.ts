import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { httpClient } from '@fmby/v2-shared/api/client';
import { yun139Api } from '@fmby/v2-shared/contracts/manage/yun139';

/**
 * FE-YUN139-ACCOUNT-POOLS（挑内聚的**段 B 调度运维** 2 端点）：
 * 租借（lease）与结果回写（report）。
 *
 * ★缺口核实（用 origin/main ref，不查工作区）：
 *   后端 9 个 account-pools 端点已注册（`crates/fmby-v2-http/src/routes/yun139_accounts.rs`）；
 *   前端 `/api/.../account-pool*` 路径调用 **0 处**，唯一 `AccountPool` 命中是
 *   `license/types.ts` 的 `microsoftAccountPool: boolean`（**授权权益开关**，与账号池无关）
 *   ⇒ 缺口为真，非重复造。
 *   段 A（池 CRUD 8 条）本次**不做**（见 handoff「挑内聚 1-2 个」），留后续卡。
 *
 * 后端真源（origin/main）：
 *   POST /api/manage/yun139/account-pools/{pool_id}/lease
 *     body Yun139LeaseRequest{ sticky_key? } → Yun139LeaseResponse
 *   POST /api/manage/yun139/account-pools/{pool_id}/report
 *     body Yun139ReportRequest{ profile_id, lease_id?, success, cooldown_seconds? }
 *     → OkResponse{ ok }
 *   DTO：`crates/fmby-v2-http/src/state/yun139_accounts.rs`
 *   能力门：`MANAGE_MOUNT`。`expires_at` 是 **epoch 毫秒**（租借 TTL）。
 *
 * ★不造文案：错误走既有 `getErrorMessage`（出后端原文），本卡未新增错误码表。
 */

const LEASE_RAW = {
  pool_id: 'p1',
  lease_id: 'l1',
  profile_id: 'pr1',
  display_name: '账号 A',
  expires_at: 1_760_000_000_000,
};

test('lease：路径 + wire body（snake_case）+ 响应对拍（expires_at 为毫秒，原样透传）', async () => {
  const post = mock.method(httpClient, 'post', async () => LEASE_RAW);

  const out = await yun139Api.leaseFromPool('p1', { stickyKey: 'share-9' });
  const [path, cfg] = post.mock.calls[0].arguments as [
    string,
    { body?: Record<string, unknown> },
  ];
  assert.equal(path, '/api/manage/yun139/account-pools/p1/lease');
  assert.deepEqual(cfg.body, { sticky_key: 'share-9' });

  assert.deepEqual(out, {
    poolId: 'p1',
    leaseId: 'l1',
    profileId: 'pr1',
    displayName: '账号 A',
    expiresAt: 1_760_000_000_000,
  });

  // sticky_key 可省 ⇒ 不臆造字段
  await yun139Api.leaseFromPool('p1');
  const [, c2] = post.mock.calls[1].arguments as [string, { body?: Record<string, unknown> }];
  assert.deepEqual(c2?.body, {}, 'sticky_key 可省，不得臆造');

  post.mockRestore?.();
});

test('report：wire body 只发后端 4 字段（可选者省略），返回 ok', async () => {
  const post = mock.method(httpClient, 'post', async () => ({ ok: true }));

  const ok = await yun139Api.reportLease('p1', {
    profileId: 'pr1',
    leaseId: 'l1',
    success: false,
    cooldownSeconds: 60,
  });
  const [path, cfg] = post.mock.calls[0].arguments as [
    string,
    { body?: Record<string, unknown> },
  ];
  assert.equal(path, '/api/manage/yun139/account-pools/p1/report');
  assert.deepEqual(cfg.body, {
    profile_id: 'pr1',
    lease_id: 'l1',
    success: false,
    cooldown_seconds: 60,
  });
  assert.equal(ok, true);

  // 可选字段省略 ⇒ 不发送
  await yun139Api.reportLease('p1', { profileId: 'pr1', success: true });
  const [, c2] = post.mock.calls[1].arguments as [string, { body?: Record<string, unknown> }];
  assert.deepEqual(c2?.body, { profile_id: 'pr1', success: true });

  post.mockRestore?.();
});

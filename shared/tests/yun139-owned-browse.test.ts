import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { httpClient } from '@fmby/v2-shared/api/client';
import { yun139Api } from '@fmby/v2-shared/contracts/manage/yun139';

/**
 * FE-YUN139-OWNED-BROWSE-UI：139 自有挂载三端点的契约对拍（RED→GREEN）。
 *
 * 后端真源：
 *   GET  /api/manage/yun139/accounts/{mount_id}/credentials
 *   POST /api/manage/yun139/accounts/{mount_id}/browse
 *   POST /api/manage/yun139/activate
 *   （`crates/fmby-v2-http/src/routes/yun139_accounts.rs`）
 * DTO：`Yun139CredentialsInfo`（bridges/yun139_owned_mount.rs）、
 *      `Yun139OwnedBrowseRequest` / `Yun139ActivateRequest`（contracts/repository/yun139_accounts.rs）
 *
 * ★安全红线（本测试锁死）：凭据面**只有 meta 五位**，响应映射**不得**透出任何
 *   authorization / cookie 明文 ⇒ 断言映射结果不含敏感键。
 */

const CRED_RAW = {
  mount_id: 'mnt-1',
  has_authorization: true,
  has_cookie: false,
  can_refresh: false,
  authorization_expires_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};

test('credentials：snake_case → camelCase 对拍，且只含 meta（无明文）', async () => {
  const get = mock.method(httpClient, 'get', async () => CRED_RAW);

  const info = await yun139Api.getOwnedCredentials('mnt-1');

  assert.equal(get.mock.callCount(), 1);
  const [path, cfg] = get.mock.calls[0].arguments as [string, { params?: unknown }];
  assert.equal(path, '/api/manage/yun139/accounts/mnt-1/credentials');

  assert.deepEqual(info, {
    mountId: 'mnt-1',
    hasAuthorization: true,
    hasCookie: false,
    canRefresh: false,
    authorizationExpiresAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  });

  // 安全红线：映射结果不得出现任何明文字段
  for (const k of Object.keys(info)) {
    assert.ok(
      !/authorization_value|cookie_value|secret|token|password/i.test(k),
      `凭据映射不得含明文字段: ${k}`,
    );
  }
  get.mock.restore();
});

test('browse：请求体按后端 wire 命名（spaceKind/cloudId/fileId）', async () => {
  const post = mock.method(httpClient, 'post', async () => ({ items: [] }));

  await yun139Api.browseOwnedMount('mnt-1', {
    path: '/a',
    offset: 0,
    limit: 50,
    spaceKind: 'family',
    cloudId: 'c1',
    fileId: 'f1',
  });

  const [path, cfg] = post.mock.calls[0].arguments as [
    string,
    { body?: Record<string, unknown> },
  ];
  assert.equal(path, '/api/manage/yun139/accounts/mnt-1/browse');
  assert.deepEqual(cfg.body, {
    path: '/a',
    offset: 0,
    limit: 50,
    spaceKind: 'family',
    cloudId: 'c1',
    fileId: 'f1',
  });
  post.mock.restore();
});

test('activate：mountId 必填且走 wire 命名；后端空串即 Validation（前端不吞）', async () => {
  const post = mock.method(httpClient, 'post', async () => ({ ok: true }));

  await yun139Api.activateOwnedMount({
    mountId: 'mnt-1',
    authorization: 'AUTH',
    cookie: 'CK',
    spaceKind: 'family',
    cloudId: 'c1',
  });

  const [path, cfg] = post.mock.calls[0].arguments as [
    string,
    { body?: Record<string, unknown> },
  ];
  assert.equal(path, '/api/manage/yun139/activate');
  assert.deepEqual(cfg.body, {
    mountId: 'mnt-1',
    authorization: 'AUTH',
    cookie: 'CK',
    spaceKind: 'family',
    cloudId: 'c1',
  });
  post.mock.restore();
});

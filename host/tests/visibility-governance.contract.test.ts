/**
 * FE-VISIBILITY-GOVERNANCE wire 对拍（TDD：先 RED 后 GREEN）。
 *
 * 后端真源（V2，4 条路由；router_manage.rs:356-371）：
 * - GET    /api/manage/operations/media-visibility-governance                    → GovernanceTaskDto[]
 * - POST   /api/manage/operations/media-visibility-governance?confirmed=true    → GovernanceTaskDto
 * - GET    /api/manage/operations/media-visibility-governance/{taskId}          → GovernanceTaskDto
 * - POST   /api/manage/operations/media-visibility-governance/{taskId}/cancel   → { cancelled }
 *
 * 能力门：MANAGE_LIBRARY（create 另需 DANGEROUS_ACTION + ?confirmed=true）。
 * DTO 真源：crates/fmby-v2-http/src/dto/media_visibility_governance.rs（snake_case wire）。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { visibilityGovernanceApi } from '@fmby/v2-shared/contracts/manage/visibilityGovernance';
import type { GovernanceTaskRaw } from '@fmby/v2-shared/contracts/manage/visibilityGovernance/types';

const taskRaw: GovernanceTaskRaw = {
  id: 't-1',
  mode: 'hide',
  status: 'queued',
  restore_from_task_id: null,
  cursor_media_item_id: null,
  batch_size: 25,
  policy_version: 'v1',
  stats: {
    scanned_roots: 0,
    candidate_hits: 0,
    protected_skipped: 0,
    would_hide: 0,
    hidden_applied: 0,
    would_restore: 0,
    restored: 0,
    already_hidden: 0,
    errors: 0,
  },
  requested_by_user_id: null,
  lease_owner: null,
  lease_token: null,
  lease_expires_at: null,
  last_error_code: null,
  last_error_message: null,
  created_at: '2026-01-01T00:00:00Z',
  started_at: null,
  finished_at: null,
  updated_at: '2026-01-01T00:00:00Z',
};

const captured: { method?: string; url?: string; body?: unknown } = {};
let nextResponse = { status: 200, json: {} as unknown };

(globalThis as unknown as { window: unknown }).window = {
  location: { origin: 'http://localhost:5173' },
};
(globalThis as unknown as { fetch: unknown }).fetch = async (
  url: string,
  init?: { method?: string; body?: string },
) => {
  captured.method = init?.method ?? 'GET';
  captured.url = String(url).replace('http://localhost:5173', '');
  captured.body = init?.body ? JSON.parse(init.body) : undefined;
  const body = nextResponse.status === 204 ? null : JSON.stringify(nextResponse.json);
  return new Response(body, {
    status: nextResponse.status,
    headers: { 'content-type': 'application/json' },
  });
};

function setResponse(json: unknown, status = 200) {
  nextResponse = { status, json };
}

test('list 拉取治理任务数组并 camelCase 化', async () => {
  setResponse([taskRaw]);
  const tasks = await visibilityGovernanceApi.list();
  assert.strictEqual(captured.method, 'GET');
  assert.strictEqual(captured.url, '/api/manage/operations/media-visibility-governance');
  assert.strictEqual(tasks.length, 1);
  assert.strictEqual(tasks[0].id, 't-1');
  assert.strictEqual(tasks[0].policyVersion, 'v1');
  assert.strictEqual(tasks[0].batchSize, 25);
  assert.strictEqual(tasks[0].stats.scannedRoots, 0);
});

test('create 携带 ?confirmed=true 与 body，返回任务', async () => {
  setResponse(taskRaw);
  const task = await visibilityGovernanceApi.create({ mode: 'hide', batchSize: 30 });
  assert.strictEqual(captured.method, 'POST');
  assert.ok(captured.url?.includes('confirmed=true'), '必须带 confirmed=true');
  assert.deepStrictEqual(captured.body, { mode: 'hide', batch_size: 30 });
  assert.strictEqual(task.id, 't-1');
});

test('get 按 taskId 拉取', async () => {
  setResponse(taskRaw);
  const task = await visibilityGovernanceApi.get('t-1');
  assert.strictEqual(captured.url, '/api/manage/operations/media-visibility-governance/t-1');
  assert.strictEqual(task.status, 'queued');
});

test('cancel POST …/cancel 返回 { cancelled }', async () => {
  setResponse({ cancelled: true });
  const res = await visibilityGovernanceApi.cancel('t-1');
  assert.strictEqual(captured.method, 'POST');
  assert.strictEqual(captured.url, '/api/manage/operations/media-visibility-governance/t-1/cancel');
  assert.strictEqual(res.cancelled, true);
});

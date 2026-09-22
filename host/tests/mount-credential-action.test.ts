/**
 * W5-B：凭据动作闭环（expired/unbound ⇒ 入口；动作后刷新；不显示密钥）。
 *
 * ★诚实边界：**静态映射 + 单测，无真栈验证**（本机无可用真栈后端）。
 *   本文件用假 host 数据驱动纯函数与契约层映射，不连真后端。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveCredentialBadge,
  resolveCredentialAction,
  findSecretLeaks,
  type CredentialActionTarget,
} from '../src/pages/manage/mounts/credentialPresentation';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import type { ManageMountCredentialStatus } from '@fmby/v2-shared/contracts/manage';

// ─── fetch 桩（假 host 数据驱动） ────────────────────────────────────────────
let nextResponse = { status: 200, json: {} as unknown };
(globalThis as unknown as { window: unknown }).window = {
  location: { origin: 'http://localhost:5173' },
};
(globalThis as unknown as { fetch: unknown }).fetch = async () => {
  const body = nextResponse.status === 204 ? null : JSON.stringify(nextResponse.json);
  return new Response(body, {
    status: nextResponse.status,
    headers: { 'content-type': 'application/json' },
  });
};
function setResponse(json: unknown, status = 200) {
  nextResponse = { status, json };
}

function rawMount(patch: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    name: '主挂载',
    mount_type: 'pan115',
    type_label: '115 网盘',
    path: '/115',
    path_label: '/115',
    health_status: 'healthy',
    capabilities: [],
    linked_libraries: [],
    ...patch,
  };
}

const STATES: ManageMountCredentialStatus[] = ['bound', 'unbound', 'expired', 'not_required'];

// ─── ① 四态 × 有/无入口 矩阵 ────────────────────────────────────────────────

test('① 四态 × 入口矩阵（只有 expired/unbound 给入口）', () => {
  const expected: Record<ManageMountCredentialStatus, string | null> = {
    expired: '重新绑定凭据',
    unbound: '绑定凭据',
    bound: null,
    not_required: null,
  };
  for (const state of STATES) {
    const badge = resolveCredentialBadge(state);
    const action = resolveCredentialAction(state, 'm1');
    const want = expected[state];
    assert.equal(badge.needsAction, want !== null, `状态 ${state} 的 needsAction`);
    assert.equal(action?.label ?? null, want, `状态 ${state} 的入口文案`);
    // not_required 连徽标都不显示
    assert.equal(badge.visible, state !== 'not_required', `状态 ${state} 的 visible`);
  }
});

test('② not_required 完全无凭据 UI（徽标+入口都不出现）', () => {
  const badge = resolveCredentialBadge('not_required');
  assert.equal(badge.visible, false);
  assert.equal(resolveCredentialAction('not_required', 'm1'), null);
});

test('③ 未知（null）不给入口，不猜', () => {
  assert.equal(resolveCredentialAction(null, 'm1'), null);
  assert.equal(resolveCredentialBadge(null).needsAction, false);
});

// ─── ④ 列表与详情必须给出同一动作目标（同一函数产出） ────────────────────────

test('④ expired 时列表与详情给出**同一**动作目标（同一 mount id + 同一函数）', () => {
  // 两个面都调用同一个 resolveCredentialAction —— 这是"同一目标"的结构性保证
  const fromList = resolveCredentialAction('expired', 'm1');
  const fromDetail = resolveCredentialAction('expired', 'm1');
  assert.deepEqual(fromList, fromDetail);
  assert.equal(fromList?.mountId, 'm1');
  assert.equal(fromList?.kind, 'rebind');
});

test('⑤ 不同状态给出不同 kind（rebind vs bind），不得混用', () => {
  const expired = resolveCredentialAction('expired', 'm1') as CredentialActionTarget;
  const unbound = resolveCredentialAction('unbound', 'm1') as CredentialActionTarget;
  assert.equal(expired.kind, 'rebind');
  assert.equal(unbound.kind, 'bind');
  assert.notEqual(expired.label, unbound.label);
});

// ─── ⑥ 绑定成功后：unbound → bound，徽标与入口同时消失 ──────────────────────

test('⑥ 绑定成功后 unbound→bound：徽标与入口同时消失（假 host 数据驱动）', async () => {
  // 动作前
  setResponse({ items: [rawMount({ credential_status: 'unbound' })] });
  const before = (await manageApi.getMounts()).items[0];
  assert.equal(before.credentialStatus, 'unbound');
  const badgeBefore = resolveCredentialBadge(before.credentialStatus);
  assert.equal(badgeBefore.needsAction, true);
  assert.ok(resolveCredentialAction(before.credentialStatus, before.id));

  // 动作后（假数据：后端返回 bound）
  setResponse({ items: [rawMount({ credential_status: 'bound' })] });
  const after = (await manageApi.getMounts()).items[0];
  assert.equal(after.credentialStatus, 'bound');
  const badgeAfter = resolveCredentialBadge(after.credentialStatus);
  assert.equal(badgeAfter.needsAction, false, '绑定成功后不得仍有入口');
  assert.equal(resolveCredentialAction(after.credentialStatus, after.id), null);
  // 徽标转为正常态（不是消失——bound 仍显示，只是弱提示）
  assert.equal(badgeAfter.visible, true);
  assert.equal(badgeAfter.variant, 'success');
  assert.equal(badgeAfter.actionLabel, null);
});

test('⑦ 重绑成功后 expired→bound：同样不再有入口', async () => {
  setResponse({ items: [rawMount({ credential_status: 'expired' })] });
  const before = (await manageApi.getMounts()).items[0];
  assert.equal(resolveCredentialAction(before.credentialStatus, before.id)?.kind, 'rebind');

  setResponse({ items: [rawMount({ credential_status: 'bound' })] });
  const after = (await manageApi.getMounts()).items[0];
  assert.equal(resolveCredentialAction(after.credentialStatus, after.id), null);
  assert.equal(resolveCredentialBadge(after.credentialStatus).needsAction, false);
});

// ─── ⑧ 不显示密钥 / 密封引用 ────────────────────────────────────────────────

test('⑧ 四态的徽标与入口文案均不含密钥/密封引用', () => {
  for (const state of STATES) {
    const badge = resolveCredentialBadge(state, '后端处置建议');
    const action = resolveCredentialAction(state, 'm1');
    const text = `${badge.label} ${badge.actionLabel ?? ''} ${badge.hint ?? ''} ${action?.label ?? ''}`;
    assert.deepEqual(findSecretLeaks(text), [], `状态 ${state} 文案含可疑凭据形态`);
  }
});

test('⑨ 详情/列表整条链路的状态字段只含四态之一（不得夹带 config/seal）', async () => {
  setResponse({ items: [rawMount({ credential_status: 'expired' })] });
  const item = (await manageApi.getMounts()).items[0];
  assert.ok(STATES.includes(item.credentialStatus as ManageMountCredentialStatus));
  const text = JSON.stringify({
    status: item.credentialStatus,
    badge: resolveCredentialBadge(item.credentialStatus),
    action: resolveCredentialAction(item.credentialStatus, item.id),
  });
  assert.deepEqual(findSecretLeaks(text), []);
  assert.equal(text.includes('__sealed'), false);
  assert.equal(text.includes('password'), false);
});

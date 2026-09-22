/**
 * W5-A：credential_status 前端消费（CRED-EXPIRY-WIRE）。
 *
 * 后端事实：
 * - `credential_status` 由 `derive_credential_status`
 *   （`crates/fmby-v2-server/src/bridges/manage/helpers.rs:47`）派生四态：
 *   Local → not_required；无凭据 → unbound；有凭据且 expires_at<=now → expired；
 *   有凭据未过期/无过期概念 → bound。
 * - 列表（`dto/manage/mount.rs:180`）与详情（`:205`）**同值同源**
 *   （`read_health.rs:85`：`credential_status: summary.credential_status.clone()`）。
 * - 观察面 `last_fault_kind` 来自扫描观测（`provider_health.rs:172`），是**另一条
 *   证据链**且可能为 null。
 *
 * ★诚实边界：**静态映射 + 单测，无真栈验证**（本机无可用真栈后端）。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveCredentialBadge,
  shouldShowFaultSupplement,
  findSecretLeaks,
  MOUNT_FAULT_CREDENTIAL_EXPIRED,
} from '../src/pages/manage/mounts/credentialPresentation';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import type { ManageMountRecord } from '@fmby/v2-shared/contracts/manage';

// ─── 真形状（照后端字段构造） ─────────────────────────────────────────────────
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

// ─── 四态渲染分支 ────────────────────────────────────────────────────────────

test('① expired → 醒目标注 + 重绑入口', () => {
  const badge = resolveCredentialBadge('expired');
  assert.equal(badge.visible, true);
  assert.equal(badge.label, '凭据已过期');
  assert.equal(badge.variant, 'danger');
  assert.equal(badge.needsAction, true);
  assert.equal(badge.actionLabel, '重新绑定凭据');
});

test('② unbound → 未绑定 + 绑定入口', () => {
  const badge = resolveCredentialBadge('unbound');
  assert.equal(badge.visible, true);
  assert.equal(badge.label, '未绑定凭据');
  assert.equal(badge.variant, 'warning');
  assert.equal(badge.needsAction, true);
  assert.equal(badge.actionLabel, '绑定凭据');
});

test('③ bound → 正常态，无行动入口', () => {
  const badge = resolveCredentialBadge('bound');
  assert.equal(badge.visible, true);
  assert.equal(badge.label, '凭据正常');
  assert.equal(badge.variant, 'success');
  assert.equal(badge.needsAction, false);
  assert.equal(badge.actionLabel, null);
});

test('④ not_required → 完全不显示凭据 UI', () => {
  const badge = resolveCredentialBadge('not_required');
  assert.equal(badge.visible, false);
  assert.equal(badge.needsAction, false);
  assert.equal(badge.actionLabel, null);
});

test('⑤ null / 未知 → 不显示、不猜（归未知）', () => {
  for (const v of [null, undefined, 'whatever'] as const) {
    const badge = resolveCredentialBadge(v as never);
    assert.equal(badge.visible, false, `输入 ${String(v)} 不得显示凭据 UI`);
    assert.equal(badge.needsAction, false);
  }
});

// ─── 与 last_fault_kind 的合并判据（去重） ───────────────────────────────────

test('⑥ expired 时不得再弹观察面告警（同一事实一个入口）', () => {
  assert.equal(shouldShowFaultSupplement('expired', MOUNT_FAULT_CREDENTIAL_EXPIRED), false);
});

test('⑦ bound 但观察面仍报过期 → 只作补充，不重复告警', () => {
  assert.equal(shouldShowFaultSupplement('bound', MOUNT_FAULT_CREDENTIAL_EXPIRED), true);
  const badge = resolveCredentialBadge('bound', '请重新绑定');
  // 仍是正常态（权威状态为准），仅在 hint 里补一句观察面文案
  assert.equal(badge.variant, 'success');
  assert.equal(badge.needsAction, false);
  assert.match(badge.hint ?? '', /观察面仍记录/);
});

test('⑧ 观察面无观测（null）→ 不显示任何故障补充', () => {
  assert.equal(shouldShowFaultSupplement('bound', null), false);
  const badge = resolveCredentialBadge('bound', null);
  assert.equal(badge.hint, null);
});

test('⑨ 非凭据类故障（rate_limited）不触发凭据补充', () => {
  assert.equal(shouldShowFaultSupplement('bound', 'rate_limited'), false);
});

// ─── 不显示密钥 / 密封引用 ───────────────────────────────────────────────────

test('⑩ 四态呈现均不含密钥或密封引用', () => {
  for (const status of ['bound', 'unbound', 'expired', 'not_required'] as const) {
    const badge = resolveCredentialBadge(status, '后端处置建议');
    const text = `${badge.label} ${badge.actionLabel ?? ''} ${badge.hint ?? ''}`;
    assert.deepEqual(findSecretLeaks(text), [], `状态 ${status} 文案含可疑凭据形态`);
  }
});

test('⑪ findSecretLeaks 能抓到密封引用与 key=value 形态（自检）', () => {
  assert.ok(findSecretLeaks('config: __sealed:k1').length > 0);
  assert.ok(findSecretLeaks('password: hunter2').length > 0);
  assert.deepEqual(findSecretLeaks('凭据已过期，请重新绑定'), []);
});

// ─── 列表/详情同值（经公开 API 验证映射一致性） ───────────────────────────────

const captured: { method?: string; url?: string } = {};
let nextResponse = { status: 200, json: {} as unknown };

(globalThis as unknown as { window: unknown }).window = {
  location: { origin: 'http://localhost:5173' },
};
(globalThis as unknown as { fetch: unknown }).fetch = async (
  url: string,
  init?: { method?: string },
) => {
  captured.method = init?.method ?? 'GET';
  captured.url = url.replace('http://localhost:5173', '');
  const body = nextResponse.status === 204 ? null : JSON.stringify(nextResponse.json);
  return new Response(body, {
    status: nextResponse.status,
    headers: { 'content-type': 'application/json' },
  });
};

function setResponse(json: unknown, status = 200) {
  nextResponse = { status, json };
}

function detailRaw(status: string | null, mountStatus?: string | null) {
  return {
    mount: rawMount(
      mountStatus === undefined ? { credential_status: status } : { credential_status: mountStatus },
    ),
    provider_type: 'pan115',
    root_path: '/115',
    capability_state: {
      can_list: true,
      can_random_read: true,
      can_read_sidecar: false,
      can_generate_play_target: true,
      can_refresh_credentials: true,
    },
    credential_status: status,
  };
}

test('⑫ 列表与详情 credentialStatus 必须同值（后端同源派生）', async () => {
  for (const status of ['bound', 'unbound', 'expired', 'not_required'] as const) {
    // 列表
    setResponse({ items: [rawMount({ credential_status: status })] });
    const list = await manageApi.getMounts();
    assert.equal(list.items[0].credentialStatus, status, `列表 ${status}`);

    // 详情
    setResponse(detailRaw(status));
    const detail = await manageApi.getMountDetail('m1');
    assert.equal(detail.credentialStatus, status, `详情 ${status}`);
    assert.equal(
      detail.credentialStatus,
      detail.mount.credentialStatus,
      `详情顶层与 mount 内层必须同值（${status}）`,
    );
  }
});

test('⑬ 详情缺顶层字段时回落到 mount 内层（不丢状态）', async () => {
  setResponse(detailRaw(null, 'expired'));
  const detail = await manageApi.getMountDetail('m1');
  assert.equal(detail.credentialStatus, 'expired');
  assert.equal(resolveCredentialBadge(detail.credentialStatus).visible, true);
});

test('⑭ 后端完全不返回该字段 → null（未知），不得伪造 bound', async () => {
  setResponse({ items: [rawMount()] });
  const list = await manageApi.getMounts();
  assert.equal(list.items[0].credentialStatus, null);
  assert.equal(resolveCredentialBadge(list.items[0].credentialStatus).visible, false);
});

test('⑮ 呈现层不得把密钥/密封引用带进 UI（整条链路文本自检）', async () => {
  setResponse({ items: [rawMount({ credential_status: 'expired' })] });
  const list = await manageApi.getMounts();
  const badge = resolveCredentialBadge(list.items[0].credentialStatus, '请重新绑定');
  const text = JSON.stringify({ status: list.items[0].credentialStatus, badge });
  // 状态字段只应是四态之一，不得携带 config/seal 细节
  assert.deepEqual(findSecretLeaks(text), []);
  assert.ok(['bound', 'unbound', 'expired', 'not_required'].includes(
    list.items[0].credentialStatus as string,
  ));
});

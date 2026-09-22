/**
 * DATASOURCE-CRUD-BACKFILL-UI wire/纯函数对拍。
 *
 * 后端真源：
 * - `crates/fmby-v2-http/src/dto/manage/mount.rs`：ManagedMountSummaryDto/DetailDto
 *   （note / rate_config / visibility_rule / sidecar_* 已在返回；**无**凭据状态字段）
 * - `crates/fmby-v2-http/src/dto/manage.rs` MountHealthDto：last_fault_kind
 *   = "credential_expired"（唯一有后端依据的过期信号）
 * - `crates/fmby-v2-http/src/routes/manage/mounts.rs:196`：`GET /api/manage/mounts/health`
 *
 * 覆盖用户四条交付自检：① payload 不含 name ② 四项旧值回填 ③ 过期两态渲染
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMountFormState,
  buildUpdateMountPayload,
  resolveCredentialGuidance,
  describeSecretValue,
  createEmptyMountForm,
} from '../src/pages/manage/mounts/formUtils';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import type {
  ManageMountDetailRecord,
  ManageMountHealthRecord,
} from '@fmby/v2-shared/contracts/manage';

// ─── fetch 桩：捕获真实发出的 {method,url,body} ──────────────────────────────
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
  captured.url = url.replace('http://localhost:5173', '');
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

// ─── 真 DTO 形状（照后端字段构造，不臆造） ───────────────────────────────────
function makeDetail(): ManageMountDetailRecord {
  return {
    mount: {
      id: 'm1',
      name: '我的 115 网盘',
      mountType: 'pan115',
      typeLabel: '115 网盘',
      path: '/115',
      pathLabel: '/115',
      healthStatus: 'critical',
      description: 'd',
      capabilities: [],
      linkedLibraries: [],
      referenceCounts: {
        linkedLibraryCount: 0,
        librarySourceCount: 0,
        mediaSourceCount: 0,
        sidecarAssetCount: 0,
      },
      unavailableBindingCount: 0,
      note: '主账号',
      rateConfig: '{"qps":2}',
      visibilityRule: '{"exclude":["vip"]}',
      sidecarNfo: true,
      sidecarSubtitle: false,
      sidecarPoster: true,
    },
    providerType: 'pan115',
    rootPath: '/115',
    configJson: { password: '__sealed:k1', username: 'u' },
    capabilityState: {
      canList: true,
      canRandomRead: true,
      canReadSidecar: false,
      canGeneratePlayTarget: true,
      canRefreshCredentials: true,
    },
    pathPolicies: [],
    linkedSources: [],
    recentScanTasks: [],
  } as ManageMountDetailRecord;
}

function makeHealth(
  patch: Partial<ManageMountHealthRecord>,
): ManageMountHealthRecord {
  return {
    mountId: 'm1',
    name: '我的 115 网盘',
    providerType: 'pan115',
    status: 'active',
    healthStatus: 'critical',
    statusMessage: null,
    unavailableBindingCount: null,
    attentionBindingCount: null,
    lastCheckedAt: null,
    lastFaultKind: null,
    lastFaultTitle: null,
    lastFaultAction: null,
    lastFaultAt: null,
    ...patch,
  };
}

// ─── ① payload 不得含 name ───────────────────────────────────────────────────

test('① PATCH 挂载 body 不得含 name（用户口径：名字没法变，前端不得静默提交新名）', () => {
  const form = { ...createEmptyMountForm(), ...buildMountFormState(makeDetail()) };
  const payload = buildUpdateMountPayload(form) as Record<string, unknown>;
  assert.equal('name' in payload, false, 'payload 里不得出现 name 键');
  // 且不能通过其它键间接改名
  assert.equal(Object.keys(payload).some((k) => k.toLowerCase() === 'name'), false);
});

test('①b 即使 formState.name 被改成别的，payload 也不得上抛（防后人加回）', () => {
  const form = { ...buildMountFormState(makeDetail()), name: '被误改的新名字' };
  const payload = buildUpdateMountPayload(form) as Record<string, unknown>;
  assert.equal('name' in payload, false);
  assert.equal(JSON.stringify(payload).includes('被误改的新名字'), false);
});

// ─── ② 四项旧值回填 ──────────────────────────────────────────────────────────

test('②a note 旧值回填', () => {
  assert.equal(buildMountFormState(makeDetail()).note, '主账号');
});

test('②b rateConfig 旧值回填（未配置 → 空串，不伪造 {}）', () => {
  assert.equal(buildMountFormState(makeDetail()).rateConfigText, '{"qps":2}');
  const noRate = makeDetail();
  (noRate.mount as unknown as Record<string, unknown>).rateConfig = null;
  assert.equal(buildMountFormState(noRate).rateConfigText, '');
});

test('②c visibilityRule 旧值回填', () => {
  assert.equal(buildMountFormState(makeDetail()).visibilityRuleText, '{"exclude":["vip"]}');
});

test('②d sidecar* 三项旧值回填（true/false 不互相污染）', () => {
  const f = buildMountFormState(makeDetail());
  assert.equal(f.sidecarNfo, true);
  assert.equal(f.sidecarSubtitle, false);
  assert.equal(f.sidecarPoster, true);
});

test('②e 回填项随 PATCH 一起提交（否则回填了也存不回去）', () => {
  const form = buildMountFormState(makeDetail());
  const payload = buildUpdateMountPayload(form) as Record<string, unknown>;
  assert.equal(payload.note, '主账号');
  assert.deepEqual(payload.rateConfig, { qps: 2 });
  assert.deepEqual(payload.visibilityRule, { exclude: ['vip'] });
  assert.equal(payload.sidecarNfo, true);
  assert.equal(payload.sidecarSubtitle, false);
  assert.equal(payload.sidecarPoster, true);
});

// ─── 密钥只显「已设置 / 未设置」 ─────────────────────────────────────────────

test('②f 密封凭据只说「已设置」，空值说「未设置」，不回显明文/占位', () => {
  assert.equal(describeSecretValue('__sealed:k1'), '已设置');
  assert.equal(describeSecretValue(null), '未设置');
  assert.equal(describeSecretValue(''), '未设置');
  assert.equal(describeSecretValue(undefined), '未设置');
});

// ─── ③ 过期引导两态 ──────────────────────────────────────────────────────────

test('③a last_fault_kind=credential_expired → 判定 expired，标题/动作来自后端', () => {
  const g = resolveCredentialGuidance(
    makeHealth({
      lastFaultKind: 'credential_expired',
      lastFaultTitle: '凭据已过期',
      lastFaultAction: '请重新扫码绑定',
    }),
  );
  assert.equal(g.kind, 'expired');
  assert.equal(g.title, '凭据已过期');
  assert.equal(g.action, '请重新扫码绑定');
});

test('③b last_fault_kind=null（无观测）→ unknown，不伪造过期结论', () => {
  const g = resolveCredentialGuidance(makeHealth({ lastFaultKind: null }));
  assert.equal(g.kind, 'unknown');
  assert.equal(g.title, null);
  assert.equal(g.action, null);
});

test('③c 未取到健康项 / 其它故障类别 → 不得误报过期', () => {
  assert.equal(resolveCredentialGuidance(null).kind, 'unknown');
  assert.equal(resolveCredentialGuidance(undefined).kind, 'unknown');
  assert.equal(resolveCredentialGuidance(makeHealth({ lastFaultKind: 'rate_limited' })).kind, 'none');
});

// ─── ④ health 端点 wire ──────────────────────────────────────────────────────

test('④a GET /api/manage/mounts/health 映射 last_fault_*（snake→camel，null 如实透传）', async () => {
  setResponse({
    items: [
      {
        mount_id: 'm1',
        name: 'n',
        provider_type: 'pan115',
        status: 'active',
        health_status: 'critical',
        status_message: null,
        unavailable_binding_count: null,
        attention_binding_count: null,
        last_checked_at: null,
        last_fault_kind: 'credential_expired',
        last_fault_title: '凭据已过期',
        last_fault_action: '请重新绑定',
        last_fault_at: 1700000000000,
      },
    ],
    total: 1,
  });
  const res = await manageApi.getMountsHealth();
  assert.equal(captured.url, '/api/manage/mounts/health');
  assert.equal(captured.method, 'GET');
  const item = res.items[0];
  assert.equal(item.mountId, 'm1');
  assert.equal(item.lastFaultKind, 'credential_expired');
  assert.equal(item.lastFaultTitle, '凭据已过期');
  assert.equal(item.lastFaultAction, '请重新绑定');
  // ★恒 null 的 attention_binding_count 不补 0
  assert.equal(item.attentionBindingCount, null);
  assert.equal(res.total, 1);
});

test('④b 健康查询失败（500）必须抛出，不得吞成空列表假装健康', async () => {
  setResponse({ code: 'internal', message: 'mounts health port not assembled' }, 500);
  await assert.rejects(() => manageApi.getMountsHealth());
});

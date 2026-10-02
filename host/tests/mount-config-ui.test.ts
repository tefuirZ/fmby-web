/**
 * FE-MOUNT-CONFIG-UI（R2.3–R2.6）：挂载配置六字段的契约穿透 + 校验面。
 *
 * 后端真源（crates/fmby-v2-http/src/dto/manage/mount.rs，均已在后端实装）：
 * - Create `ManagedMountCreateRequest`：note / rate_config / sidecar_* ×3 / visibility_rule
 * - Update `ManagedMountUpdateRequest`：同六字段（Some=替换，缺省=保留存量）
 * - `deny_unknown_fields`：前端少发=后端留存量（诚实），多发未知字段=400。
 *
 * 本卡修三层缺口（先证伪于 host/tests）：
 * ① 契约层：UpdateManageMountRequest/CreateManageMountRequest 缺六字段 →
 *    buildUpdateMountPayload/buildCreateMountPayload 产出的值被 TS 类型与
 *    mapUpdateMountPayloadToApi/mapCreateMountPayloadToApi 静默丢弃，后端永远收不到；
 * ② 校验层：rateConfigText/visibilityRuleText 非法 JSON 无字段级错误（只有
 *    提交时 mutation 泛化 banner）；
 * ③ 渲染层：表单状态已有六字段但 UI 零输入面（MountDrawer 全树无该六字段的
 *    任何 input/textarea/checkbox）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMountFormState,
  buildUpdateMountPayload,
  buildCreateMountPayload,
  createEmptyMountForm,
  validateMountForm,
} from '../src/pages/manage/mounts/formUtils';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import type {
  ManageMountDetailRecord,
  UpdateManageMountRequest,
  CreateManageMountRequest,
} from '@fmby/v2-shared/contracts/manage';

// ─── fetch 桩（同 mount-datasource-backfill 形态） ──────────────────────────
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
  return new Response(JSON.stringify(nextResponse.json), {
    status: nextResponse.status,
    headers: { 'content-type': 'application/json' },
  });
};

function setResponse(json: unknown, status = 200) {
  nextResponse = { status, json };
}

/** 真后端 DTO 形状（照 ManagedMountSummaryDto/DetailDto 字段构造）。 */
function makeDetail(): ManageMountDetailRecord {
  return {
    mount: {
      id: 'm1',
      name: '我的 115 网盘',
      mountType: 'pan115',
      typeLabel: '115 网盘',
      path: '/115',
      pathLabel: '/115',
      healthStatus: 'ok',
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
    configJson: {},
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

/** createMount/updateMount 响应桩（RawManagedMountDetailResponse 最小真形）。 */
function makeDetailResponse() {
  return {
    mount: {
      id: 'm1',
      name: '我的 115 网盘',
      mount_type: 'pan115',
      type_label: '115 网盘',
      path: '/115',
      path_label: '/115',
      health_status: 'ok',
      description: 'd',
      capabilities: [],
      linked_libraries: [],
      note: '主账号',
      rate_config: '{"qps":2}',
      visibility_rule: '{"exclude":["vip"]}',
      sidecar_nfo: true,
      sidecar_subtitle: false,
      sidecar_poster: true,
    },
    provider_type: 'pan115',
    root_path: '/115',
    config_json: {},
    capability_state: {
      can_list: true,
      can_random_read: true,
      can_read_sidecar: false,
      can_generate_play_target: true,
      can_refresh_credentials: true,
    },
    path_policies: [],
    linked_sources: [],
    recent_scan_tasks: [],
  };
}

// ─── ① 契约穿透（wire 真值：mapper 产出的 snake_case 体） ────────────────────

test('①a PATCH wire 体必须携带六字段（当前 mapper 静默丢弃 ⇒ RED）', async () => {
  setResponse(makeDetailResponse());
  const form = buildMountFormState(makeDetail());
  // 用户在 UI 改掉备注/速率/可见性/旁路三开关
  form.note = '改过的备注';
  form.rateConfigText = '{"qps":9}';
  form.visibilityRuleText = '{"exclude":["vip","guest"]}';
  form.sidecarNfo = false;
  form.sidecarSubtitle = true;
  form.sidecarPoster = false;

  await manageApi.updateMount('m1', buildUpdateMountPayload(form) as UpdateManageMountRequest);

  const body = captured.body as Record<string, unknown>;
  assert.equal(captured.method, 'PATCH');
  assert.equal(body.note, '改过的备注', 'note 必须穿透到 wire 体');
  assert.deepEqual(body.rate_config, { qps: 9 }, 'rateConfig 必须映射为 rate_config 穿透');
  assert.deepEqual(body.visibility_rule, { exclude: ['vip', 'guest'] }, 'visibilityRule 必须映射为 visibility_rule 穿透');
  assert.equal(body.sidecar_nfo, false);
  assert.equal(body.sidecar_subtitle, true);
  assert.equal(body.sidecar_poster, false);
});

test('①b 六字段留空/缺省 ⇒ wire 体不带这些键（后端缺省=保留存量，不发=诚实）', async () => {
  setResponse(makeDetailResponse());
  const form = buildMountFormState(makeDetail());
  // 全部维持回填值（用户没改）——PATCH 仍应原样回传存量（Some=替换语义由后端管）
  await manageApi.updateMount('m1', buildUpdateMountPayload(form) as UpdateManageMountRequest);
  const body = captured.body as Record<string, unknown>;
  assert.equal(body.note, '主账号');
  assert.deepEqual(body.rate_config, { qps: 2 });
  assert.equal(body.sidecar_nfo, true);
});

test('①c rateConfig 留空文本 ⇒ rate_config 显式 null（清除语义），不是 undefined 丢键', async () => {
  setResponse(makeDetailResponse());
  const form = buildMountFormState(makeDetail());
  form.rateConfigText = '';
  await manageApi.updateMount('m1', buildUpdateMountPayload(form) as UpdateManageMountRequest);
  const body = captured.body as Record<string, unknown>;
  assert.equal(
    'rate_config' in body,
    true,
    '留空=用户想清除，必须显式 null（undefined 会被后端当成「未提供→保留存量」）',
  );
  assert.equal(body.rate_config, null);
});

test('①d Create wire 体同样携带六字段', async () => {
  setResponse(makeDetailResponse());
  const form = createEmptyMountForm();
  form.name = '新数据源';
  form.note = '创建时备注';
  form.rateConfigText = '{"qps":1}';
  form.visibilityRuleText = '{}';
  form.sidecarNfo = true;
  form.sidecarSubtitle = true;
  form.sidecarPoster = true;

  await manageApi.createMount(buildCreateMountPayload(form) as CreateManageMountRequest);

  const body = captured.body as Record<string, unknown>;
  assert.equal(captured.method, 'POST');
  assert.equal(body.note, '创建时备注');
  assert.deepEqual(body.rate_config, { qps: 1 });
  assert.deepEqual(body.visibility_rule, {});
  assert.equal(body.sidecar_nfo, true);
  assert.equal(body.sidecar_subtitle, true);
  assert.equal(body.sidecar_poster, true);
});

// ─── ② 校验面（字段级、诚实错误） ────────────────────────────────────────────

test('②a rateConfigText 非法 JSON ⇒ validateMountForm 报 rateConfig 字段级错误', () => {
  const form = { ...createEmptyMountForm(), rateConfigText: '{qps:2}' };
  const errors = validateMountForm(form);
  assert.match(String(errors.rateConfig ?? ''), /JSON/, '非法速率 JSON 必须字段级报错（rateConfig 键）');
});

test('②b visibilityRuleText 非法 JSON ⇒ 字段级错误（visibilityRule 键）', () => {
  const form = { ...createEmptyMountForm(), visibilityRuleText: 'not-json' };
  const errors = validateMountForm(form);
  assert.match(String(errors.visibilityRule ?? ''), /JSON/);
});

test('②c 合法 JSON/留空 ⇒ 无校验错误（留空=清除，不是错误）', () => {
  const ok = validateMountForm({
    ...createEmptyMountForm(),
    rateConfigText: '{"qps":2}',
    visibilityRuleText: '',
  });
  assert.equal(ok.rateConfig, undefined);
  assert.equal(ok.visibilityRule, undefined);
});

// ─── ③ 渲染面（六字段 UI 输入面必须存在） ───────────────────────────────────

// node:test（strip-types）不支持 .tsx ⇒ 与仓内先例同构（FE-IDENTITY-BINDINGS-EMAIL）：
// UI 面断言绑定到纯函数字段描述符，.tsx 渲染消费同一描述符（不可能漂移）。
test('③ 六字段描述符：label/回填值/字段错误键一一对应', async () => {
  const { MOUNT_CONFIG_FIELDS } = await import(
    '../src/pages/manage/mounts/mountConfigFields'
  );
  const form = buildMountFormState(makeDetail());

  assert.equal(MOUNT_CONFIG_FIELDS.length, 6, 'R2.3–R2.6 共 6 个配置字段');
  const labels = MOUNT_CONFIG_FIELDS.map((f) => f.label);
  for (const marker of ['备注', '速率配置', '可见性规则', 'NFO', '字幕', '海报']) {
    assert.ok(labels.some((l) => l.includes(marker)), `UI 必须含「${marker}」输入面（描述符缺即漂移）`);
  }
  // 文本型字段绑定 formState 键（回填值进 DOM 由 .tsx 读同一键）
  const textFields = MOUNT_CONFIG_FIELDS.filter((f) => f.kind === 'text');
  assert.equal(textFields.length, 3, 'note/rateConfig/visibilityRule 为文本型');
  for (const f of textFields) {
    const value = (form as unknown as Record<string, unknown>)[f.formKey];
    assert.ok(value !== undefined, `${f.formKey} 回填值必须可从 formState 取到`);
  }
  assert.equal(textFields.find((f) => f.formKey === 'note')?.value(form), '主账号', 'note 回填值');
  assert.equal(textFields.find((f) => f.formKey === 'rateConfigText')?.value(form), '{"qps":2}');
  assert.equal(textFields.find((f) => f.formKey === 'visibilityRuleText')?.value(form), '{"exclude":["vip"]}');
  // 开关型字段
  const toggles = MOUNT_CONFIG_FIELDS.filter((f) => f.kind === 'toggle');
  assert.equal(toggles.length, 3, 'sidecar* 三项为开关型');
  for (const f of toggles) {
    assert.equal(typeof (f as { value?: unknown }).value === 'function' || f.formKey in form, true);
  }
  assert.equal(toggles.find((f) => f.formKey === 'sidecarNfo')?.value?.(form), true);
  assert.equal(toggles.find((f) => f.formKey === 'sidecarSubtitle')?.value?.(form), false);
  assert.equal(toggles.find((f) => f.formKey === 'sidecarPoster')?.value?.(form), true);
});

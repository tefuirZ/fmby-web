// FE-MOUNT-CONFIG-UI：挂载配置面（备注/速率/旁路开关/可见性）payload 一致性对拍。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 后端 ManagedMountCreateRequest 与 ManagedMountUpdateRequest **都**收
// note/rate_config/visibility_rule/sidecar_nfo/subtitle/poster（R2.3–R2.6）。
// 证伪：buildUpdateMountPayload 已带这些字段，buildCreateMountPayload 却丢弃
// ⇒ 新建挂载无法提交配置（POST/PATCH 不一致）。

import test from 'node:test';
import assert from 'node:assert/strict';

const { buildCreateMountPayload, buildUpdateMountPayload } = await import(
  '@fmby/v2-shared/../../host/src/pages/manage/mounts/mountFormState'
);
const { isPaidFeatureEnabled } = await import(
  '@fmby/v2-shared/../../host/src/pages/manage/license/licenseAccess'
);

const baseForm = {
  name: '媒体盘',
  providerType: 'local' as never,
  rootPath: '/data/media',
  capabilities: {} as never,
  pathPolicies: [],
  configJsonText: '{}',
  remoteConfig: {} as never,
  preservedConfig: {},
  note: '主媒体库',
  rateConfigText: '{"limit_mb_s": 20}',
  visibilityRuleText: '{"hidden_paths": ["/x"]}',
  sidecarNfo: true,
  sidecarSubtitle: false,
  sidecarPoster: true,
};

test('① PATCH payload 携带配置六件套（既有行为 characterization）', () => {
  const payload = buildUpdateMountPayload(baseForm as never) as Record<string, unknown>;
  assert.equal(payload.note, '主媒体库');
  assert.deepEqual(payload.rateConfig, { limit_mb_s: 20 });
  assert.deepEqual(payload.visibilityRule, { hidden_paths: ['/x'] });
  assert.equal(payload.sidecarNfo, true);
  assert.equal(payload.sidecarSubtitle, false);
  assert.equal(payload.sidecarPoster, true);
});

test('② POST payload 也必须携带配置六件套（RED：本卡补）', () => {
  const payload = buildCreateMountPayload(baseForm as never) as Record<string, unknown>;
  assert.equal(payload.note, '主媒体库');
  assert.deepEqual(payload.rateConfig, { limit_mb_s: 20 });
  assert.deepEqual(payload.visibilityRule, { hidden_paths: ['/x'] });
  assert.equal(payload.sidecarNfo, true);
  assert.equal(payload.sidecarSubtitle, false);
  assert.equal(payload.sidecarPoster, true);
});

test('③ 空速率/可见性文本 → null/{}/缺省（不把垃圾字符串上抛）', () => {
  const form = { ...baseForm, rateConfigText: '', visibilityRuleText: '' } as never;
  const payload = buildCreateMountPayload(form) as Record<string, unknown>;
  assert.equal(payload.rateConfig ?? null, null);
  assert.deepEqual(payload.visibilityRule, {});
});

test('④ 速率/可见性非法 JSON → 校验报错不上抛（诚实错误）', () => {
  const form = { ...baseForm, rateConfigText: '{bad json' } as never;
  const payload = buildCreateMountPayload(form) as Record<string, unknown>;
  // 非 JSON 文本不得原样进 payload（要么 null 要么解析后的对象；不允许字符串直传）
  assert.notEqual(typeof payload.rateConfig, 'string');
});

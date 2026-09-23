/**
 * W5-G 卡① 契约+域层：授权面照 V1 对齐的防回归单测（纯函数，无网络）。
 *
 * 覆盖（照 V1 `contracts/manage/license-{status,summary,entitlement}.ts` 语义）：
 * ① status：三套枚举解析 fail-closed（未知值抛错 / ...OrUnknown 归 'unknown'）+ 标签/色调；
 * ② entitlement：分类、可读标签与说明、limit 用量读取与用量标签、取值归一化/类型；
 * ③ summary：surface → 可见性位映射（含 upstreams 或语义）、FREE 兜底、非法 surface=false；
 * ④ access：由 status 派生可见性、无状态 fail-closed 为免费基线。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const status = await import('../src/contracts/manage/license/status.ts');
const entitlement = await import('../src/contracts/manage/license/entitlement.ts');
const summary = await import('../src/contracts/manage/license/summary.ts');
const access = await import('../src/contracts/manage/license/access.ts');
const licenseIndex = await import('../src/contracts/manage/license/index.ts');

test('status ①：六态/六态/四态解析 fail-closed + 标签色调', () => {
  assert.equal(status.parseLicenseRuntimeState('active'), 'active');
  assert.throws(() => status.parseLicenseRuntimeState('bogus'));
  assert.equal(status.parseLicenseRuntimeStateOrUnknown('bogus'), 'unknown');
  assert.equal(status.parseLicenseRuntimeStateOrUnknown(null), 'unknown');

  assert.equal(status.parseLicenseRealtimeStatus('connected'), 'connected');
  assert.throws(() => status.parseLicenseRealtimeStatus('nope'));
  assert.equal(status.parseLicensePollStatus('authorized'), 'authorized');
  assert.throws(() => status.parseLicensePollStatus('nope'));

  assert.equal(status.getLicenseRuntimeStateLabel('grace'), '宽限期');
  assert.equal(status.getLicenseRuntimeStateTone('active'), 'success');
  assert.equal(status.getLicenseRuntimeStateTone('expired'), 'danger');
  assert.equal(status.getLicenseRuntimeStateTone('bogus'), 'neutral');
  assert.equal(status.getLicenseRealtimeStatusLabel('blocked'), '已阻断');
  assert.equal(status.getLicenseRealtimeStatusTone('blocked'), 'danger');
  // realtime enabled=false 时强制 neutral（照 V1 options.enabled）
  assert.equal(status.getLicenseRealtimeStatusTone('connected', { enabled: false }), 'neutral');
  assert.equal(status.getLicensePollStatusLabel('denied'), '已拒绝');
});

test('entitlement ②：分类 / 标签说明 / limit 用量读取', () => {
  assert.equal(entitlement.getLicenseEntitlementCategory('feature.storage.pan115.provider'), 'feature');
  assert.equal(entitlement.getLicenseEntitlementCategory('limit.users.max'), 'limit');
  assert.equal(entitlement.getLicenseEntitlementCategory('policy.lease.ttl_secs'), 'policy');
  assert.equal(entitlement.getLicenseEntitlementCategory('mystery.key'), 'other');

  const meta = entitlement.getLicenseEntitlementMeta('feature.storage.pan115.provider');
  assert.equal(meta?.label, '115 普通网盘');
  assert.ok(meta?.description && meta.description.length > 0);
  // V1 的无 description 项（limit.users.max）不得被伪造
  assert.equal(entitlement.getLicenseEntitlementMeta('limit.users.max')?.description, undefined);

  const usage = {
    userCount: 7,
    adminCount: 1,
    libraryCount: 2,
    storageMountCount: 3,
    pan115MountCount: 0,
    pan115ShareMountCount: 0,
    microsoftMountCount: 0,
    microsoftAccountCount: 0,
    upstreamSourceCount: 0,
    upstreamEmbyCount: 0,
    upstreamAppleCmsCount: 0,
    activePlaybackSessionCount: 4,
    openApiTokenCount: 0,
  };
  assert.equal(entitlement.readLicenseLimitUsage('limit.users.max', usage), 7);
  assert.equal(entitlement.readLicenseLimitUsage('limit.concurrent_streams.max', usage), 4);
  assert.equal(entitlement.readLicenseLimitUsage('feature.open_api', usage), undefined);
  assert.equal(entitlement.getLicenseLimitUsageLabel('limit.users.max'), '当前用户');

  // 取值归一化与类型判定
  assert.equal(entitlement.normalizeLicenseEntitlementValue({ value: 42 }), 42);
  assert.equal(entitlement.normalizeLicenseEntitlementValue({ bool: true }), true);
  assert.equal(entitlement.normalizeLicenseEntitlementValue('raw'), 'raw');
  assert.equal(entitlement.getLicenseEntitlementValueType(true), 'bool');
  assert.equal(entitlement.getLicenseEntitlementValueType(3), 'integer');
  assert.equal(entitlement.getLicenseEntitlementValueType('x'), 'string');
  assert.equal(entitlement.getLicenseEntitlementValueType(null), 'unknown');
});

test('summary ③：surface → 可见性位映射（含 upstreams 或语义）', () => {
  const vis = { ...summary.FREE_LICENSE_VISIBILITY, pan115Provider: true, upstreamAppleCms: true };
  assert.equal(summary.canUseLicenseVisibilitySurface(vis, 'pan115'), true);
  assert.equal(summary.canUseLicenseVisibilitySurface(vis, 'pan115-share'), false);
  assert.equal(summary.canUseLicenseVisibilitySurface(vis, 'upstreams'), true); // apple_cms 命中
  assert.equal(summary.canUseLicenseVisibilitySurface(vis, 'unknown-surface'), false);
  assert.equal(summary.isPaidManageSurface('microsoft'), true);
  assert.equal(summary.isPaidManageSurface('bogus'), false);
  assert.equal(summary.PAID_MANAGE_SURFACES.length, 15);
});

test('access ④：由 status 派生可见性；无状态 → 免费基线 fail-closed', () => {
  const localOnly = { ...summary.FREE_LICENSE_VISIBILITY };
  assert.deepEqual(access.resolveLicenseVisibility(null), localOnly);
  assert.deepEqual(access.resolveLicenseVisibility(undefined), localOnly);
  const fakeStatus = {
    summary: { visibility: { ...summary.FREE_LICENSE_VISIBILITY, microsoftProvider: true } },
  } as never;
  assert.equal(access.resolveLicenseVisibility(fakeStatus).microsoftProvider, true);
  assert.equal(access.canUsePaidManageSurface(access.resolveLicenseVisibility(fakeStatus), 'microsoft'), true);
});

test('barrel：新模块从 license barrel 可取用', () => {
  assert.equal(typeof licenseIndex.getLicenseRuntimeStateLabel, 'function');
  assert.equal(typeof licenseIndex.canUseLicenseVisibilitySurface, 'function');
  assert.equal(typeof licenseIndex.resolveLicenseVisibility, 'function');
  assert.equal(typeof licenseIndex.licenseApi.getStatus, 'function');
});

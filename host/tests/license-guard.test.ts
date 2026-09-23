/**
 * W5-G 卡③ 付费守卫：`canUsePaidFeature` / `isPaidFeatureEnabled` 必须读**真
 * `summary.visibility.*`** 判定，不得退化成 env 开关（卡面红线）。
 *
 * 从 Vite-free 模块导入（`featureFlags.ts` 顶层含 `import.meta.env`，node:test 不可导入）。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canUsePaidFeature,
  isPaidFeatureEnabled,
} from '../src/pages/manage/license/licenseAccess.ts';
import { FREE_LICENSE_VISIBILITY } from '@fmby/v2-shared/contracts/manage/license';

test('FREE 可见性 → 所有付费 surface 拒绝', () => {
  assert.equal(canUsePaidFeature(FREE_LICENSE_VISIBILITY, 'microsoft'), false);
  assert.equal(canUsePaidFeature(FREE_LICENSE_VISIBILITY, 'pan115-imghost'), false);
  assert.equal(canUsePaidFeature(FREE_LICENSE_VISIBILITY, 'registration-codes'), false);
});

test('summary.visibility 命中 → 放行（真可见性，非 env）', () => {
  const vis = { ...FREE_LICENSE_VISIBILITY, microsoftProvider: true };
  assert.equal(canUsePaidFeature(vis, 'microsoft'), true);
  assert.equal(canUsePaidFeature(vis, 'pan115-imghost'), false);
});

test('isPaidFeatureEnabled：由 status 派生；无状态 fail-closed', () => {
  const status = {
    summary: { visibility: { ...FREE_LICENSE_VISIBILITY, pan115Imghost: true } },
  } as never;
  assert.equal(isPaidFeatureEnabled(status, 'pan115-imghost'), true);
  assert.equal(isPaidFeatureEnabled(null, 'pan115-imghost'), false);
  assert.equal(isPaidFeatureEnabled(undefined, 'pan115-imghost'), false);
});

test('isPaidFeatureEnabled：string[] 任一命中即放行（照 V1 upstreams 或语义）', () => {
  const status = {
    summary: { visibility: { ...FREE_LICENSE_VISIBILITY, upstreamAppleCms: true } },
  } as never;
  assert.equal(isPaidFeatureEnabled(status, ['upstream-emby', 'upstream-apple-cms']), true);
  assert.equal(isPaidFeatureEnabled(status, ['upstream-emby', 'microsoft']), false);
});

test('env 开关不得影响判定：VISIBILITY 缺位时即便设 env 也拒绝', () => {
  const prev = process.env.VITE_FEATURE_PAN115_IMGHOST;
  process.env.VITE_FEATURE_PAN115_IMGHOST = '1';
  try {
    assert.equal(canUsePaidFeature(FREE_LICENSE_VISIBILITY, 'pan115-imghost'), false);
  } finally {
    if (prev === undefined) delete process.env.VITE_FEATURE_PAN115_IMGHOST;
    else process.env.VITE_FEATURE_PAN115_IMGHOST = prev;
  }
});

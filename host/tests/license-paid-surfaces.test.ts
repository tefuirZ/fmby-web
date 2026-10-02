/**
 * FE-LICENSE-REMAINING：字段级付费门（V1 4 处对位）纯判定 RED/回归。
 *
 * 覆盖：
 * - 登录提供方 → 付费 surface 映射（V1 `SiteSettingsSecuritySection` 的
 *   `identity-google`/`identity-telegram` 字段级门）；
 * - 免费基线 fail-closed（`FREE_LICENSE_VISIBILITY` 全 false ⇒ 5 个新接 surface 全不可用）；
 * - 开通后对应 surface 放行、其余仍拒（不误伤）。
 *
 * RED：`paidSurfaceForAuthProvider` 未加时本测试导入失败（feature missing）。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { FREE_LICENSE_VISIBILITY } from '@fmby/v2-shared/contracts/manage/license';
import {
  canUsePaidFeature,
  paidSurfaceForAuthProvider,
} from '@/pages/manage/license/licenseAccess';

test('登录提供方 → 付费 surface 映射（大小写不敏感；非付费 provider 不受门控）', () => {
  assert.equal(paidSurfaceForAuthProvider('google'), 'identity-google');
  assert.equal(paidSurfaceForAuthProvider('GOOGLE'), 'identity-google');
  assert.equal(paidSurfaceForAuthProvider('telegram'), 'identity-telegram');
  assert.equal(paidSurfaceForAuthProvider('Telegram'), 'identity-telegram');
  assert.equal(paidSurfaceForAuthProvider('email'), null);
  assert.equal(paidSurfaceForAuthProvider('github'), null);
});

test('免费基线 fail-closed：4 处新接 surface 全不可用', () => {
  for (const surface of [
    'user-expiration',
    'identity-google',
    'identity-telegram',
    'registration-window',
    'upstream-emby',
  ]) {
    assert.equal(
      canUsePaidFeature(FREE_LICENSE_VISIBILITY, surface),
      false,
      `${surface} 在免费基线必须不可用`,
    );
  }
});

test('开通后对应 surface 放行、其余仍拒（不误伤）', () => {
  const visible = { ...FREE_LICENSE_VISIBILITY, identityGoogle: true, userExpiration: true };
  assert.equal(canUsePaidFeature(visible, 'identity-google'), true);
  assert.equal(canUsePaidFeature(visible, 'user-expiration'), true);
  assert.equal(
    canUsePaidFeature(visible, 'identity-telegram'),
    false,
    '未开通的 telegram 仍须拒',
  );
});

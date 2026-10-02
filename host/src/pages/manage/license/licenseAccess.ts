/**
 * 付费可见性判定（Vite-free，便于 node:test 直接断言）。
 *
 * 照 V1 `shared/featureFlags.ts` 的 `canUsePaidFeature` 语义，但数据源是**真**
 * `status.summary.visibility.*`（卡面红线：不得退化成 env 开关）。放在 Vite-free
 * 模块里是因为 `featureFlags.ts` 顶层引用 `import.meta.env`，node:test 无法导入。
 */

import {
  canUseLicenseVisibilitySurface,
  resolveLicenseVisibility,
} from '@fmby/v2-shared/contracts/manage/license';
import type {
  LicenseStatusRecord,
  LicenseVisibilityRecord,
} from '@fmby/v2-shared/contracts/manage/license';

/** surface 名 → 是否可用（照 V1 `canUsePaidFeature(surface)`，入参带可见性）。 */
export function canUsePaidFeature(
  visibility: LicenseVisibilityRecord,
  surface: string,
): boolean {
  return canUseLicenseVisibilitySurface(visibility, surface);
}

/** 守卫用决策：由 status 派生可见性；`string | string[]` 任一命中即放行（照 V1）。 */
export function isPaidFeatureEnabled(
  status: LicenseStatusRecord | null | undefined,
  feature: string | string[],
): boolean {
  const visibility = resolveLicenseVisibility(status);
  return Array.isArray(feature)
    ? feature.some((item) => canUsePaidFeature(visibility, item))
    : canUsePaidFeature(visibility, feature);
}

/**
 * 登录提供方 → 付费 surface（照 V1 `SiteSettingsSecuritySection` 的
 * `identity-google`/`identity-telegram` 字段级付费门，逐字对位）。
 * 非付费提供方（email 等）返回 `null`（不受授权门控）。
 */
export function paidSurfaceForAuthProvider(provider: string): string | null {
  switch (provider.toLowerCase()) {
    case 'google':
      return 'identity-google';
    case 'telegram':
      return 'identity-telegram';
    default:
      return null;
  }
}

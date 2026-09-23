/**
 * 授权可见性访问（照 V1 `domains/manage/license/access.ts` 对位；数据源改 V2 形态）。
 *
 * V1 从 bootstrap `features.license` 同步读可见性；V2 无该 bootstrap 载荷，
 * 可见性来自 `GET /manage/license/status` 的 `summary.visibility`。因此本模块提供
 * **纯函数**：由 status（或 undefined）派生可见性、判定付费 surface；由调用方决定
 * 用查询缓存还是启动载荷喂入——保持与 V1 相同的判定语义。
 */

import { FREE_LICENSE_VISIBILITY, canUseLicenseVisibilitySurface } from './summary';
import type { LicenseStatusRecord, LicenseVisibilityRecord } from './types';

/** 由授权状态派生可见性；无状态时 fail-closed 为免费基线（照 V1 FREE 兜底）。 */
export function resolveLicenseVisibility(
  status: LicenseStatusRecord | null | undefined,
): LicenseVisibilityRecord {
  return status?.summary?.visibility ?? FREE_LICENSE_VISIBILITY;
}

/** surface 名 → 是否可用（照 V1 `canUsePaidManageSurface(surface)`）。 */
export function canUsePaidManageSurface(
  visibility: LicenseVisibilityRecord,
  surface: string,
): boolean {
  return canUseLicenseVisibilitySurface(visibility, surface);
}

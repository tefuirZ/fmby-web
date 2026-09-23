/**
 * 套餐摘要可见性（照 V1 `contracts/manage/license-summary.ts` 的付费守卫半边对齐）。
 *
 * 后端 `status.summary.visibility` 给出 14 个付费能力位；`PAID_MANAGE_SURFACES`
 * 是前端页面/子功能使用的 surface 名到可见性位的映射键。未授权时前端以
 * 「需进阶版 + 去激活」引导呈现（交互模型照 V1，不改）。
 */

import type { LicenseVisibilityRecord } from './types';

export const PAID_MANAGE_SURFACES = [
  'microsoft',
  'microsoft-account-pool',
  'pan115',
  'pan115-share',
  'pan115-imghost',
  'upstream-emby',
  'upstream-apple-cms',
  'upstreams',
  'registration-codes',
  'registration-window',
  'user-expiration',
  'identity-google',
  'identity-telegram',
  'poster-imghost',
  'internal-imghost',
] as const;

export type PaidManageSurface = (typeof PAID_MANAGE_SURFACES)[number];

/** 全 false 的免费基线可见性（无 summary 时的 fail-closed 兜底）。 */
export const FREE_LICENSE_VISIBILITY: LicenseVisibilityRecord = {
  pan115Provider: false,
  pan115Share: false,
  pan115Imghost: false,
  microsoftProvider: false,
  microsoftAccountPool: false,
  upstreamEmby: false,
  upstreamAppleCms: false,
  registrationCodes: false,
  registrationWindow: false,
  userExpiration: false,
  identityTelegram: false,
  identityGoogle: false,
  posterImghost: false,
  internalImghost: false,
};

export function isPaidManageSurface(value: string): value is PaidManageSurface {
  return (PAID_MANAGE_SURFACES as readonly string[]).includes(value);
}

/** surface 名 → 可见性位（照 V1 `canUseLicenseVisibilitySurface` 逐项）。 */
export function canUseLicenseVisibilitySurface(
  visibility: LicenseVisibilityRecord,
  surface: string,
): boolean {
  switch (surface) {
    case 'pan115':
      return visibility.pan115Provider;
    case 'pan115-share':
      return visibility.pan115Share;
    case 'pan115-imghost':
      return visibility.pan115Imghost;
    case 'microsoft':
      return visibility.microsoftProvider;
    case 'microsoft-account-pool':
      return visibility.microsoftAccountPool;
    case 'upstream-emby':
      return visibility.upstreamEmby;
    case 'upstream-apple-cms':
      return visibility.upstreamAppleCms;
    case 'upstreams':
      return visibility.upstreamEmby || visibility.upstreamAppleCms;
    case 'registration-codes':
      return visibility.registrationCodes;
    case 'registration-window':
      return visibility.registrationWindow;
    case 'user-expiration':
      return visibility.userExpiration;
    case 'identity-telegram':
      return visibility.identityTelegram;
    case 'identity-google':
      return visibility.identityGoogle;
    case 'poster-imghost':
      return visibility.posterImghost;
    case 'internal-imghost':
      return visibility.internalImghost;
    default:
      return false;
  }
}

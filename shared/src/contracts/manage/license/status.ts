/**
 * 授权状态枚举：解析器 / 标签 / 色调（照 V1 `contracts/manage/license-status.ts` 逐项对齐）。
 *
 * 三套枚举值域与后端 DTO 逐字一致：
 * - runtime 六态：unactivated / pending / active / grace / expired / invalid
 * - realtime 六态：disabled / idle / ready / connected / error / blocked
 * - poll 四态：pending / authorized / expired / denied
 *
 * 色调与 `StatusBadgeVariant` 同域（success | warning | danger | info | neutral）。
 */

import type {
  LicensePollStatus,
  LicenseRealtimeStatus,
  LicenseRuntimeState,
} from './types';

export type LicenseStatusTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

export type LicenseRuntimeStateOrUnknown = LicenseRuntimeState | 'unknown';
export type LicenseRealtimeStatusOrUnknown = LicenseRealtimeStatus | 'unknown';
export type LicensePollStatusOrUnknown = LicensePollStatus | 'unknown';

const RUNTIME_STATES = new Set<LicenseRuntimeState>([
  'unactivated',
  'pending',
  'active',
  'grace',
  'expired',
  'invalid',
]);

const REALTIME_STATUSES = new Set<LicenseRealtimeStatus>([
  'disabled',
  'idle',
  'ready',
  'connected',
  'error',
  'blocked',
]);

const POLL_STATUSES = new Set<LicensePollStatus>([
  'pending',
  'authorized',
  'expired',
  'denied',
]);

/** 运行态标签（照 V1 `getLicenseRuntimeStateLabel`）。 */
export const licenseRuntimeStateLabels: Record<LicenseRuntimeState, string> = {
  unactivated: '未激活',
  pending: '等待授权',
  active: '有效',
  grace: '宽限期',
  expired: '已过期',
  invalid: '无效',
};

/** 运行态色调（照 V1 `LICENSE_RUNTIME_STATE_TONES`）。 */
export const licenseRuntimeStateTones: Record<LicenseRuntimeState, LicenseStatusTone> = {
  unactivated: 'neutral',
  pending: 'warning',
  active: 'success',
  grace: 'warning',
  expired: 'danger',
  invalid: 'danger',
};

/** realtime 状态标签（照 V1 `getLicenseRealtimeStatusLabel`）。 */
export const licenseRealtimeStatusLabels: Record<LicenseRealtimeStatus, string> = {
  disabled: '未启用',
  idle: '空闲',
  ready: '待连接',
  connected: '已连接',
  error: '连接异常',
  blocked: '已阻断',
};

/** realtime 状态色调（照 V1 `LICENSE_REALTIME_STATUS_TONES`）。 */
export const licenseRealtimeStatusTones: Record<LicenseRealtimeStatus, LicenseStatusTone> = {
  disabled: 'neutral',
  idle: 'info',
  ready: 'info',
  connected: 'success',
  error: 'warning',
  blocked: 'danger',
};

/** poll 状态标签（照 V1 `getLicensePollStatusLabel`）。 */
export const licensePollStatusLabels: Record<LicensePollStatus, string> = {
  pending: '等待授权',
  authorized: '已授权',
  expired: '已过期',
  denied: '已拒绝',
};

export function isLicenseRuntimeState(value: string | undefined | null): value is LicenseRuntimeState {
  return value != null && RUNTIME_STATES.has(value as LicenseRuntimeState);
}

export function isLicenseRealtimeStatus(
  value: string | undefined | null,
): value is LicenseRealtimeStatus {
  return value != null && REALTIME_STATUSES.has(value as LicenseRealtimeStatus);
}

export function isLicensePollStatus(value: string | undefined | null): value is LicensePollStatus {
  return value != null && POLL_STATUSES.has(value as LicensePollStatus);
}

export function readLicenseRuntimeState(
  value: string | undefined | null,
): LicenseRuntimeState | undefined {
  return isLicenseRuntimeState(value) ? value : undefined;
}

export function readLicenseRealtimeStatus(
  value: string | undefined | null,
): LicenseRealtimeStatus | undefined {
  return isLicenseRealtimeStatus(value) ? value : undefined;
}

export function readLicensePollStatus(
  value: string | undefined | null,
): LicensePollStatus | undefined {
  return isLicensePollStatus(value) ? value : undefined;
}

export function parseLicenseRuntimeState(value: string | undefined | null): LicenseRuntimeState {
  const parsed = readLicenseRuntimeState(value);
  if (parsed) return parsed;
  throw new Error(`未知授权运行状态：${value ?? ''}`);
}

export function parseLicenseRealtimeStatus(
  value: string | undefined | null,
): LicenseRealtimeStatus {
  const parsed = readLicenseRealtimeStatus(value);
  if (parsed) return parsed;
  throw new Error(`未知授权 realtime 状态：${value ?? ''}`);
}

export function parseLicensePollStatus(value: string | undefined | null): LicensePollStatus {
  const parsed = readLicensePollStatus(value);
  if (parsed) return parsed;
  throw new Error(`未知授权轮询状态：${value ?? ''}`);
}

export function parseLicenseRuntimeStateOrUnknown(
  value: string | undefined | null,
): LicenseRuntimeStateOrUnknown {
  return readLicenseRuntimeState(value) ?? 'unknown';
}

export function parseLicenseRealtimeStatusOrUnknown(
  value: string | undefined | null,
): LicenseRealtimeStatusOrUnknown {
  return readLicenseRealtimeStatus(value) ?? 'unknown';
}

export function parseLicensePollStatusOrUnknown(
  value: string | undefined | null,
): LicensePollStatusOrUnknown {
  return readLicensePollStatus(value) ?? 'unknown';
}

export function getLicenseRuntimeStateLabel(state: LicenseRuntimeState): string {
  return licenseRuntimeStateLabels[state];
}

export function getLicenseRuntimeStateTone(
  state?: LicenseRuntimeState | string | null,
): LicenseStatusTone {
  return isLicenseRuntimeState(state) ? licenseRuntimeStateTones[state] : 'neutral';
}

export function getLicenseRealtimeStatusLabel(status: LicenseRealtimeStatus): string {
  return licenseRealtimeStatusLabels[status];
}

export function getLicenseRealtimeStatusTone(
  status?: LicenseRealtimeStatus | string | null,
  options: { enabled?: boolean } = {},
): LicenseStatusTone {
  if (options.enabled === false) return 'neutral';
  return isLicenseRealtimeStatus(status) ? licenseRealtimeStatusTones[status] : 'neutral';
}

export function getLicensePollStatusLabel(status: LicensePollStatus): string {
  return licensePollStatusLabels[status];
}

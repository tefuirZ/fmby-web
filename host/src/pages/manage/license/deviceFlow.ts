/**
 * 设备流轮询纯判定（Vite-free，供 node:test 直接断言）。
 *
 * ponytail: 只抽「flow 是否到期」这一条判定；轮询调度仍留在 hook，
 * 需要更细的 phase 机（denied 与超时分别呈现）时再抽。
 */

import type { LicenseDeviceFlowRecord } from '@fmby/v2-shared/contracts/manage/license';

/** flow 是否已到期（epoch ms）；未提供 expiresAt 视为不判超时（照 V1 语义）。 */
export function isDeviceFlowExpired(
  flow: Pick<LicenseDeviceFlowRecord, 'expiresAt'> | null | undefined,
  now: number = Date.now(),
): boolean {
  return flow?.expiresAt != null && flow.expiresAt <= now;
}

/**
 * 套餐摘要呈现（照 V1 `pages/manage/license/licenseSummaryPresentation.ts` 逐项对齐）。
 */

import type {
  LicenseCapabilityRecord,
  LicenseCapabilityGroupRecord,
  LicenseRealtimeStatus,
  LicenseRuntimeState,
  LicenseSummaryRecord,
  LicenseUserLimitRecord,
} from '@fmby/v2-shared/contracts/manage/license';
import {
  getLicenseRealtimeStatusLabel,
  getLicenseRuntimeStateLabel,
  isLicenseRealtimeStatus,
  isLicenseRuntimeState,
} from '@fmby/v2-shared/contracts/manage/license';

/**
 * ★LICENSE-UX-STATUS-LABELS：授权状态**必须是中文标签**。
 *
 * 缺陷本体（用户面是「看不懂」，不是排版）：状态总览原先把后端枚举**原样**当标签渲染
 * （`status.runtimeState ?? '未知'` ⇒ 徽章上写 `unactivated` / `grace`），
 * 而中文映射 `getLicenseRuntimeStateLabel` 在 shared 里**早就有**——
 * 只是没有任何判据锁「页面有没有用它」，所以函数一直绿、界面一直露英文。
 * 故此处**只做转调**（不新造映射表），并给未知值保留原值便于报障。
 */
export function formatRuntimeStatusLabel(state: LicenseRuntimeState | null | undefined): string {
  if (isLicenseRuntimeState(state)) {
    return getLicenseRuntimeStateLabel(state);
  }
  // 空值与「非六态的值」要分开说：前者是尚未取到状态，后者是版本不匹配（报障需要原值）。
  return state == null ? '未知' : `未知状态（${String(state)}）`;
}

/** realtime 六态中文标签；空值保留「待初始化」原语义（未拿到通道状态）。 */
export function formatRealtimeStatusLabel(
  status: LicenseRealtimeStatus | null | undefined,
): string {
  if (isLicenseRealtimeStatus(status)) {
    return getLicenseRealtimeStatusLabel(status);
  }
  return status == null ? '待初始化' : `未知状态（${String(status)}）`;
}

export interface LicenseCapabilitySummaryGroup {
  key: string;
  label: string;
  enabledCount: number;
  totalCount: number;
  items: Array<LicenseCapabilityRecord & { statusLabel: string }>;
}

export function formatPlanSourceLabel(source: string): string {
  switch (source) {
    case 'free_baseline':
      return '免费基线';
    case 'signed_lease':
      return '服务端签名授权';
    case 'lease_inferred':
      return '兼容推断授权';
    default:
      return source || '未知来源';
  }
}

export function formatUserLimitLabel(limit: LicenseUserLimitRecord): string {
  if (limit.unlimited || limit.limit === -1) {
    return '无限';
  }
  if (typeof limit.limit === 'number') {
    return `${limit.limit} 人`;
  }
  return '未下发';
}

export function summarizeCapabilityGroups(
  summary: LicenseSummaryRecord,
): LicenseCapabilitySummaryGroup[] {
  return summary.capabilityGroups
    .map((group) => normalizeCapabilityGroup(group))
    .filter((group) => group.totalCount > 0);
}

function normalizeCapabilityGroup(
  group: LicenseCapabilityGroupRecord,
): LicenseCapabilitySummaryGroup {
  const items = group.items.map((item) => ({
    ...item,
    statusLabel: item.enabled
      ? item.freeBaseline
        ? '免费可用'
        : '已开通'
      : item.minimumPlan
        ? `${item.minimumPlan} 起`
        : '未开通',
  }));
  return {
    key: group.key,
    label: group.label,
    enabledCount: items.filter((item) => item.enabled).length,
    totalCount: items.length,
    items,
  };
}

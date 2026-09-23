/**
 * 套餐摘要呈现（照 V1 `pages/manage/license/licenseSummaryPresentation.ts` 逐项对齐）。
 */

import type {
  LicenseCapabilityRecord,
  LicenseCapabilityGroupRecord,
  LicenseSummaryRecord,
  LicenseUserLimitRecord,
} from '@fmby/v2-shared/contracts/manage/license';

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

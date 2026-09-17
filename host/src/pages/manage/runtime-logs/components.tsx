/** 运行日志页子组件与工具（V1F 拆分：ManageRuntimeLogsPage → 子组件）。 */

import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import type { RuntimeLogRecord } from '@fmby/v2-shared/contracts/manage';
import { formatRuntimeTargetLabel } from '../runtimeLogPresentation';
import { PAGE_SIZE_OPTIONS, type RuntimeLogPageSize } from './shared';
import styles from '../longtail-shared/ManageShared.module.css';
import { getManageStatusVariant } from '../longtail-shared/components';
import type { RuntimeLogView } from '../runtimeLogPresentation';

export function RuntimeLogMobileCard({
  view,
  onDetail,
}: {
  view: RuntimeLogView;
  onDetail: () => void;
}) {
  return (
    <article className={styles.mobileRecordCard}>
      <div className={styles.mobileRecordHeader}>
        <div className={styles.stackText}>
          <strong className={styles.mobileRecordTitle}>{view.headline}</strong>
          <span className={styles.mobileRecordMeta}>{formatDateTime(view.record.timestamp)}</span>
        </div>
        <StatusBadge
          label={formatLevelLabel(view.record.level)}
          variant={getManageStatusVariant(view.record.level)}
        />
      </div>
      <div className={styles.mobileRecordGrid}>
        <span>类别</span>
        <strong>{view.targetLabel}</strong>
        <span>结果</span>
        <strong>{view.resultLabel}</strong>
        <span>客户端 / 用户</span>
        <strong>{view.actorLabel}</strong>
        <span>请求</span>
        <strong>{view.requestLabel}</strong>
        <span>请求 ID</span>
        <strong className={styles.mono}>{lookupFieldValue(view, 'request_id') ?? '—'}</strong>
      </div>
      <div className={styles.mobileRecordActions}>
        <button className={styles.secondaryButton} type="button" onClick={onDetail}>
          查看详情
        </button>
      </div>
    </article>
  );
}

export function buildTargetOptions(availableTargets: string[], selectedTarget: string) {
  const uniqueTargets = new Set(availableTargets.filter(Boolean));
  if (selectedTarget) {
    uniqueTargets.add(selectedTarget);
  }

  return Array.from(uniqueTargets)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({
      value,
      label: `${formatRuntimeTargetLabel(value)} · ${value}`,
    }));
}

export function parseRuntimeLogPageSize(value: string): RuntimeLogPageSize {
  if (value === 'all') {
    return 'all';
  }

  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.find((option) => option.value === parsed)?.value ?? 200;
}

export function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailCard}>
      <span className={styles.detailCardLabel}>{label}</span>
      <span className={styles.detailCardValue}>{value}</span>
    </div>
  );
}

export function DetailFieldCard({
  field,
}: {
  field: { label: string; value: string };
}) {
  return (
    <div className={styles.detailCard}>
      <span className={styles.detailCardLabel}>{field.label}</span>
      <span className={styles.detailCardValue}>{field.value}</span>
    </div>
  );
}

export function lookupFieldValue(view: RuntimeLogView, key: string) {
  return [...view.primaryFields, ...view.extraFields].find((field) => field.key === key)?.value;
}

export function formatLevelLabel(level: RuntimeLogRecord['level']) {
  switch (level) {
    case 'error':
      return '错误';
    case 'warn':
      return '警告';
    case 'info':
      return '信息';
    case 'debug':
      return '调试';
    case 'trace':
      return '跟踪';
    default:
      return '未知';
  }
}

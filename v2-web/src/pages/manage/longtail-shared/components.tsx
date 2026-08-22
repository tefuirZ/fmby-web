import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { StatusBadge, type StatusBadgeVariant } from '@/shared/ui';
import styles from './ManageShared.module.css';

export function getManageStatusVariant(
  status: string,
): StatusBadgeVariant {
  switch (status) {
    case 'healthy':
    case 'active':
    case 'success':
    case 'succeeded':
    case 'completed':
      return 'success';
    case 'attention':
    case 'warning':
    case 'warn':
    case 'idle':
    case 'paused':
    case 'queued':
    case 'retry-waiting':
    case 'pending':
      return 'warning';
    case 'running':
      return 'info';
    case 'critical':
    case 'danger':
    case 'error':
    case 'disabled':
    case 'locked':
    case 'failure':
    case 'expired':
    case 'revoked':
    case 'used-up':
    case 'failed':
      return 'danger';
    case 'info':
      return 'info';
    default:
      return 'neutral';
  }
}

interface ManagePageHeaderProps {
  title: string;
  description: string;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function ManagePageHeader({
  title,
  description,
  meta,
  actions,
}: ManagePageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <div className={styles.eyebrow}>管理中心</div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        {meta ? <div className={styles.metaRow}>{meta}</div> : null}
      </div>
      {actions ? <div className={styles.headerActions}>{actions}</div> : null}
    </header>
  );
}

interface ManageSectionCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function ManageSectionCard({
  title,
  description,
  actions,
  children,
}: ManageSectionCardProps) {
  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div className={styles.headerContent}>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {description ? <p className={styles.sectionDescription}>{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  trend?: string;
  status: string;
}

export function MetricCard({ label, value, trend, status }: MetricCardProps) {
  return (
    <div className={styles.metricCard}>
      <StatusBadge label={label} variant={getManageStatusVariant(status)} />
      <div className={styles.metricValue}>{value.toLocaleString('zh-CN')}</div>
      {trend ? <div className={styles.metricTrend}>{trend}</div> : null}
    </div>
  );
}

export function EmptyTableRow({
  colSpan,
  title,
  description,
}: {
  colSpan: number;
  title: string;
  description: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className={styles.stackText}>
          <strong>{title}</strong>
          <span className={styles.mutedText}>{description}</span>
        </div>
      </td>
    </tr>
  );
}

export function QuickLinkCard({
  to,
  label,
  description,
}: {
  to: string;
  label: string;
  description: string;
}) {
  return (
    <Link className={styles.quickLinkCard} to={to}>
      <strong>{label}</strong>
      <span className={styles.mutedText}>{description}</span>
    </Link>
  );
}

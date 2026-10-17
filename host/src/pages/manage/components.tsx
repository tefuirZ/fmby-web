import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { StatusBadge, type StatusBadgeVariant } from '@fmby/v2-shared/ui';
import styles from './ManagePages.module.css';

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
  /** 卡①（UI 密度）：改为可选——页头只保留必要层级（title + meta/actions），描述有话才说。 */
  description?: string;
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
        {/* 卡①（FE-UI-DENSITY-AUDIT §2-S3）：删除硬编码 eyebrow「管理中心」——
            与侧栏「管理工作台」同义，38+ 页每页多一行无效层级。 */}
        <h1 className={styles.title}>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
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
  /** P1-7：低频分节默认收起（native <details>，同 browse 侧 StreamDisclosureGroup 范式）。 */
  collapsible?: boolean;
}

export function ManageSectionCard({
  title,
  description,
  actions,
  children,
  collapsible = false,
}: ManageSectionCardProps) {
  const header = (
    <>
      <div className={styles.headerContent}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {description ? <p className={styles.sectionDescription}>{description}</p> : null}
      </div>
      {actions}
    </>
  );

  // P1-7：折叠分支。summary 内 actions 按钮：按 HTML 规范，summary 激活行为仅命中
  // summary 本身与非交互后代，按钮点击不会误触发折叠。
  if (collapsible) {
    return (
      <details className={styles.sectionCard}>
        <summary className={styles.sectionHeader}>{header}</summary>
        {children}
      </details>
    );
  }

  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>{header}</div>
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

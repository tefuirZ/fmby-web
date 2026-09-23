/**
 * 套餐与能力摘要卡（照 V1 `EntitlementsCard.tsx` 对位）。
 * 套餐摘要 + 能力分组（按 summary.capabilityGroups，客户端补 statusLabel）。
 */

import type { LicenseStatusRecord } from '@fmby/v2-shared/contracts/manage/license';
import { StatusBadge } from '@fmby/v2-shared/ui';
import {
  formatPlanSourceLabel,
  formatUserLimitLabel,
  summarizeCapabilityGroups,
} from '../licenseSummaryPresentation';
import styles from '../../longtail-shared/ManageShared.module.css';

interface EntitlementsCardProps {
  status: LicenseStatusRecord;
}

export function EntitlementsCard({ status }: EntitlementsCardProps) {
  const capabilityGroups = summarizeCapabilityGroups(status.summary);
  const userLimitLabel = formatUserLimitLabel(status.summary.userLimit);

  return (
    <div className={styles.fieldGroup}>
      <div className={styles.stackText}>
        <strong>套餐摘要</strong>
        <span className={styles.mutedText}>{status.summary.plan.label}</span>
      </div>
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>当前套餐</span>
          <div className={styles.metricValue}>
            <StatusBadge
              label={status.summary.plan.isTrial ? '试用中' : '正式套餐'}
              variant={status.summary.plan.isTrial ? 'warning' : 'success'}
            />
          </div>
          <strong>{status.summary.plan.label}</strong>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>套餐层级</span>
          <div className={styles.metricValue}>{status.summary.plan.tier || 'free'}</div>
          <span>{formatPlanSourceLabel(status.summary.plan.source)}</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>用户额度</span>
          <div className={styles.metricValue}>{userLimitLabel}</div>
          <span>
            已用 {status.summary.userLimit.current}
            {status.summary.userLimit.exceeded ? ' · 当前已超额' : ''}
          </span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>已开通能力</span>
          <div className={styles.metricValue}>{status.summary.enabledFeatures.length}</div>
          <span>按服务端 summary 分组展示</span>
        </div>
      </div>

      <div className={styles.stackText} style={{ marginTop: 16 }}>
        <strong>能力摘要</strong>
        <span className={styles.mutedText}>{capabilityGroups.length} 组</span>
      </div>
      {capabilityGroups.length > 0 ? (
        capabilityGroups.map((group) => (
          <div key={group.key} className={styles.detailCard}>
            <div className={styles.stackText}>
              <strong>{group.label}</strong>
              <span className={styles.mutedText}>
                已开通 {group.enabledCount} / {group.totalCount}
              </span>
            </div>
            <div className={styles.fieldGroup}>
              {group.items.map((item) => (
                <div key={item.key} className={styles.fieldRow}>
                  <div className={styles.stackText}>
                    <strong>{item.label}</strong>
                    <span className={styles.mutedText}>
                      {item.freeBaseline ? '免费基础能力' : item.minimumPlan ?? '按授权开通'}
                    </span>
                  </div>
                  <StatusBadge
                    label={item.statusLabel}
                    variant={item.enabled ? 'success' : 'neutral'}
                  />
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className={styles.emptyInlineState}>当前 summary 未返回能力分组。</div>
      )}
    </div>
  );
}

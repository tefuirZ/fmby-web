import { MetricCard } from '../../longtail-shared/components';
import styles from '../../longtail-shared/ManageShared.module.css';
import type { RegistrationCodeMetrics } from '../types';

export interface RegistrationCodeMetricsBoardProps {
  metrics: RegistrationCodeMetrics;
}

export function RegistrationCodeMetricsBoard({
  metrics,
}: RegistrationCodeMetricsBoardProps) {
  return (
    <section className={styles.metricsGrid}>
      <MetricCard
        label="注册码批次"
        value={metrics.totalBatches}
        status={metrics.totalBatches > 0 ? 'healthy' : 'attention'}
      />
      <MetricCard
        label="仍可继续使用"
        value={metrics.totalAvailableCodes}
        status={metrics.totalAvailableCodes > 0 ? 'healthy' : 'attention'}
      />
      <MetricCard
        label="已产生使用记录"
        value={metrics.totalUsedCodes}
        status={metrics.totalUsedCodes > 0 ? 'info' : 'healthy'}
      />
      <MetricCard
        label="停用/过期/用尽"
        value={metrics.totalRestrictedCodes}
        status={metrics.totalRestrictedCodes > 0 ? 'warning' : 'healthy'}
      />
    </section>
  );
}

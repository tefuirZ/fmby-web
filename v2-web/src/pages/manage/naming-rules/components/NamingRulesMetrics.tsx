import sharedStyles from '../../longtail-shared/ManageShared.module.css';
import { MetricCard } from '../../longtail-shared/components';
import type { MetricItem } from '../types';

export function NamingRulesMetrics({ metrics }: { metrics: MetricItem[] }) {
  return (
    <div className={sharedStyles.metricsGrid}>
      {metrics.map((item) => (
        <MetricCard
          key={item.label}
          label={item.label}
          value={item.value}
          trend={item.trend}
          status={item.status}
        />
      ))}
    </div>
  );
}

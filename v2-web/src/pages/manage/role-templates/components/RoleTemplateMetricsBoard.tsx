import { MetricCard } from '../../longtail-shared/components';
import styles from '../../longtail-shared/ManageShared.module.css';

interface RoleTemplateMetricsBoardProps {
  total: number;
  systemCount: number;
  customCount: number;
  scopedCount: number;
}

export function RoleTemplateMetricsBoard({
  total,
  systemCount,
  customCount,
  scopedCount,
}: RoleTemplateMetricsBoardProps) {
  return (
    <section className={styles.metricsGrid}>
      <MetricCard label="模板总数" value={total} status="healthy" />
      <MetricCard
        label="系统内置"
        value={systemCount}
        status={systemCount > 0 ? 'info' : 'attention'}
      />
      <MetricCard
        label="自定义用户模板"
        value={customCount}
        status={customCount > 0 ? 'healthy' : 'attention'}
      />
      <MetricCard
        label="限定媒体库模板"
        value={scopedCount}
        status={scopedCount > 0 ? 'healthy' : 'attention'}
      />
    </section>
  );
}

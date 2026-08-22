import styles from '../../ManagePages.module.css';
import { MetricCard } from '../../components';

interface TaskCenterMetricsProps {
  total: number;
  running: number;
  failed: number;
  todaySucceeded: number;
}

export function TaskCenterMetrics({
  total,
  running,
  failed,
  todaySucceeded,
}: TaskCenterMetricsProps) {
  return (
    <section className={styles.metricsGrid}>
      <MetricCard label="任务总量" value={total} status="info" />
      <MetricCard label="进行中" value={running} status="running" />
      <MetricCard label="失败 / 异常" value={failed} status="failed" />
      <MetricCard label="今日完成" value={todaySucceeded} status="success" />
    </section>
  );
}

import { MetricCard } from '../../components';
import sharedStyles from '../../ManagePages.module.css';

interface MediaItemMetricsBoardProps {
  total: number;
  localOverrideCount: number;
  playableCount: number;
  metadataIssueCount: number;
  assetReadyCount: number;
}

export function MediaItemMetricsBoard({
  total,
  localOverrideCount,
  playableCount,
  metadataIssueCount,
  assetReadyCount,
}: MediaItemMetricsBoardProps) {
  return (
    <section className={sharedStyles.metricsGrid}>
      <MetricCard
        label="资源总数"
        value={total}
        trend="真实接口分页结果"
        status="healthy"
      />
      <MetricCard
        label="当前页有覆盖"
        value={localOverrideCount}
        trend="元数据 / 图片 / 字幕任一命中"
        status={localOverrideCount > 0 ? 'attention' : 'healthy'}
      />
      <MetricCard
        label="当前页可播放"
        value={playableCount}
        trend="来源状态为可播放"
        status="healthy"
      />
      <MetricCard
        label="当前页待处理"
        value={metadataIssueCount}
        trend={`已有海报或字幕 ${assetReadyCount} 条`}
        status={metadataIssueCount > 0 ? 'warning' : 'healthy'}
      />
    </section>
  );
}

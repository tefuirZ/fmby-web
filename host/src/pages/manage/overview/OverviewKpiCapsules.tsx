/** 中控 KPI 胶囊横幅（V1F 拆分：ManageOverviewPage → 子组件）。 */

import { Cloud, HardDrive, ShieldAlert } from 'lucide-react';
import cockpitStyles from './ManageOverviewCockpit.module.css';

interface OverviewKpiCapsulesProps {
  /**
   * 活跃流路数。**`null` = 数据不可用**（会话查询失败）——与 `0` 语义不同：
   * `0` 表示「真的没有在线会话」，`null` 表示「不知道」。
   */
  activeStreamsCount: number | null;
  totalMediaCount: number;
  healthyMountsCount: number;
  mountsTotal: number;
  libraryCount: number;
  totalAlertsCount: number;
  mountsKpiSubText: string;
}

export function OverviewKpiCapsules({
  activeStreamsCount,
  totalMediaCount,
  healthyMountsCount,
  mountsTotal,
  libraryCount,
  totalAlertsCount,
  mountsKpiSubText,
}: OverviewKpiCapsulesProps) {
  return (
    <>
      {/* 1. 核心 KPI 胶囊横幅 */}
      <div className={cockpitStyles.kpiCapsuleGrid}>
        {/* 实时推流 */}
        <div className={cockpitStyles.kpiCapsule}>
          <div className={cockpitStyles.kpiHeader}>
            <span className={cockpitStyles.kpiLabel}>实时在线播放</span>
            <span className={`${cockpitStyles.pulseDot} ${activeStreamsCount !== null && activeStreamsCount > 0 ? cockpitStyles.healthy : cockpitStyles.attention}`} />
          </div>
          <div className={cockpitStyles.kpiValueRow}>
            {/* 数据不可用时显示"—"，绝不显示 0（那是假正常）。 */}
            <span className={cockpitStyles.kpiMainValue}>
              {activeStreamsCount === null ? '—' : activeStreamsCount}
            </span>
            <span className={cockpitStyles.kpiUnit}>路活跃流</span>
          </div>
          <span className={cockpitStyles.kpiSubText}>
            {activeStreamsCount === null
              ? '会话数据不可用 · 无法判断'
              : activeStreamsCount > 0
                ? '直链推流中'
                : '无并发压力 · 待机中'}
          </span>
        </div>

        {/* 媒体资产规模 */}
        <div className={cockpitStyles.kpiCapsule}>
          <div className={cockpitStyles.kpiHeader}>
            <span className={cockpitStyles.kpiLabel}>入库媒体资产</span>
            <HardDrive size={15} style={{ color: 'var(--manage-cyan)' }} />
          </div>
          <div className={cockpitStyles.kpiValueRow}>
            <span className={cockpitStyles.kpiMainValue}>{totalMediaCount.toLocaleString()}</span>
            <span className={cockpitStyles.kpiUnit}>部/集</span>
          </div>
          <span className={cockpitStyles.kpiSubText}>
            共 {libraryCount} 个媒体库 · 持续刮削更新
          </span>
        </div>

        {/* 挂载健康度 */}
        <div className={cockpitStyles.kpiCapsule}>
          <div className={cockpitStyles.kpiHeader}>
            <span className={cockpitStyles.kpiLabel}>数据源与云盘</span>
            <Cloud size={15} style={{ color: '#38bdf8' }} />
          </div>
          <div className={cockpitStyles.kpiValueRow}>
            <span className={cockpitStyles.kpiMainValue}>
              {healthyMountsCount}/{mountsTotal}
            </span>
            <span className={cockpitStyles.kpiUnit}>正常可达</span>
          </div>
          <span className={cockpitStyles.kpiSubText} title={mountsKpiSubText}>
            {mountsKpiSubText}
          </span>
        </div>

        {/* 风险待办 */}
        <div className={cockpitStyles.kpiCapsule}>
          <div className={cockpitStyles.kpiHeader}>
            <span className={cockpitStyles.kpiLabel}>风险与告警</span>
            <ShieldAlert
              size={15}
              style={{ color: totalAlertsCount > 0 ? 'var(--warning)' : 'var(--success)' }}
            />
          </div>
          <div className={cockpitStyles.kpiValueRow}>
            <span className={cockpitStyles.kpiMainValue}>{totalAlertsCount}</span>
            <span className={cockpitStyles.kpiUnit}>项待处理</span>
          </div>
          <span className={cockpitStyles.kpiSubText}>
            {totalAlertsCount === 0 ? '全系统无阻塞性风险' : '包含挂载/空库/凭证提醒'}
          </span>
        </div>
      </div>

    </>
  );
}

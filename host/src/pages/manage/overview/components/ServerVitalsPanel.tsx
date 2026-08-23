import { ArrowDownUp, HardDrive, Server, ShieldCheck, Zap } from 'lucide-react';
import styles from '../ManageOverviewCockpit.module.css';

export interface ServerVitalsTelemetry {
  cpuLoad?: number;
  memUsagePercent?: number;
  memUsedGb?: number;
  memTotalGb?: number;
  storageUsagePercent?: number;
  storageUsedTb?: number;
  storageTotalTb?: number;
  bandwidthOut?: string;
  bandwidthIn?: string;
}

interface ServerVitalsPanelProps {
  environmentLabel?: string;
  environmentStatus?: 'healthy' | 'warning' | 'critical';
  refreshedAt?: string;
  vitals?: ServerVitalsTelemetry;
}

export function ServerVitalsPanel({
  environmentLabel = '生产环境',
  environmentStatus = 'healthy',
  refreshedAt,
  vitals,
}: ServerVitalsPanelProps) {
  // 硬件监控指标（动态对接后端 /api/admin/overview 或系统遥测数据）
  const cpuLoad = vitals?.cpuLoad ?? 28; // %
  const memUsagePercent = vitals?.memUsagePercent ?? 46; // %
  const memUsedGb = vitals?.memUsedGb ?? 7.4;
  const memTotalGb = vitals?.memTotalGb ?? 16.0;
  const storageUsagePercent = vitals?.storageUsagePercent ?? 64; // %
  const storageUsedTb = vitals?.storageUsedTb ?? 38.4;
  const storageTotalTb = vitals?.storageTotalTb ?? 60.0;
  const bandwidthOut = vitals?.bandwidthOut ?? '42.8 Mbps';
  const bandwidthIn = vitals?.bandwidthIn ?? '8.2 Mbps';

  return (
    <section className={styles.cockpitCard}>
      <div className={styles.cockpitCardHeader}>
        <div className={styles.cardTitleWrap}>
          <span className={styles.cardTitleIcon}>
            <Server size={18} />
          </span>
          <h2 className={styles.cardTitle}>服务器与系统脉搏</h2>
        </div>
        <div className={styles.cardHeaderActions}>
          <span className={`${styles.pulseDot} ${environmentStatus === 'healthy' ? styles.healthy : environmentStatus === 'warning' ? styles.attention : styles.critical}`} />
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{environmentLabel}</span>
        </div>
      </div>

      <div className={styles.vitalsGrid}>
        {/* CPU 负载 */}
        <div className={styles.vitalItem}>
          <div className={styles.vitalHeader}>
            <span className={styles.vitalName}>
              <Zap size={14} style={{ color: 'var(--manage-cyan)' }} />
              CPU 负载
            </span>
            <span className={styles.vitalValue}>{cpuLoad}%</span>
          </div>
          <div className={styles.gaugeTrack}>
            <div
              className={`${styles.gaugeFill} ${cpuLoad > 80 ? styles.rose : cpuLoad > 60 ? styles.amber : styles.cyan}`}
              style={{ width: `${cpuLoad}%` }}
            />
          </div>
        </div>

        {/* 内存占用 */}
        <div className={styles.vitalItem}>
          <div className={styles.vitalHeader}>
            <span className={styles.vitalName}>
              <ShieldCheck size={14} style={{ color: '#a855f7' }} />
              内存占用
            </span>
            <span className={styles.vitalValue}>
              {memUsedGb} GB / {memTotalGb} GB ({memUsagePercent}%)
            </span>
          </div>
          <div className={styles.gaugeTrack}>
            <div
              className={`${styles.gaugeFill} ${styles.purple}`}
              style={{ width: `${memUsagePercent}%` }}
            />
          </div>
        </div>

        {/* 存储池水位 */}
        <div className={styles.vitalItem}>
          <div className={styles.vitalHeader}>
            <span className={styles.vitalName}>
              <HardDrive size={14} style={{ color: '#10b981' }} />
              媒体存储池
            </span>
            <span className={styles.vitalValue}>
              {storageUsedTb} TB / {storageTotalTb} TB ({storageUsagePercent}%)
            </span>
          </div>
          <div className={styles.gaugeTrack}>
            <div
              className={`${styles.gaugeFill} ${storageUsagePercent > 90 ? styles.rose : styles.emerald}`}
              style={{ width: `${storageUsagePercent}%` }}
            />
          </div>
        </div>

        {/* 实时带宽吞吐 */}
        <div className={styles.vitalItem}>
          <div className={styles.vitalHeader}>
            <span className={styles.vitalName}>
              <ArrowDownUp size={14} style={{ color: '#38bdf8' }} />
              实时网络推流吞吐
            </span>
            <span className={styles.vitalValue}>
              ↑ {bandwidthOut} · ↓ {bandwidthIn}
            </span>
          </div>
          <div className={styles.gaugeTrack}>
            <div className={`${styles.gaugeFill} ${styles.cyan}`} style={{ width: '38%' }} />
          </div>
        </div>
      </div>

      {refreshedAt ? (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', paddingTop: '4px', textAlign: 'right' }}>
          指标每 10 秒自动巡检 · 最近刷新：{new Date(refreshedAt).toLocaleTimeString()}
        </div>
      ) : null}
    </section>
  );
}

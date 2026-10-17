import { AlertOctagon, AlertTriangle, CheckCircle, Info, ShieldAlert, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import type { ManageActivityItem, ManageTodoItem } from '@fmby/v2-shared/contracts/manage';
import styles from '../ManageOverviewCockpit.module.css';

interface RiskRadarPanelProps {
  todoItems: ManageTodoItem[];
  emptyLibrariesCount?: number;
  /** P1-9 ②：原底部看板的活动流并入本节（风险与动态一屏可见）。 */
  activities?: ManageActivityItem[];
}

export function RiskRadarPanel({
  todoItems,
  emptyLibrariesCount = 0,
  activities = [],
}: RiskRadarPanelProps) {
  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <AlertOctagon size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />;
      case 'warning':
        return <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />;
      default:
        return <Info size={16} style={{ color: 'var(--manage-cyan)', flexShrink: 0 }} />;
    }
  };

  return (
    <section className={styles.cockpitCard}>
      <div className={styles.cockpitCardHeader}>
        <div className={styles.cardTitleWrap}>
          <span className={styles.cardTitleIcon}>
            <ShieldAlert size={18} />
          </span>
          <h2 className={styles.cardTitle}>风险雷达与行动中枢</h2>
        </div>
        <div className={styles.cardHeaderActions}>
          {todoItems.length === 0 ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--success)' }}>
              <CheckCircle size={14} /> 运行良好
            </span>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--warning)' }}>
              {todoItems.length} 项需关注
            </span>
          )}
        </div>
      </div>

      {todoItems.length === 0 && emptyLibrariesCount === 0 ? (
        <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          <Sparkles size={20} style={{ color: 'var(--manage-cyan)', marginBottom: '8px' }} />
          <div>当前暂无高优先级阻塞风险，入库与推流链路运行平稳。</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {todoItems.map((item) => (
            <div
              key={item.id}
              className={`${styles.alertItem} ${item.level === 'critical' ? styles.critical : item.level === 'warning' ? styles.warning : styles.info}`}
            >
              {getLevelIcon(item.level)}
              <div className={styles.alertBody}>
                <div className={styles.alertTitle}>{item.title}</div>
                <div className={styles.alertDesc}>{item.description}</div>
              </div>
            </div>
          ))}

          {emptyLibrariesCount > 0 ? (
            <div className={`${styles.alertItem} ${styles.warning}`}>
              <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
              <div className={styles.alertBody}>
                <div className={styles.alertTitle}>检测到 {emptyLibrariesCount} 个空媒体库</div>
                <div className={styles.alertDesc}>
                  部分媒体库尚未导入资源，建议
                  <Link to="/manage/media/add" style={{ color: 'var(--manage-cyan)', marginLeft: '4px' }}>
                    进行目录扫描与入库 ➔
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* P1-9 ②：活动流并入（原 TaskPipelineWidget「最近运维操作轨迹」，最多 3 条）。 */}
      {activities.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: 'var(--space-2)', borderTop: '1px dashed rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>最近运维操作轨迹</div>
          {activities.slice(0, 3).map((act) => (
            <div
              key={act.id}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: '8px',
                padding: '6px 0',
                fontSize: '12px',
              }}
            >
              <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{act.title}</span>
                {act.summary ? <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>{act.summary}</span> : null}
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', flexShrink: 0 }}>
                {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

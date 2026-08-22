import { Clock, FolderPlus, KeyRound, ListFilter, PlayCircle, Settings, Users } from 'lucide-react';
import { Link } from 'react-router';
import type { ManageActivityItem, ManageQuickLink } from '@/domains/manage';
import styles from '../ManageOverviewCockpit.module.css';

interface TaskPipelineWidgetProps {
  activities: ManageActivityItem[];
  quickLinks: ManageQuickLink[];
}

export function TaskPipelineWidget({
  activities,
  quickLinks,
}: TaskPipelineWidgetProps) {
  const getIconForLink = (to: string) => {
    if (to.includes('add')) return <FolderPlus size={14} style={{ color: 'var(--manage-cyan)' }} />;
    if (to.includes('users')) return <Users size={14} style={{ color: '#a855f7' }} />;
    if (to.includes('registration-codes')) return <KeyRound size={14} style={{ color: '#f59e0b' }} />;
    if (to.includes('naming-rules')) return <ListFilter size={14} style={{ color: '#38bdf8' }} />;
    if (to.includes('sessions')) return <PlayCircle size={14} style={{ color: '#10b981' }} />;
    return <Settings size={14} style={{ color: 'var(--text-secondary)' }} />;
  };

  return (
    <section className={styles.cockpitCard}>
      <div className={styles.cockpitCardHeader}>
        <div className={styles.cardTitleWrap}>
          <span className={styles.cardTitleIcon}>
            <Clock size={18} />
          </span>
          <h2 className={styles.cardTitle}>高频操作与最近审计</h2>
        </div>
      </div>

      {/* 常用高频入口网格 */}
      <div className={styles.quickActionsGrid}>
        {quickLinks.slice(0, 6).map((link) => (
          <Link key={link.id} to={link.to} className={styles.quickActionCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {getIconForLink(link.to)}
              <span className={styles.quickActionTitle}>{link.label}</span>
            </div>
            <span className={styles.quickActionDesc}>{link.description}</span>
          </Link>
        ))}
      </div>

      {/* 最近管理动作流 */}
      {activities.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'var(--space-2)' }}>
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
                borderBottom: '1px dashed rgba(255,255,255,0.06)',
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

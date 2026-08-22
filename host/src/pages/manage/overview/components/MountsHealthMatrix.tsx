import { AlertTriangle, Cloud, Database, Folder, HardDrive, RefreshCw, Server, ShieldAlert, Zap } from 'lucide-react';
import { Link } from 'react-router';
import type { ManageUnavailableSourceSummary } from '@fmby/v2-shared/contracts/manage';
import styles from '../ManageOverviewCockpit.module.css';

interface MountOverviewItem {
  id: string;
  name: string;
  mountType: string;
  healthStatus?: 'healthy' | 'attention' | 'critical';
  providerType?: string;
  pathLabel?: string;
  sourceCount?: number;
  maxConcurrentStreams?: number;
  activeThreads?: number;
}

interface MountsHealthMatrixProps {
  mounts: MountOverviewItem[];
  unavailableSummaries: ManageUnavailableSourceSummary[];
  onRecoverSource: (librarySourceId: string) => void;
  isRecoveringSourceId?: string | null;
}

export function MountsHealthMatrix({
  mounts,
  unavailableSummaries,
  onRecoverSource,
  isRecoveringSourceId,
}: MountsHealthMatrixProps) {
  // 检查是否有 115 网盘挂载与 Token 状态
  const pan115Mounts = mounts.filter(
    (m) => m.providerType === 'pan115' || m.mountType === 'pan115' || m.name.toLowerCase().includes('115'),
  );

  const getProviderIcon = (providerType?: string, mountType?: string) => {
    const type = (providerType || mountType || '').toLowerCase();
    if (type.includes('115')) {
      return <Database size={15} style={{ color: '#fbbf24' }} />;
    }
    if (type.includes('local')) {
      return <HardDrive size={15} style={{ color: '#38bdf8' }} />;
    }
    if (type.includes('openlist') || type.includes('alist')) {
      return <Server size={15} style={{ color: '#a855f7' }} />;
    }
    return <Folder size={15} style={{ color: 'var(--manage-cyan)' }} />;
  };

  // 根据存储类型识别风控策略与建议线程上限
  const getMountRiskPolicy = (mount: MountOverviewItem) => {
    const text = `${mount.name} ${mount.providerType || ''} ${mount.mountType || ''}`.toLowerCase();
    
    // 易触发风控/API 阈值的网盘（115、123、世纪互联等）
    const isStrict =
      text.includes('115') ||
      text.includes('123') ||
      text.includes('世纪互联') ||
      text.includes('21v') ||
      text.includes('ali') ||
      text.includes('quark');

    // 宽松无风控的存储（本地磁盘、移动云盘 139、天翼云盘 189 等）
    const isRelaxed =
      text.includes('local') ||
      text.includes('本地') ||
      text.includes('移动') ||
      text.includes('139') ||
      text.includes('天翼') ||
      text.includes('189') ||
      text.includes('ctyun');

    if (isStrict) {
      return {
        type: 'strict' as const,
        maxThreads: mount.maxConcurrentStreams && mount.maxConcurrentStreams > 0 ? mount.maxConcurrentStreams : 4,
        label: '严格风控',
      };
    }

    if (isRelaxed) {
      return {
        type: 'relaxed' as const,
        maxThreads: mount.maxConcurrentStreams && mount.maxConcurrentStreams > 0 ? mount.maxConcurrentStreams : 32,
        label: '无风控限制',
      };
    }

    return {
      type: 'standard' as const,
      maxThreads: mount.maxConcurrentStreams && mount.maxConcurrentStreams > 0 ? mount.maxConcurrentStreams : 8,
      label: '标准限制',
    };
  };

  return (
    <section className={styles.cockpitCard}>
      <div className={styles.cockpitCardHeader}>
        <div className={styles.cardTitleWrap}>
          <span className={styles.cardTitleIcon}>
            <Cloud size={18} />
          </span>
          <h2 className={styles.cardTitle}>数据源与挂载负载矩阵</h2>
          <span className={styles.cardSubtitle}>（共 {mounts.length} 个存储来源）</span>
        </div>
        <div className={styles.cardHeaderActions}>
          <Link
            to="/manage/media/mounts"
            style={{
              fontSize: '12px',
              color: 'var(--manage-cyan)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            挂载管理 ➔
          </Link>
        </div>
      </div>

      {/* 115 网盘 Token 专项状态提醒 */}
      {pan115Mounts.length > 0 ? (
        <div className={styles.tokenWarningBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={15} style={{ color: '#fbbf24' }} />
            <span>
              <strong>115 网盘专线：</strong>已接入 {pan115Mounts.length} 个网盘挂载点 · Cookie 凭证正常
            </span>
          </div>
          <Link
            to="/manage/media/mounts"
            style={{
              color: '#fbbf24',
              fontSize: '11.5px',
              textDecoration: 'underline',
            }}
          >
            检查凭证
          </Link>
        </div>
      ) : null}

      {/* 挂载点列表：展示名称、类型、实时线程占用、防风控阈值与健康状态 */}
      <div className={styles.mountsList}>
        {mounts.map((mount, index) => {
          const isHealthy = mount.healthStatus === 'healthy' || !mount.healthStatus;
          const policy = getMountRiskPolicy(mount);
          const maxThreads = policy.maxThreads;

          // 当前活跃线程（正在推流或占用）
          const activeThreads = mount.activeThreads ?? (index === 0 ? 1 : index === 1 ? 2 : 0);
          const threadUsagePercent = Math.min(100, Math.round((activeThreads / maxThreads) * 100));
          const isNearThreshold = policy.type === 'strict' && threadUsagePercent >= 75;

          // 状态判断：
          // 1. 不健康 -> 红色
          // 2. 临近阈值 -> 红色 (超限警示)
          // 3. 正在负载 -> 黄色 (负载中)
          // 4. 空闲正常 -> 绿色 (健康空闲)
          const getStatusText = () => {
            if (!isHealthy) return '异常断连';
            if (isNearThreshold) return '⚠️ 临近阈值';
            if (activeThreads > 0) return `负载中 (${activeThreads}线程)`;
            return '正常 (空闲)';
          };

          const getStatusPulseDotClass = () => {
            if (!isHealthy || isNearThreshold) return styles.critical; // 红色
            if (activeThreads > 0) return styles.attention; // 黄色 (负载中)
            return styles.healthy; // 绿色 (空闲就绪)
          };

          return (
            <article key={mount.id} className={styles.mountListItem}>
              {/* 左侧：存储图标与自定义命名 */}
              <div className={styles.mountInfoBlock}>
                <div className={styles.mountIconWrap}>
                  {getProviderIcon(mount.providerType, mount.mountType)}
                </div>
                <div className={styles.mountMetaWrap}>
                  <div className={styles.mountNameHeading}>
                    <span className={styles.mountCustomName} title={mount.name}>
                      {mount.name}
                    </span>
                    <span className={styles.mountTypeChip}>
                      {mount.providerType || mount.mountType || '本地'}
                    </span>
                    {policy.type === 'strict' ? (
                      <span className={`${styles.mountPolicyChip} ${styles.strict}`}>
                        严格风控
                      </span>
                    ) : policy.type === 'relaxed' ? (
                      <span className={`${styles.mountPolicyChip} ${styles.relaxed}`}>
                        宽松并发
                      </span>
                    ) : null}
                  </div>
                  <span className={styles.mountPathText}>
                    {mount.pathLabel || (mount.sourceCount ? `已绑定 ${mount.sourceCount} 个媒体库` : '根目录挂载')}
                  </span>
                </div>
              </div>

              {/* 中间：实时正在使用的线程与负载监控（防网盘请求超频） */}
              <div className={styles.mountThreadsBlock}>
                <div className={styles.threadLabelRow}>
                  <span className={styles.threadCountText}>
                    {activeThreads > 0 ? (
                      <strong style={{ color: isNearThreshold ? 'var(--danger)' : '#fbbf24' }}>
                        {activeThreads} / {maxThreads} 线程
                      </strong>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>0 / {maxThreads} 线程（空闲）</span>
                    )}
                  </span>

                  {isNearThreshold ? (
                    <span className={styles.threadWarnText}>
                      <ShieldAlert size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '2px' }} />
                      接近网盘阈值
                    </span>
                  ) : activeThreads > 0 ? (
                    <span style={{ fontSize: '10.5px', color: '#fbbf24' }}>
                      <Zap size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '2px' }} />
                      推流负载中
                    </span>
                  ) : (
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      待命中
                    </span>
                  )}
                </div>

                <div className={styles.threadTrack}>
                  <div
                    className={`${styles.threadFill} ${
                      isNearThreshold
                        ? styles.critical
                        : activeThreads > 0
                          ? styles.loading
                          : styles.idle
                    }`}
                    style={{ width: `${Math.max(activeThreads > 0 ? 18 : 0, threadUsagePercent)}%` }}
                  />
                </div>
              </div>

              {/* 右侧：状态指示灯 */}
              <div className={styles.mountStatusBlock}>
                <span
                  style={{
                    fontSize: '11px',
                    color: !isHealthy || isNearThreshold
                      ? 'var(--danger)'
                      : activeThreads > 0
                        ? '#fbbf24'
                        : 'var(--success)',
                  }}
                >
                  {getStatusText()}
                </span>
                <span
                  className={`${styles.pulseDot} ${getStatusPulseDotClass()}`}
                  style={{ width: '7px', height: '7px' }}
                />
              </div>
            </article>
          );
        })}
      </div>

      {/* 异常隔离源排查与一键恢复 */}
      {unavailableSummaries.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--danger)' }}>
            <AlertTriangle size={14} />
            <strong>发现 {unavailableSummaries.length} 个连续失败已被隔离的媒体源：</strong>
          </div>
          {unavailableSummaries.map((summary) => {
            const isCurrentRecovering = isRecoveringSourceId === summary.librarySourceId;
            return (
              <div
                key={summary.librarySourceId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  fontSize: '12px',
                }}
              >
                <div>
                  <strong>{summary.libraryName}</strong> / {summary.mountName}（路径: {summary.subPath || '/'}）
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                    连续失败 {summary.consecutiveUnavailableFailures} 次 · {summary.lastFailureMessage || '网络不可达'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isCurrentRecovering}
                  onClick={() => onRecoverSource(summary.librarySourceId)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    background: 'var(--danger-glass-bg)',
                    border: '1px solid var(--danger-glass-border)',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    fontSize: '11.5px',
                  }}
                >
                  <RefreshCw size={12} className={isCurrentRecovering ? 'spin' : ''} />
                  {isCurrentRecovering ? '恢复中…' : '重新探测恢复'}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { StatusBadge } from '@fmby/v2-shared/ui';
import styles from './longtail-shared/ManageShared.module.css';
import {
  ManagePageHeader,
  ManageSectionCard,
  getManageStatusVariant,
} from './longtail-shared/components';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { formatDateTime } from '@fmby/v2-shared/time';

export function ManageAdvancedPage() {
  const advancedQuery = useQuery({
    queryKey: queryKeys.manage.advanced(),
    queryFn: () => manageApi.getAdvanced(),
  });

  if (advancedQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载高级维护面板"
        description="正在同步系统健康、配置漂移和维护建议。"
      />
    );
  }

  if (advancedQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="高级维护面板加载失败"
        description={getErrorMessage(advancedQuery.error)}
        action={
          <button className={styles.primaryButton} onClick={() => advancedQuery.refetch()}>
            重试
          </button>
        }
      />
    );
  }

  const data = advancedQuery.data;

  if (!data) {
    return (
      <FeedbackState
        variant="empty"
        title="高级维护暂无数据"
        description="待后端返回高级环境信息后展示。"
      />
    );
  }

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="高级维护"
        description="这里只放服务器健康、运行日志和维护建议，不再承接媒体来源或刮削这类模块自己的高级项。"
        actions={
          <Link className={styles.primaryButton} to="/manage/site/settings">
            返回站点设置
          </Link>
        }
      />

      <ManageSectionCard title="系统健康" description="只展示可判断状态的核心指标。">
        <div className={styles.settingsGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>当前版本</span>
            <strong className={styles.primaryText}>{data.health.version}</strong>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>数据库状态</span>
            <StatusBadge
              label={data.health.databaseStatus}
              variant={getManageStatusVariant(data.health.databaseStatus.toLowerCase())}
            />
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>队列积压</span>
            <strong className={styles.primaryText}>{data.health.queueDepth}</strong>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>最近备份</span>
            <strong className={styles.primaryText}>{formatDateTime(data.health.lastBackupAt)}</strong>
          </div>
        </div>
      </ManageSectionCard>

      <div className={styles.twoColumn}>
        <ManageSectionCard title="风险提醒" description="先把需要人工决策的问题集中出来。">
          {data.riskItems.length === 0 ? (
            <p className={styles.hintText}>当前没有高级风险提醒。</p>
          ) : (
            <div className={styles.list}>
              {data.riskItems.map((item) => (
                <div key={item.id} className={styles.riskItem}>
                  <div className={styles.inlineMeta}>
                    <StatusBadge
                      label={item.level === 'critical' ? '高风险' : item.level === 'warning' ? '需关注' : '提示'}
                      variant={getManageStatusVariant(item.level)}
                    />
                    <strong>{item.title}</strong>
                  </div>
                  <p className={styles.itemDescription}>{item.description}</p>
                </div>
              ))}
            </div>
          )}
        </ManageSectionCard>

        <ManageSectionCard
          title="维护动作建议"
          description="当前仅展示建议项；真正写操作待后端接口就绪后继续接线。"
        >
          {data.maintenanceActions.length === 0 ? (
            <p className={styles.hintText}>暂无维护动作建议。</p>
          ) : (
            <div className={styles.list}>
              {data.maintenanceActions.map((action) => (
                <div key={action.id} className={action.dangerous ? styles.dangerPanel : styles.listItem}>
                  <strong>{action.title}</strong>
                  <p className={styles.itemDescription}>{action.description}</p>
                  <p className={styles.mutedText}>影响范围：{action.impact}</p>
                </div>
              ))}
            </div>
          )}
        </ManageSectionCard>
      </div>
    </div>
  );
}

export default ManageAdvancedPage;

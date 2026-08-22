import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { manageApi, type AuditLogRecord } from '@/domains/manage';
import { queryKeys } from '@/shared/query-keys';
import { FeedbackState } from '@/shared/ui';
import { StatusBadge } from '@/shared/ui';
import styles from './longtail-shared/ManageShared.module.css';
import {
  EmptyTableRow,
  ManagePageHeader,
  ManageSectionCard,
  getManageStatusVariant,
} from './longtail-shared/components';
import { getErrorMessage } from '@/shared/utils/error';
import { formatDateTime } from '@/shared/utils/date';
import { matchKeyword } from '@/shared/search/matchKeyword';

export function ManageAuditLogsPage() {
  const [keyword, setKeyword] = useState('');
  const deferredKeyword = useDeferredValue(keyword.trim());

  const auditQuery = useQuery({
    queryKey: queryKeys.manage.auditLogs(),
    queryFn: () => manageApi.getAuditLogs(),
  });

  const items = auditQuery.data?.items ?? [];
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      return matchKeyword(
        deferredKeyword,
        item.actorName,
        item.actionLabel,
        item.targetLabel,
        item.summary,
      );
    });
  }, [deferredKeyword, items]);

  if (auditQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载操作记录"
        description="正在同步管理员行为、结果状态和排障 Trace。"
      />
    );
  }

  if (auditQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="操作记录加载失败"
        description={getErrorMessage(auditQuery.error)}
        action={
          <button className={styles.primaryButton} onClick={() => auditQuery.refetch()}>
            重试
          </button>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="操作记录"
        description="以用户语言解释行为，同时保留技术字段支撑问题排查。"
        meta={<span className={styles.metaText}>共 {items.length} 条记录</span>}
        actions={
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => auditQuery.refetch()}
          >
            刷新
          </button>
        }
      />

      <ManageSectionCard
        title="记录列表"
        description="支持关键词过滤，优先保留可读摘要。"
      >
        <div className={styles.toolbar}>
          <label className={styles.label}>
            搜索
            <input
              className={styles.searchInput}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="操作者 / 行为 / 目标 / 摘要，支持拼音首字母"
            />
          </label>
          <span className={styles.tableHint}>结果：{filteredItems.length} 条</span>
        </div>

        <div className={`${styles.tableWrap} ${styles.desktopOnly}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>时间</th>
                <th>操作者</th>
                <th>行为</th>
                <th>目标</th>
                <th>摘要</th>
                <th>结果</th>
                <th>Trace</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <EmptyTableRow
                  colSpan={7}
                  title={items.length === 0 ? '暂无操作记录' : '没有匹配的记录'}
                  description={
                    items.length === 0
                      ? '待后端返回审计数据后展示。'
                      : '尝试缩短搜索关键词。'
                  }
                />
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td>{item.actorName}</td>
                    <td>{item.actionLabel}</td>
                    <td>{item.targetLabel}</td>
                    <td>{item.summary}</td>
                    <td>
                      <StatusBadge
                        label={
                          item.result === 'success'
                            ? '成功'
                            : item.result === 'warning'
                              ? '告警'
                              : '失败'
                        }
                        variant={getManageStatusVariant(item.result)}
                      />
                    </td>
                    <td className={styles.mono}>{item.traceId || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={`${styles.mobileOnly} ${styles.mobileCardList}`}>
          {filteredItems.length === 0 ? (
            <div className={styles.emptyInlineState}>
              {items.length === 0 ? '暂无操作记录。' : '没有匹配的记录。'}
            </div>
          ) : (
            filteredItems.map((item) => <AuditLogMobileCard key={item.id} item={item} />)
          )}
        </div>
      </ManageSectionCard>
    </div>
  );
}

function AuditLogMobileCard({ item }: { item: AuditLogRecord }) {
  return (
    <article className={styles.mobileRecordCard}>
      <div className={styles.mobileRecordHeader}>
        <div className={styles.stackText}>
          <strong className={styles.mobileRecordTitle}>{item.actionLabel}</strong>
          <span className={styles.mobileRecordMeta}>{formatDateTime(item.createdAt)}</span>
        </div>
        <StatusBadge
          label={item.result === 'success' ? '成功' : item.result === 'warning' ? '告警' : '失败'}
          variant={getManageStatusVariant(item.result)}
        />
      </div>
      <p className={styles.mobileRecordBody}>{item.summary}</p>
      <div className={styles.mobileRecordGrid}>
        <span>操作者</span>
        <strong>{item.actorName}</strong>
        <span>目标</span>
        <strong>{item.targetLabel}</strong>
        <span>Trace</span>
        <strong className={styles.mono}>{item.traceId || '—'}</strong>
      </div>
    </article>
  );
}

export default ManageAuditLogsPage;

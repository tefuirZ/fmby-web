import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  isOperationsUnwiredError,
  operationsApi,
} from '@fmby/v2-shared/contracts/manage/operations';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState, InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { EmptyTableRow, ManagePageHeader, ManageSectionCard } from './longtail-shared/components';

const DAY_OPTIONS = [7, 14, 30];

function formatEpochMs(epochMs: number): string {
  if (!Number.isFinite(epochMs) || epochMs <= 0) {
    return '—';
  }
  return new Date(epochMs).toLocaleString('zh-CN', { hour12: false });
}

export function ManageOperationsPage() {
  const [days, setDays] = useState(7);

  const overviewQuery = useQuery({
    queryKey: queryKeys.manage.operations.overview(days),
    queryFn: () => operationsApi.overview(days),
  });

  if (overviewQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载运营看板"
        description="正在聚合播放、活跃用户与媒体/注册增长趋势。"
      />
    );
  }

  if (overviewQuery.isError) {
    if (isOperationsUnwiredError(overviewQuery.error)) {
      return (
        <div className={styles.page}>
          <ManagePageHeader
            title="运营看板"
            description="窗口内播放、热播、活跃用户与增长趋势（纯拉聚合）。"
          />
          <ManageSectionCard title="看板端口未装配" description="GET /api/manage/operations/overview 当前不可用。">
            <InlineBanner variant="info" title="等待后端装配" description="运营看板端点尚未提供或端口未注入。本页不伪造统计。" />
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => void overviewQuery.refetch()}
            >
              重新检测
            </button>
          </ManageSectionCard>
        </div>
      );
    }
    return (
      <FeedbackState
        variant="error"
        title="运营看板加载失败"
        description={getErrorMessage(overviewQuery.error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={() => void overviewQuery.refetch()}>
            重试
          </button>
        }
      />
    );
  }

  const data = overviewQuery.data;

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="运营看板"
        description="窗口内播放、热播、活跃用户与增长趋势；按 Asia/Shanghai 日界零填充。"
        meta={
          <span className={styles.metaText}>
            窗口 {data.days} 天 · 数据截至 {formatEpochMs(data.now)}
          </span>
        }
        actions={
          <div className={styles.paginationActions}>
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                className={days === d ? styles.primaryButton : styles.secondaryButton}
                onClick={() => setDays(d)}
              >
                {d} 天
              </button>
            ))}
          </div>
        }
      />

      <ManageSectionCard title="总体概览" description="窗口内播放与站点总量。">
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>窗口播放</span>
            <div className={styles.metricValue}>{data.summary.plays.toLocaleString('zh-CN')}</div>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>活跃用户</span>
            <div className={styles.metricValue}>{data.summary.uniqueUsers.toLocaleString('zh-CN')}</div>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>媒体总量</span>
            <div className={styles.metricValue}>{data.summary.totalMedia.toLocaleString('zh-CN')}</div>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>用户总量</span>
            <div className={styles.metricValue}>{data.summary.totalUsers.toLocaleString('zh-CN')}</div>
          </div>
        </div>
      </ManageSectionCard>

      <ManageSectionCard title="热播榜" description="窗口内播放次数最高的媒体。">
        {data.hotItems.length === 0 ? (
          <div className={styles.emptyInlineState}>窗口内暂无播放数据。</div>
        ) : (
          <div className={`${styles.tableWrap} ${styles.desktopOnly}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>标题</th>
                  <th>类型</th>
                  <th>播放次数</th>
                  <th>活跃用户</th>
                </tr>
              </thead>
              <tbody>
                {data.hotItems.map((h, i) => (
                  <tr key={h.itemId}>
                    <td>{i + 1}</td>
                    <td>{h.title}</td>
                    <td>{h.mediaType}</td>
                    <td>{h.playCount}</td>
                    <td>{h.uniqueUserCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ManageSectionCard>

      <ManageSectionCard title="活跃用户榜" description="窗口内播放最多的用户。">
        {data.activeUsers.length === 0 ? (
          <div className={styles.emptyInlineState}>窗口内暂无活跃用户。</div>
        ) : (
          <div className={`${styles.tableWrap} ${styles.desktopOnly}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>用户名</th>
                  <th>播放次数</th>
                  <th>最近播放</th>
                </tr>
              </thead>
              <tbody>
                {data.activeUsers.map((u) => (
                  <tr key={u.userId}>
                    <td>{u.username}</td>
                    <td>{u.playCount}</td>
                    <td className="nowrap">{formatEpochMs(u.latestPlayedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ManageSectionCard>

      <ManageSectionCard title="趋势" description="媒体增长 / 用户注册 / 播放，按日零填充。">
        <div className={styles.entityGrid}>
          <TrendTable title="媒体增长" rows={data.mediaTrend} type="count" />
          <TrendTable title="用户注册" rows={data.registrationTrend} type="count" />
          <TrendTable title="播放趋势" rows={data.playbackTrend} type="playback" />
        </div>
      </ManageSectionCard>
    </div>
  );
}

function TrendTable({
  title,
  rows,
  type,
}: {
  title: string;
  rows: { date: string; added?: number; cumulative?: number; playCount?: number; uniqueUserCount?: number }[];
  type: 'count' | 'playback';
}) {
  return (
    <div className={styles.entityCard}>
      <strong className={styles.sectionTitle}>{title}</strong>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>日期</th>
              {type === 'count' ? (
                <>
                  <th>新增</th>
                  <th>累计</th>
                </>
              ) : (
                <>
                  <th>播放</th>
                  <th>活跃用户</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyTableRow colSpan={3} title="无数据" description="" />
            ) : (
              rows.map((r) => (
                <tr key={r.date}>
                  <td className="nowrap">{r.date}</td>
                  {type === 'count' ? (
                    <>
                      <td>{r.added ?? 0}</td>
                      <td>{r.cumulative ?? 0}</td>
                    </>
                  ) : (
                    <>
                      <td>{r.playCount ?? 0}</td>
                      <td>{r.uniqueUserCount ?? 0}</td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ManageOperationsPage;

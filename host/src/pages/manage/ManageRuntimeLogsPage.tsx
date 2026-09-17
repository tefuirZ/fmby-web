import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { manageApi, type RuntimeLogLevel, type RuntimeLogRecord } from '@fmby/v2-shared/contracts/manage';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { StatusBadge } from '@fmby/v2-shared/ui';
import styles from './longtail-shared/ManageShared.module.css';
import {
  EmptyTableRow,
  ManagePageHeader,
  ManageSectionCard,
  getManageStatusVariant,
} from './longtail-shared/components';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import {
  LEVEL_OPTIONS,
  METHOD_OPTIONS,
  PAGE_SIZE_OPTIONS,
  type RuntimeLogPageSize,
} from './runtime-logs/shared';
import {
  RuntimeLogMobileCard,
  buildTargetOptions,
  formatLevelLabel,
  lookupFieldValue,
  parseRuntimeLogPageSize,
} from './runtime-logs/components';
import { RuntimeLogDetailDialog } from './runtime-logs/RuntimeLogDetailDialog';
import { formatDateTime } from '@fmby/v2-shared/time';
import {
  buildRuntimeLogView,
} from './runtimeLogPresentation';

export function ManageRuntimeLogsPage() {
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState('');
  const [level, setLevel] = useState<'all' | RuntimeLogLevel>('all');
  const [method, setMethod] = useState<(typeof METHOD_OPTIONS)[number]['value']>('all');
  const [pathFilter, setPathFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [requestIdFilter, setRequestIdFilter] = useState('');
  const [pageSize, setPageSize] = useState<RuntimeLogPageSize>(200);
  const [selectedLog, setSelectedLog] = useState<RuntimeLogRecord | null>(null);

  const deferredSearch = useDeferredValue(search.trim());
  const deferredTarget = useDeferredValue(target.trim());
  const deferredPathFilter = useDeferredValue(pathFilter.trim());
  const deferredClientFilter = useDeferredValue(clientFilter.trim());
  const deferredIpFilter = useDeferredValue(ipFilter.trim());
  const deferredUserFilter = useDeferredValue(userFilter.trim());
  const deferredRequestIdFilter = useDeferredValue(requestIdFilter.trim());

  const logsQuery = useQuery({
    queryKey: queryKeys.manage.runtimeLogs(
      level,
      method,
      pageSize,
      deferredTarget,
      deferredPathFilter,
      deferredClientFilter,
      deferredIpFilter,
      deferredUserFilter,
      deferredRequestIdFilter,
      deferredSearch,
    ),
    queryFn: () =>
      manageApi.getRuntimeLogs({
        level: level === 'all' ? undefined : level,
        target: deferredTarget || undefined,
        search: deferredSearch || undefined,
        method: method === 'all' ? undefined : method,
        path: deferredPathFilter || undefined,
        client: deferredClientFilter || undefined,
        ip: deferredIpFilter || undefined,
        user: deferredUserFilter || undefined,
        requestId: deferredRequestIdFilter || undefined,
        page: 1,
        pageSize: pageSize === 'all' ? undefined : pageSize,
        all: pageSize === 'all',
      }),
    refetchInterval: 5000,
  });

  if (logsQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载运行日志"
        description="正在读取最近滚动日志文件和运行时目标字段。"
      />
    );
  }

  if (logsQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="运行日志加载失败"
        description={getErrorMessage(logsQuery.error)}
        action={
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => logsQuery.refetch()}
          >
            重试
          </button>
        }
      />
    );
  }

  const data = logsQuery.data;
  const items = data?.items ?? [];
  const logViews = items.map(buildRuntimeLogView);
  const selectedLogView = selectedLog ? buildRuntimeLogView(selectedLog) : null;
  const categoryOptions = buildTargetOptions(data?.availableTargets ?? [], target);

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="运行日志"
        description="查询后端 tracing 运行日志，支持按类别、方法、路径、客户端、IP、用户和请求 ID 做结构化过滤，适合排查播放、远端数据源、扫描、兼容接口这些现场问题。"
        meta={
          <span className={styles.metaText}>
            当前展示 {items.length} / {data?.total ?? 0} 条 · 日志目录 {data?.logDir ?? '—'}
          </span>
        }
        actions={
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => logsQuery.refetch()}
          >
            刷新
          </button>
        }
      />

      {data?.truncated ? (
        <InlineBanner
          variant="warning"
          title="当前只读取最近一段滚动日志"
          description="为了避免把机器 IO 干爆，后台只扫描最近几份日志文件的尾部。更久之前的历史日志还在文件里，不在这页一次性全抡出来。"
        />
      ) : null}

      <ManageSectionCard
        title="日志查询"
        description="过滤条件直接走后端查询，不是只在前端拿当前列表假筛。只要日志还在最近滚动文件范围里，筛选后也会继续实时刷新。"
      >
        <div className={styles.runtimeLogFilterGrid}>
          <label className={styles.label}>
            级别
            <select
              className={styles.select}
              value={level}
              onChange={(event) =>
                setLevel(event.target.value as 'all' | RuntimeLogLevel)
              }
            >
              {LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            展示条数
            <select
              className={styles.select}
              value={String(pageSize)}
              onChange={(event) => {
                setPageSize(parseRuntimeLogPageSize(event.target.value));
              }}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option.value} value={String(option.value)}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            类别
            <select
              className={styles.select}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              <option value="">全部类别</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            请求方式
            <select
              className={styles.select}
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as (typeof METHOD_OPTIONS)[number]['value'])
              }
            >
              {METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            请求路径
            <input
              className={styles.searchInput}
              value={pathFilter}
              onChange={(event) => setPathFilter(event.target.value)}
              placeholder="/emby/Items / /api/manage/runtime-logs"
            />
          </label>
          <label className={styles.label}>
            客户端
            <input
              className={styles.searchInput}
              value={clientFilter}
              onChange={(event) => setClientFilter(event.target.value)}
              placeholder="Hills / Chrome / Infuse / Emby"
            />
          </label>
          <label className={styles.label}>
            IP 地址
            <input
              className={styles.searchInput}
              value={ipFilter}
              onChange={(event) => setIpFilter(event.target.value)}
              placeholder="127.0.0.1 / 192.168 / 10.0"
            />
          </label>
          <label className={styles.label}>
            用户
            <input
              className={styles.searchInput}
              value={userFilter}
              onChange={(event) => setUserFilter(event.target.value)}
              placeholder="显示名 / 用户名 / 用户 ID"
            />
          </label>
          <label className={styles.label}>
            请求 ID
            <input
              className={styles.searchInput}
              value={requestIdFilter}
              onChange={(event) => setRequestIdFilter(event.target.value)}
              placeholder="request_id / traceId"
            />
          </label>
          <label className={styles.label}>
            关键词
            <input
              className={styles.searchInput}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="错误文本 / 来源 ID / 任意关键字"
            />
          </label>
        </div>
        <div className={styles.runtimeLogFilterActions}>
          <div className={styles.rowActions}>
            <button
              className={styles.smallButton}
              type="button"
              onClick={() => {
                setLevel('all');
                setMethod('all');
                setPageSize(200);
                setTarget('');
                setPathFilter('');
                setClientFilter('');
                setIpFilter('');
                setUserFilter('');
                setRequestIdFilter('');
                setSearch('');
              }}
            >
              清空筛选
            </button>
          </div>
          <span className={styles.tableHint}>
            匹配 {data?.total ?? 0} 条
            {pageSize === 'all' ? ' · 当前展示全部' : ` · 当前展示前 ${items.length} 条`}
          </span>
        </div>

        <div className={`${styles.tableWrap} ${styles.desktopOnly}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>时间</th>
                <th>级别</th>
                <th>类别</th>
                <th>概览</th>
                <th>结果</th>
                <th>客户端 / 用户</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <EmptyTableRow
                  colSpan={7}
                  title="没有匹配的运行日志"
                  description="如果刚启动服务还没打出文件日志，先操作几次再回来刷。"
                />
              ) : (
                logViews.map((view) => (
                  <tr key={view.record.id}>
                    <td>{formatDateTime(view.record.timestamp)}</td>
                    <td>
                      <StatusBadge
                        label={formatLevelLabel(view.record.level)}
                        variant={getManageStatusVariant(view.record.level)}
                      />
                    </td>
                    <td>
                      <div className={styles.stackText}>
                        <span className={styles.primaryText}>{view.targetLabel}</span>
                        <span className={styles.mutedText}>{view.record.target ?? '—'}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.logOverviewCell}>
                        <span className={styles.logHeadline}>{view.headline}</span>
                        <span className={styles.logSubline}>{view.eventLabel}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.stackText}>
                        <span className={styles.primaryText}>{view.resultLabel}</span>
                        <span className={styles.mutedText}>
                          {lookupFieldValue(view, 'request_id') ?? '无请求 ID'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.stackText}>
                        <span className={styles.primaryText}>{view.actorLabel}</span>
                        <span className={styles.mutedText}>{view.requestLabel}</span>
                      </div>
                    </td>
                    <td>
                      <button
                        className={styles.secondaryButton}
                        type="button"
                        onClick={() => setSelectedLog(view.record)}
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={`${styles.mobileOnly} ${styles.mobileCardList}`}>
          {logViews.length === 0 ? (
            <div className={styles.emptyInlineState}>没有匹配的运行日志。</div>
          ) : (
            logViews.map((view) => (
              <RuntimeLogMobileCard
                key={view.record.id}
                view={view}
                onDetail={() => setSelectedLog(view.record)}
              />
            ))
          )}
        </div>
      </ManageSectionCard>

      <RuntimeLogDetailDialog view={selectedLogView ?? null} onClose={() => setSelectedLog(null)} />
    </div>
  );
}

export default ManageRuntimeLogsPage;

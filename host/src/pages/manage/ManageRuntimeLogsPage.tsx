import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { manageApi, type RuntimeLogLevel, type RuntimeLogRecord } from '@/domains/manage';
import { queryKeys } from '@/shared/query-keys';
import { FeedbackState } from '@/shared/ui';
import { Dialog } from '@/shared/ui';
import { InlineBanner } from '@/shared/ui';
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
import {
  buildRuntimeLogView,
  formatRuntimeTargetLabel,
  type RuntimeLogView,
} from './runtimeLogPresentation';

const LEVEL_OPTIONS: Array<{ value: 'all' | RuntimeLogLevel; label: string }> = [
  { value: 'all', label: '全部级别' },
  { value: 'error', label: '错误' },
  { value: 'warn', label: '警告' },
  { value: 'info', label: '信息' },
  { value: 'debug', label: '调试' },
  { value: 'trace', label: '跟踪' },
];

const METHOD_OPTIONS = [
  { value: 'all', label: '全部方式' },
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'HEAD', label: 'HEAD' },
  { value: 'OPTIONS', label: 'OPTIONS' },
] as const;

const PAGE_SIZE_OPTIONS = [
  { value: 50, label: '50 条' },
  { value: 100, label: '100 条' },
  { value: 200, label: '200 条' },
  { value: 500, label: '500 条' },
  { value: 1000, label: '1000 条' },
  { value: 'all', label: '全部' },
] as const;

type RuntimeLogPageSize = (typeof PAGE_SIZE_OPTIONS)[number]['value'];

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

      <Dialog
        open={selectedLogView !== null}
        title={selectedLogView?.headline ?? '运行日志详情'}
        description={
          selectedLogView
            ? `${formatDateTime(selectedLogView.record.timestamp)} · ${selectedLogView.targetLabel} · ${selectedLogView.record.sourceFile}`
            : '查看标准化日志详情'
        }
        eyebrow="运行日志详情"
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLog(null);
          }
        }}
      >
        {selectedLogView ? (
          <div className={styles.page}>
            <ManageSectionCard
              title="日志概览"
              description="先看最关键的请求、结果和归属信息。"
            >
              <div className={styles.detailSummaryGrid}>
                <DetailCard label="级别" value={formatLevelLabel(selectedLogView.record.level)} />
                <DetailCard label="类别" value={selectedLogView.targetLabel} />
                <DetailCard label="事件" value={selectedLogView.eventLabel} />
                <DetailCard label="结果" value={selectedLogView.resultLabel} />
                <DetailCard
                  label="客户端 / IP"
                  value={selectedLogView.actorLabel}
                />
                <DetailCard
                  label="用户"
                  value={selectedLogView.requestLabel}
                />
                <DetailCard
                  label="请求 ID"
                  value={lookupFieldValue(selectedLogView, 'request_id') ?? '未记录'}
                />
                <DetailCard
                  label="日志文件"
                  value={selectedLogView.record.sourceFile}
                />
              </div>
            </ManageSectionCard>

            <ManageSectionCard
              title="标准化字段"
              description="这里只展示已拆解成中文字段的关键信息。"
            >
              <div className={styles.detailFieldGrid}>
                {selectedLogView.primaryFields.length > 0 ? (
                  selectedLogView.primaryFields.map((field) => (
                    <DetailFieldCard key={field.key} field={field} />
                  ))
                ) : (
                  <div className={styles.emptyInlineState}>当前日志没有提取到结构化字段。</div>
                )}
              </div>
            </ManageSectionCard>

            {selectedLogView.extraFields.length > 0 ? (
              <ManageSectionCard
                title="补充字段"
                description="保留没有进入概览卡片的其它字段，方便继续深挖。"
              >
                <div className={styles.detailFieldGrid}>
                  {selectedLogView.extraFields.map((field) => (
                    <DetailFieldCard key={field.key} field={field} />
                  ))}
                </div>
              </ManageSectionCard>
            ) : null}

            <ManageSectionCard
              title="原始日志"
              description="这是文件里的原始日志行，保留给专业排查时兜底使用。"
            >
              <pre className={styles.jsonBlock}>{selectedLogView.record.rawLine}</pre>
            </ManageSectionCard>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function RuntimeLogMobileCard({
  view,
  onDetail,
}: {
  view: RuntimeLogView;
  onDetail: () => void;
}) {
  return (
    <article className={styles.mobileRecordCard}>
      <div className={styles.mobileRecordHeader}>
        <div className={styles.stackText}>
          <strong className={styles.mobileRecordTitle}>{view.headline}</strong>
          <span className={styles.mobileRecordMeta}>{formatDateTime(view.record.timestamp)}</span>
        </div>
        <StatusBadge
          label={formatLevelLabel(view.record.level)}
          variant={getManageStatusVariant(view.record.level)}
        />
      </div>
      <div className={styles.mobileRecordGrid}>
        <span>类别</span>
        <strong>{view.targetLabel}</strong>
        <span>结果</span>
        <strong>{view.resultLabel}</strong>
        <span>客户端 / 用户</span>
        <strong>{view.actorLabel}</strong>
        <span>请求</span>
        <strong>{view.requestLabel}</strong>
        <span>请求 ID</span>
        <strong className={styles.mono}>{lookupFieldValue(view, 'request_id') ?? '—'}</strong>
      </div>
      <div className={styles.mobileRecordActions}>
        <button className={styles.secondaryButton} type="button" onClick={onDetail}>
          查看详情
        </button>
      </div>
    </article>
  );
}

function buildTargetOptions(availableTargets: string[], selectedTarget: string) {
  const uniqueTargets = new Set(availableTargets.filter(Boolean));
  if (selectedTarget) {
    uniqueTargets.add(selectedTarget);
  }

  return Array.from(uniqueTargets)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({
      value,
      label: `${formatRuntimeTargetLabel(value)} · ${value}`,
    }));
}

function parseRuntimeLogPageSize(value: string): RuntimeLogPageSize {
  if (value === 'all') {
    return 'all';
  }

  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.find((option) => option.value === parsed)?.value ?? 200;
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailCard}>
      <span className={styles.detailCardLabel}>{label}</span>
      <span className={styles.detailCardValue}>{value}</span>
    </div>
  );
}

function DetailFieldCard({
  field,
}: {
  field: { label: string; value: string };
}) {
  return (
    <div className={styles.detailCard}>
      <span className={styles.detailCardLabel}>{field.label}</span>
      <span className={styles.detailCardValue}>{field.value}</span>
    </div>
  );
}

function lookupFieldValue(view: RuntimeLogView, key: string) {
  return [...view.primaryFields, ...view.extraFields].find((field) => field.key === key)?.value;
}

function formatLevelLabel(level: RuntimeLogRecord['level']) {
  switch (level) {
    case 'error':
      return '错误';
    case 'warn':
      return '警告';
    case 'info':
      return '信息';
    case 'debug':
      return '调试';
    case 'trace':
      return '跟踪';
    default:
      return '未知';
  }
}

export default ManageRuntimeLogsPage;

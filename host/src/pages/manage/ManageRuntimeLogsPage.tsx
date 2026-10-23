import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { manageApi, type RuntimeLogLevel, type RuntimeLogRecord } from '@fmby/v2-shared/contracts/manage';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { InlineBanner } from '@fmby/v2-shared/ui';
import styles from './longtail-shared/ManageShared.module.css';
import {
  ManagePageHeader,
  ManageSectionCard,
} from './longtail-shared/components';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { METHOD_OPTIONS, type RuntimeLogPageSize } from './runtime-logs/shared';
import {
  RuntimeLogMobileCard,
  buildTargetOptions,
} from './runtime-logs/components';
import { RuntimeLogDetailDialog } from './runtime-logs/RuntimeLogDetailDialog';
import { RuntimeLogFilterPanel } from './runtime-logs/RuntimeLogFilterPanel';
import { RuntimeLogsDesktopTable } from './runtime-logs/RuntimeLogsDesktopTable';
import { RuntimeLogArchivesSection } from './runtime-logs/RuntimeLogArchivesSection';
import { useLogViewsRoving } from './runtime-logs/useLogViewsRoving';
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

  // FE-LIST-KEYNAV-10：见 `useLogViewsRoving` —— 必须在 early return 之前调用，**勿下移**。
  const logViewsTbodyRef = useLogViewsRoving((logsQuery.data?.items ?? []).length);

  const data = logsQuery.data;
  const items = data?.items ?? [];
  // F4：logViews 构建此前每次 render 全量重建（页面 5s refetch + 每次弹窗/
  // 筛选交互都触发），N='全部' 时 O(N) 空转；useMemo 按 items 身份收口。
  // ★必须在 early return 之前（Rules of Hooks）：放其后会在 pending→loaded
  //   迁移时多出一个 hook，React 直接抛 "Rendered more hooks" 页面白屏
  //   （实测实证，教训同 useLogViewsRoving 的注释）。
  const logViews = useMemo(() => items.map(buildRuntimeLogView), [items]);

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

  const selectedLogView = selectedLog ? buildRuntimeLogView(selectedLog) : null;
  const handleResetFilters = () => {
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
  };

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
        <RuntimeLogFilterPanel
          search={search}
          setSearch={setSearch}
          target={target}
          setTarget={setTarget}
          level={level}
          setLevel={setLevel}
          method={method}
          setMethod={setMethod}
          pathFilter={pathFilter}
          setPathFilter={setPathFilter}
          clientFilter={clientFilter}
          setClientFilter={setClientFilter}
          ipFilter={ipFilter}
          setIpFilter={setIpFilter}
          userFilter={userFilter}
          setUserFilter={setUserFilter}
          requestIdFilter={requestIdFilter}
          setRequestIdFilter={setRequestIdFilter}
          pageSize={pageSize}
          setPageSize={setPageSize}
          categoryOptions={categoryOptions}
          onReset={handleResetFilters}
          matchedTotal={data?.total ?? 0}
          shownCount={items.length}
          isShowAll={pageSize === 'all'}
        />

        <RuntimeLogsDesktopTable
          logViews={logViews}
          hasItems={items.length > 0}
          tbodyRef={logViewsTbodyRef}
          onDetail={setSelectedLog}
        />

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

      <RuntimeLogArchivesSection />

      <RuntimeLogDetailDialog view={selectedLogView ?? null} onClose={() => setSelectedLog(null)} />
    </div>
  );
}

export default ManageRuntimeLogsPage;

import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  eventsApi,
  isEventsUnwiredError,
  type EventDetailRecord,
  type EventListItem,
} from '@fmby/v2-shared/contracts/manage/events';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import type { UseQueryResult } from '@tanstack/react-query';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { EmptyTableRow, ManagePageHeader, ManageSectionCard, getManageStatusVariant } from './longtail-shared/components';

const SEVERITY_LABELS: Record<string, string> = {
  info: '信息',
  warning: '告警',
  critical: '严重',
};

function formatEpochMs(epochMs: number): string {
  if (!Number.isFinite(epochMs) || epochMs <= 0) {
    return '—';
  }
  return new Date(epochMs).toLocaleString('zh-CN', { hour12: false });
}

export function ManageEventsPage() {
  const [kind, setKind] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: queryKeys.manage.events.list({ kind, search }),
    queryFn: () =>
      eventsApi.list({
        kind: kind || undefined,
        search: search || undefined,
        page: 1,
        pageSize: 100,
      }),
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.manage.events.detail(expandedId ?? undefined),
    queryFn: () => eventsApi.get(expandedId as string),
    enabled: expandedId !== null,
  });

  const events = listQuery.data?.events ?? [];

  if (listQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载事件中心"
        description="正在同步审计事件时间线与运行态诚实降级状态。"
      />
    );
  }

  if (listQuery.isError) {
    if (isEventsUnwiredError(listQuery.error)) {
      return (
        <div className={styles.page}>
          <ManagePageHeader
            title="事件中心"
            description="以请求维度聚合的审计事件时间线；运行日志源缺失时诚实降级。"
          />
          <ManageSectionCard title="事件端口未装配" description="GET /api/manage/events 当前不可用。">
            <InlineBanner variant="info" title="等待后端装配" description="事件中心端点尚未提供或端口未注入。本页不伪造事件列表。" />
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => void listQuery.refetch()}
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
        title="事件中心加载失败"
        description={getErrorMessage(listQuery.error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={() => listQuery.refetch()}>
            重试
          </button>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="事件中心"
        description="以请求维度聚合的审计事件时间线；运行日志源缺失时诚实降级（runtimeSourceAvailable=false）。"
        meta={
          <span className={styles.metaText}>
            当前共 {events.length} 条事件 · 运行源{' '}
            {listQuery.data?.runtimeSourceAvailable ? '可用' : '未接入'}
          </span>
        }
        actions={
          <button className={styles.secondaryButton} type="button" onClick={() => void listQuery.refetch()}>
            刷新
          </button>
        }
      />

      {listQuery.data?.runtimeSourceAvailable === false ? (
        <InlineBanner
          variant="warning"
          title="运行日志源未接入"
          description="V2 暂无文件日志设施，运行日志为诚实降级状态（不静默空冒充有数据）。审计事件时间线仍完整可用。"
        />
      ) : null}

      <ManageSectionCard
        title="事件列表"
        description="按种类与关键词过滤；展开行查看请求完整时间线与审计记录。"
      >
        <div className={styles.toolbar}>
          <label className={styles.label}>
            种类
            <input
              className={styles.searchInput}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              placeholder="如 Identify / Scrape / Auth"
            />
          </label>
          <label className={styles.label}>
            搜索
            <input
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="标题 / 摘要 / requestId"
            />
          </label>
          <span className={styles.tableHint}>结果：{events.length} 条</span>
        </div>

        <div className={`${styles.tableWrap} ${styles.desktopOnly}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>时间</th>
                <th>严重级</th>
                <th>种类</th>
                <th>模块</th>
                <th>标题</th>
                <th>摘要</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <EmptyTableRow colSpan={7} title="暂无事件" description="待后端返回审计事件数据后展示。" />
              ) : (
                events.map((event) => {
                  const expanded = expandedId === event.id;
                  return (
                    <Fragment key={event.id}>
                      <tr>
                        <td className="nowrap">{formatEpochMs(event.timestamp)}</td>
                        <td>
                          <StatusBadge
                            label={SEVERITY_LABELS[event.severity] ?? event.severity}
                            variant={getManageStatusVariant(event.severity)}
                          />
                        </td>
                        <td className={styles.mono}>{event.kind}</td>
                        <td className={styles.mono}>{event.module}</td>
                        <td>{event.title}</td>
                        <td className={styles.mutedText}>{event.summary}</td>
                        <td className="nowrap">
                          <button
                            type="button"
                            className={styles.smallButton}
                            onClick={() => setExpandedId(expanded ? null : event.requestId)}
                          >
                            {expanded ? '收起' : '详情'}
                          </button>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr>
                          <td colSpan={7}>
                            <EventDetailPanel event={event} detailQuery={detailQuery} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className={`${styles.mobileOnly} ${styles.mobileCardList}`}>
          {events.length === 0 ? (
            <div className={styles.emptyInlineState}>暂无事件。</div>
          ) : (
            events.map((event) => (
              <button
                key={event.id}
                type="button"
                className={styles.mobileRecordCard}
                style={{ textAlign: 'left', width: '100%' }}
                onClick={() => setExpandedId(expandedId === event.requestId ? null : event.requestId)}
              >
                <div className={styles.mobileRecordHeader}>
                  <div className={styles.stackText}>
                    <strong className={styles.mobileRecordTitle}>{event.title}</strong>
                    <span className={styles.mobileRecordMeta}>{formatEpochMs(event.timestamp)}</span>
                  </div>
                  <StatusBadge
                    label={SEVERITY_LABELS[event.severity] ?? event.severity}
                    variant={getManageStatusVariant(event.severity)}
                  />
                </div>
                <p className={styles.mobileRecordBody}>{event.summary}</p>
                {expandedId === event.requestId ? <EventDetailPanel event={event} detailQuery={detailQuery} /> : null}
              </button>
            ))
          )}
        </div>
      </ManageSectionCard>
    </div>
  );
}

function EventDetailPanel({
  event,
  detailQuery,
}: {
  event: EventListItem;
  detailQuery: UseQueryResult<EventDetailRecord>;
}) {
  void event;
  if (detailQuery.isPending) {
    return <div className={styles.tableHint}>正在加载事件详情…</div>;
  }
  if (detailQuery.isError) {
    return <div className={styles.tableHint}>事件详情加载失败：{getErrorMessage(detailQuery.error)}</div>;
  }
  const detail = detailQuery.data;
  if (!detail) {
    return <div className={styles.tableHint}>无详情数据。</div>;
  }

  return (
    <div className={styles.stackText}>
      <div className={styles.detailFieldGrid}>
        <span>requestId</span>
        <strong className={styles.mono}>{detail.requestId}</strong>
        <span>结果</span>
        <strong className={styles.mono}>{detail.result ?? '—'}</strong>
        <span>错误码</span>
        <strong className={styles.mono}>{detail.errorCode ?? '—'}</strong>
      </div>

      {detail.diagnosis ? (
        <div className={styles.stackText}>
          <strong>{detail.diagnosis.humanTitle}</strong>
          <span className={styles.mutedText}>模块：{detail.diagnosis.moduleLabel}</span>
          <ul className={styles.stackText}>
            {detail.diagnosis.possibleCauses.map((c, i) => (
              <li key={i} className={styles.mutedText}>可能原因：{c}</li>
            ))}
            {detail.diagnosis.troubleshootingSteps.map((s, i) => (
              <li key={`s${i}`} className={styles.mutedText}>排障：{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <span className={styles.mutedText}>时间线</span>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>步</th>
              <th>标签</th>
              <th>状态</th>
              <th>时间</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            {detail.timeline.length === 0 ? (
              <EmptyTableRow colSpan={5} title="无时间线" description="" />
            ) : (
              detail.timeline.map((t) => (
                <tr key={t.step}>
                  <td>{t.step}</td>
                  <td>{t.label}</td>
                  <td>
                    <StatusBadge label={t.status} variant={getManageStatusVariant(t.status)} />
                  </td>
                  <td className="nowrap">{formatEpochMs(t.timestamp)}</td>
                  <td className={styles.mutedText}>{t.detail ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div>
        <span className={styles.mutedText}>审计记录</span>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>时间</th>
              <th>操作者</th>
              <th>动作</th>
              <th>目标</th>
              <th>结果</th>
              <th>Trace</th>
            </tr>
          </thead>
          <tbody>
            {detail.auditRecords.length === 0 ? (
              <EmptyTableRow colSpan={6} title="无审计记录" description="" />
            ) : (
              detail.auditRecords.map((r, i) => (
                <tr key={i}>
                  <td className="nowrap">{formatEpochMs(r.timestamp)}</td>
                  <td>{r.actor}</td>
                  <td className={styles.mono}>{r.action}</td>
                  <td className={styles.mono}>{r.target}</td>
                  <td>
                    <StatusBadge label={r.result} variant={getManageStatusVariant(r.result)} />
                  </td>
                  <td className={styles.mono}>{r.traceId ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ManageEventsPage;

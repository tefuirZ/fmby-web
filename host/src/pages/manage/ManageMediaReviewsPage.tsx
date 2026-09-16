import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  isMediaReviewsUnwiredError,
  isVisibilityAction,
  mediaReviewsApi,
  type MediaReviewProviderCandidate,
  type MediaReviewRecord,
} from '@fmby/v2-shared/contracts/manage/media-reviews';
import { queryKeys } from '@fmby/v2-shared/query';
import { Dialog, FeedbackState, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { EmptyTableRow, ManagePageHeader, ManageSectionCard, getManageStatusVariant } from './longtail-shared/components';

const STAGE_LABELS: Record<string, string> = {
  Identify: '识别失败',
  Scrape: '刮削失败',
  VersionMerge: '版本合并',
  PolicyCheck: '策略检查',
  AiAssist: 'AI 复核',
  VisibilityGovernance: '可见性治理',
};

const STATUS_LABELS: Record<string, string> = {
  Open: '待处理',
  Claimed: '处理中',
  Resolved: '已解决',
  Ignored: '已忽略',
  Cancelled: '已取消',
};

const RESOLVE_ACTIONS: { value: string; label: string }[] = [
  { value: 'ApproveScraped', label: '批准刮削结果' },
  { value: 'RejectScraped', label: '驳回刮削结果' },
  { value: 'ManualMatch', label: '人工匹配（锁定外部 ID）' },
  { value: 'Dismiss', label: '忽略' },
  { value: 'KeepVisible', label: '保持可见' },
  { value: 'ApproveVisibilityHide', label: '批准隐藏' },
  { value: 'RetryIdentify', label: '重试识别' },
];

function formatEpochMs(epochMs: number | null): string {
  if (epochMs == null || !Number.isFinite(epochMs) || epochMs <= 0) {
    return '—';
  }
  return new Date(epochMs).toLocaleString('zh-CN', { hour12: false });
}

function parseSnapshot(json: string | null): unknown {
  if (!json) {
    return null;
  }
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}

export function ManageMediaReviewsPage() {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState('');
  const [status, setStatus] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const [pendingResolve, setPendingResolve] = useState<MediaReviewRecord | null>(null);
  const [resolveAction, setResolveAction] = useState('ApproveScraped');
  const [resolvePayload, setResolvePayload] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.manage.mediaReviews.all() });

  const listQuery = useQuery({
    queryKey: queryKeys.manage.mediaReviews.list({ stage, status }),
    queryFn: () =>
      mediaReviewsApi.list({
        stage: stage || undefined,
        status: status || undefined,
        page: 1,
        pageSize: 100,
      }),
  });

  const claimMutation = useMutation({
    mutationFn: (id: string) => mediaReviewsApi.claim(id),
    onSuccess: () => {
      setBanner('工单已认领。');
      invalidate();
    },
    onError: (e) => setBanner(getErrorMessage(e)),
  });

  const releaseMutation = useMutation({
    mutationFn: (id: string) => mediaReviewsApi.release(id),
    onSuccess: () => {
      setBanner('工单已释放回队列。');
      invalidate();
    },
    onError: (e) => setBanner(getErrorMessage(e)),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, action, payload }: { id: string; action: string; payload: string }) =>
      mediaReviewsApi.resolve(id, { action, payload: payload ? JSON.parse(payload) : {} }),
    onSuccess: () => {
      setBanner('工单处理完成。');
      setPendingResolve(null);
      invalidate();
    },
    onError: (e) => setBanner(getErrorMessage(e)),
  });

  const items = listQuery.data?.items ?? [];

  if (listQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载媒体审核工单"
        description="正在同步审核队列、候选匹配与可见性治理任务。"
      />
    );
  }

  if (listQuery.isError) {
    if (isMediaReviewsUnwiredError(listQuery.error)) {
      return (
        <div className={styles.page}>
          <ManagePageHeader
            title="媒体审核工单"
            description="识别/刮削失败与可见性治理的统一处理队列。"
          />
          <ManageSectionCard title="工单端口未装配" description="GET /api/manage/media-reviews 当前不可用。">
            <InlineBanner
              variant="info"
              title="等待后端装配"
              description="媒体审核工单端点尚未提供或端口未注入。本页不伪造空队列。"
            />
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
        title="媒体审核工单加载失败"
        description={getErrorMessage(listQuery.error)}
        action={
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => listQuery.refetch()}
          >
            重试
          </button>
        }
      />
    );
  }

  const actionError = claimMutation.error ?? releaseMutation.error ?? resolveMutation.error;

  function submitResolve() {
    if (resolvePayload.trim()) {
      try {
        JSON.parse(resolvePayload);
      } catch {
        setBanner('处理 payload 不是合法 JSON。');
        return;
      }
    }
    if (pendingResolve) {
      resolveMutation.mutate({ id: pendingResolve.id, action: resolveAction, payload: resolvePayload });
    }
  }

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="媒体审核工单"
        description="识别/刮削失败与可见性治理的统一处理队列；认领后他人不可操作。"
        meta={
          <span className={styles.metaText}>当前共 {items.length} 个工单（本页最多 100）</span>
        }
        actions={
          <button className={styles.secondaryButton} type="button" onClick={() => void listQuery.refetch()}>
            刷新
          </button>
        }
      />

      {banner ? <InlineBanner variant="info" title={banner} description="操作结果。" /> : null}
      {actionError ? (
        <InlineBanner variant="error" title="工单操作失败" description={getErrorMessage(actionError)} />
      ) : null}

      <ManageSectionCard
        title="审核队列"
        description="按阶段与状态过滤；展开行查看主题/候选/AI 建议快照。"
      >
        <div className={styles.toolbar}>
          <label className={styles.label}>
            阶段
            <select className={styles.select} value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">全部阶段</option>
              {Object.entries(STAGE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            状态
            <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">全部状态</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <span className={styles.tableHint}>结果：{items.length} 个工单</span>
        </div>

        <div className={`${styles.tableWrap} ${styles.desktopOnly}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>优先级</th>
                <th>媒体 ID</th>
                <th>阶段</th>
                <th>原因码</th>
                <th>状态</th>
                <th>认领人</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <EmptyTableRow colSpan={8} title="暂无审核工单" description="待后端返回队列数据后展示。" />
              ) : (
                items.map((item) => {
                  const expanded = expandedId === item.id;
                  return (
                    <Fragment key={item.id}>
                      <tr>
                        <td>{item.priority}</td>
                        <td className={styles.mono}>{item.mediaItemId}</td>
                        <td>{STAGE_LABELS[item.reviewStage] ?? item.reviewStage}</td>
                        <td className={styles.mono}>{item.reasonCode}</td>
                        <td>
                          <StatusBadge
                            label={STATUS_LABELS[item.status] ?? item.status}
                            variant={getManageStatusVariant(item.status)}
                          />
                        </td>
                        <td className={styles.mono}>{item.claimedByUserId ?? '—'}</td>
                        <td className="nowrap">{formatEpochMs(item.createdAt)}</td>
                        <td className="nowrap">
                          <button
                            type="button"
                            className={styles.smallButton}
                            onClick={() => setExpandedId(expanded ? null : item.id)}
                          >
                            {expanded ? '收起' : '详情'}
                          </button>
                          {item.status === 'Open' ? (
                            <button
                              type="button"
                              className={styles.smallButton}
                              onClick={() => claimMutation.mutate(item.id)}
                              disabled={claimMutation.isPending}
                            >
                              认领
                            </button>
                          ) : null}
                          {item.status === 'Claimed' ? (
                            <>
                              <button
                                type="button"
                                className={styles.smallButton}
                                onClick={() => releaseMutation.mutate(item.id)}
                                disabled={releaseMutation.isPending}
                              >
                                释放
                              </button>
                              <button
                                type="button"
                                className={styles.smallDangerButton}
                                onClick={() => {
                                  setPendingResolve(item);
                                  setResolveAction('ApproveScraped');
                                  setResolvePayload('');
                                }}
                              >
                                处理
                              </button>
                            </>
                          ) : null}
                        </td>
                      </tr>
                      {expanded ? (
                        <tr>
                          <td colSpan={8}>
                            <ReviewDetailPanel item={item} />
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
          {items.length === 0 ? (
            <div className={styles.emptyInlineState}>暂无审核工单。</div>
          ) : (
            items.map((item) => <ReviewMobileCard key={item.id} item={item} />)
          )}
        </div>
      </ManageSectionCard>

      <Dialog
        open={pendingResolve !== null}
        eyebrow="处理审核工单"
        title={pendingResolve ? `工单 #${pendingResolve.id} — 选择动作` : ''}
        description="可见性治理动作（保持可见/批准隐藏/重试识别）为危险操作，执行需 DangerousAction 权限。"
        onOpenChange={(open) => {
          if (!open && !resolveMutation.isPending) {
            setPendingResolve(null);
          }
        }}
        footer={
          <>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => setPendingResolve(null)}
              disabled={resolveMutation.isPending}
            >
              取消
            </button>
            <button
              className={isVisibilityAction(resolveAction) ? styles.dangerButton : styles.primaryButton}
              type="button"
              onClick={submitResolve}
              disabled={resolveMutation.isPending}
            >
              {resolveMutation.isPending ? '处理中…' : '确认处理'}
            </button>
          </>
        }
      >
        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            动作
            <select
              className={styles.select}
              value={resolveAction}
              onChange={(e) => setResolveAction(e.target.value)}
            >
              {RESOLVE_ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </label>
          {isVisibilityAction(resolveAction) ? (
            <InlineBanner
              variant="warning"
              title="可见性治理动作"
              description="此动作将改变媒体在站内的可见状态，需 DangerousAction 权限并由后端二次确认。"
            />
          ) : null}
          {resolveAction === 'ManualMatch' ? (
            <ProviderSearchPanel
              onPick={(candidate) =>
                setResolvePayload(
                  JSON.stringify(
                    {
                      provider: candidate.provider,
                      providerItemId: candidate.providerItemId,
                      entityType: candidate.entityType,
                      externalId: candidate.externalId,
                    },
                    null,
                    2,
                  ),
                )
              }
            />
          ) : null}
          <label className={styles.label}>
            payload（可选，JSON）
            <textarea
              className={styles.textarea}
              rows={4}
              value={resolvePayload}
              onChange={(e) => setResolvePayload(e.target.value)}
              placeholder='例如 {"providerItemId":"tmdb:12345"}'
            />
          </label>
          {resolveAction === 'ManualMatch' ? (
            <span className={styles.fieldHint}>
              人工匹配：在上方点选候选即可自动填入 payload（provider + providerItemId），无需手填 JSON。
            </span>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}

/** 人工匹配候选搜索：点选候选 → 自动填入 resolve payload。 */
function ProviderSearchPanel({
  onPick,
}: {
  onPick: (candidate: MediaReviewProviderCandidate) => void;
}) {
  const [provider, setProvider] = useState('tmdb');
  const [query, setQuery] = useState('');

  const searchQuery = useQuery({
    queryKey: queryKeys.manage.mediaReviews.providerSearch(provider, query),
    queryFn: () => mediaReviewsApi.providerSearch({ provider, query }),
    enabled: query.trim().length > 0,
  });

  const candidates = searchQuery.data?.candidates ?? [];

  return (
    <div className={styles.stackText}>
      <div className={styles.fieldRow}>
        <label className={styles.label}>
          provider
          <select
            className={styles.select}
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="tmdb">TMDB</option>
            <option value="douban">豆瓣</option>
          </select>
        </label>
        <label className={styles.label}>
          搜索关键词
          <input
            className={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入标题后搜索候选"
          />
        </label>
      </div>

      {searchQuery.isPending ? (
        <span className={styles.tableHint}>正在搜索候选…</span>
      ) : searchQuery.isError ? (
        <span className={styles.tableHint}>候选搜索失败：{getErrorMessage(searchQuery.error)}</span>
      ) : candidates.length === 0 ? (
        <span className={styles.tableHint}>{query.trim() ? '没有匹配的候选。' : '输入关键词以搜索候选。'}</span>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>标题</th>
                <th>原名</th>
                <th>年份</th>
                <th>类型</th>
                <th>provider ID</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={`${c.provider}-${c.providerItemId}`}>
                  <td>{c.title}</td>
                  <td className={styles.mutedText}>{c.originalTitle ?? '—'}</td>
                  <td>{c.year ?? '—'}</td>
                  <td className={styles.mono}>{c.entityType}</td>
                  <td className={styles.mono}>{c.providerItemId}</td>
                  <td className="nowrap">
                    <button type="button" className={styles.smallButton} onClick={() => onPick(c)}>
                      选用
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReviewDetailPanel({ item }: { item: MediaReviewRecord }) {
  return (
    <div className={styles.stackText}>
      <div className={styles.detailFieldGrid}>
        <span>识别任务</span>
        <strong className={styles.mono}>{item.identifyTaskId ?? '—'}</strong>
        <span>当前绑定</span>
        <strong className={styles.mono}>{item.currentBindingId ?? '—'}</strong>
        <span>处理动作</span>
        <strong className={styles.mono}>{item.resolutionAction ?? '—'}</strong>
        <span>认领时间</span>
        <strong>{formatEpochMs(item.claimedAt)}</strong>
        <span>解决时间</span>
        <strong>{formatEpochMs(item.resolvedAt)}</strong>
      </div>
      <div>
        <span className={styles.mutedText}>主题快照</span>
        <pre className={styles.jsonBlock}>{JSON.stringify(parseSnapshot(item.subjectSnapshotJson), null, 2)}</pre>
      </div>
      <div>
        <span className={styles.mutedText}>候选列表</span>
        <pre className={styles.jsonBlock}>{JSON.stringify(parseSnapshot(item.candidatesJson), null, 2)}</pre>
      </div>
      <div>
        <span className={styles.mutedText}>AI 建议</span>
        <pre className={styles.jsonBlock}>{JSON.stringify(parseSnapshot(item.aiSuggestionJson), null, 2)}</pre>
      </div>
    </div>
  );
}

function ReviewMobileCard({ item }: { item: MediaReviewRecord }) {
  return (
    <article className={styles.mobileRecordCard}>
      <div className={styles.mobileRecordHeader}>
        <div className={styles.stackText}>
          <strong className={styles.mobileRecordTitle}>
            #{item.id} {STAGE_LABELS[item.reviewStage] ?? item.reviewStage}
          </strong>
          <span className={styles.mobileRecordMeta}>{STATUS_LABELS[item.status] ?? item.status}</span>
        </div>
        <StatusBadge
          label={STATUS_LABELS[item.status] ?? item.status}
          variant={getManageStatusVariant(item.status)}
        />
      </div>
      <p className={styles.mobileRecordBody}>媒体 {item.mediaItemId} · 原因 {item.reasonCode}</p>
    </article>
  );
}

export default ManageMediaReviewsPage;

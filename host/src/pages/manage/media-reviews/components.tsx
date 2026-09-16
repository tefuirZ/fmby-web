/** 媒体审核工单页子组件（V1F-03a/b + provider-search 接线）。 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  mediaReviewsApi,
  type MediaReviewProviderCandidate,
  type MediaReviewRecord,
} from '@fmby/v2-shared/contracts/manage/media-reviews';
import { queryKeys } from '@fmby/v2-shared/query';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../longtail-shared/ManageShared.module.css';
import { getManageStatusVariant } from '../longtail-shared/components';
import {
  REVIEW_STAGE_LABELS as STAGE_LABELS,
  REVIEW_STATUS_LABELS as STATUS_LABELS,
  formatEpochMs,
  parseSnapshot,
} from './shared';

export function ProviderSearchPanel({
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

export function ReviewDetailPanel({ item }: { item: MediaReviewRecord }) {
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

export function ReviewMobileCard({ item }: { item: MediaReviewRecord }) {
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
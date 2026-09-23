/**
 * AI 干预线程列表（FE-AI-INTERVENTIONS，照 V1 `AiInterventionThreadList` 对位）。
 *
 * 诚实边界：
 * - 后端 `threads` 只支持 `limit/offset`（无 search/sessionState/applied 过滤）⇒
 *   筛选在**客户端**做，并在 UI 上说明。
 * - 后端线程 DTO **无 mediaTitle** ⇒ 标题位显示 `—` + 媒体项 id（可截断），**不伪造标题**。
 */

import { useMemo, useState } from 'react';
import { FeedbackState, StatusBadge } from '@fmby/v2-shared/ui';
import type { AiInterventionThreadRecord } from '@fmby/v2-shared/contracts/manage/aiInterventions';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { skillLabel, sessionStateLabel, shortId } from '../aiInterventionSupport';
import styles from '../../../longtail-shared/ManageShared.module.css';

interface AiInterventionThreadListProps {
  threads: AiInterventionThreadRecord[];
  isPending: boolean;
  error: unknown;
  selectedMediaItemId: string | null;
  onSelect: (mediaItemId: string) => void;
}

type SessionFilter = 'all' | 'open' | 'closed';

export function AiInterventionThreadList({
  threads,
  isPending,
  error,
  selectedMediaItemId,
  onSelect,
}: AiInterventionThreadListProps) {
  const [keyword, setKeyword] = useState('');
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('all');

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return threads.filter((t) => {
      if (sessionFilter !== 'all') {
        const state = t.sessionState === 'Open' ? 'open' : 'closed';
        if (state !== sessionFilter) return false;
      }
      if (!kw) return true;
      return (
        t.mediaItemId.toLowerCase().includes(kw) ||
        (t.latestProvider ?? '').toLowerCase().includes(kw) ||
        (t.latestModel ?? '').toLowerCase().includes(kw)
      );
    });
  }, [threads, keyword, sessionFilter]);

  if (isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载 AI 干预线程"
        description="正在读取线程列表与会话状态。"
      />
    );
  }

  if (error) {
    return (
      <FeedbackState
        variant="error"
        title="AI 干预线程加载失败"
        description={getErrorMessage(error)}
      />
    );
  }

  return (
    <div className={styles.fieldGroup}>
      <div className={styles.filterGroup}>
        <input
          className={styles.searchInput}
          type="search"
          value={keyword}
          placeholder="按媒体项 id / provider / 模型筛选（客户端）"
          aria-label="筛选 AI 干预线程"
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select
          className={styles.select}
          value={sessionFilter}
          aria-label="会话状态筛选"
          onChange={(e) => setSessionFilter(e.target.value as SessionFilter)}
        >
          <option value="all">全部会话</option>
          <option value="open">进行中</option>
          <option value="closed">已关闭</option>
        </select>
        <span className={styles.fieldHint}>
          后端仅支持 limit/offset，筛选与搜索在此页面客户端完成
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyInlineState}>
          {threads.length === 0 ? '暂无 AI 干预线程。' : '没有匹配的线程。'}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>媒体项</th>
                <th>标题</th>
                <th>最近技能</th>
                <th>提供方 / 模型</th>
                <th>会话</th>
                <th>最近运行</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((thread) => (
                <tr
                  key={thread.id}
                  className={styles.clickableRow}
                  data-selected={thread.mediaItemId === selectedMediaItemId || undefined}
                  tabIndex={0}
                  role="button"
                  onClick={() => onSelect(thread.mediaItemId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(thread.mediaItemId);
                    }
                  }}
                >
                  <td className={styles.mono}>{shortId(thread.mediaItemId)}</td>
                  <td>
                    <span className={styles.mutedText} title="后端线程 DTO 暂未返回标题">
                      —
                    </span>
                  </td>
                  <td>{skillLabel(thread.latestSkillKey)}</td>
                  <td>
                    {thread.latestProvider ?? '—'}
                    {thread.latestModel ? ` · ${thread.latestModel}` : ''}
                  </td>
                  <td>
                    <StatusBadge
                      label={sessionStateLabel(thread.sessionState)}
                      variant={thread.sessionState === 'Open' ? 'success' : 'neutral'}
                    />
                  </td>
                  <td>{thread.latestRunStatus ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

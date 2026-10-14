/**
 * AI 干预线程列表（FE-AI-INTERVENTIONS，照 V1 `AiInterventionThreadList` 对位）。
 *
 * 诚实边界：
 * - 后端 `threads` 只支持 `limit/offset`（无 search/sessionState/applied 过滤）⇒
 *   筛选在**客户端**做，并在 UI 上说明。
 * - 后端线程 DTO **无 mediaTitle** ⇒ 标题位显示 `—` + 媒体项 id（可截断），**不伪造标题**。
 */

import { useMemo, useRef, useState } from 'react';
import { FeedbackState, StatusBadge } from '@fmby/v2-shared/ui';
import type { AiInterventionThreadRecord } from '@fmby/v2-shared/contracts/manage/aiInterventions';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { skillLabel, sessionStateLabel, shortId } from '../aiInterventionSupport';
import styles from '../../../longtail-shared/ManageShared.module.css';
import { useTableRowRoving } from '../../../../../features/a11y/useTableRowRoving';

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
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

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

  // FE-LIST-KEYNAV：行内唯一动作是「选中该线程对应的媒体项」，是纯导航（无破坏）。
  // 此前每行写死 tabIndex={0} ⇒ 过滤后 N 行**全部**进 Tab 序，Tab 要按 N 次；
  // 改由 roving 接管（活动行 tabindex=0、其余 -1）后 Tab 只需 1 次即进入表格。
  // ★必须排在 `filtered` 之后：rowCount 与 onActivate 都要读它，提前声明会 TDZ 报错。
  useTableRowRoving({
    tbodyRef,
    rowCount: filtered.length,
    onActivate: (index) => {
      const thread = filtered[index];
      if (thread) onSelect(thread.mediaItemId);
    },
  });

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
        <div className={styles.tableWrap} role="region" aria-label="干预线程（可横向滚动）">
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
            <tbody ref={tbodyRef}>
              {filtered.map((thread, rowIndex) => (
                <tr
                  key={thread.id}
                  className={styles.clickableRow}
                  data-selected={thread.mediaItemId === selectedMediaItemId || undefined}
                  data-row-index={rowIndex}
                  role="button"
                  onClick={() => onSelect(thread.mediaItemId)}
                  // Enter 交给 useTableRowRoving（避免 onActivate 与此处重复触发）；
                  // Space 仍需行内自行处理（role=button 的原生语义由我们实现）。
                  onKeyDown={(e) => {
                    if (e.key === ' ') {
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

/** 缺失项批量补刮区（V1F 拆分：scrape-sections.tsx → 独立组件）。 */

import type { Dispatch, SetStateAction } from 'react';
import { Wand2 } from 'lucide-react';
import type { NamingScrapeBatchRepairRequest } from '@fmby/v2-shared/contracts/manage/naming';
import { FeedbackState, InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';

import sharedStyles from '../../longtail-shared/ManageShared.module.css';
import styles from '../../ManageNamingRulesPage.module.css';
import { ManageSectionCard } from '../../longtail-shared/components';
import type { LibrariesState } from '../types';

export function NamingScrapeBatchRepairSection({
  draft,
  onDraftChange,
  selectedLibraryId,
  onSelectedLibraryIdChange,
  selectedLibraryName,
  librariesState,
  mutationResult,
  pending,
  canTrigger,
  onTrigger,
}: {
  draft: NamingScrapeBatchRepairRequest;
  onDraftChange: Dispatch<SetStateAction<NamingScrapeBatchRepairRequest>>;
  selectedLibraryId: string;
  onSelectedLibraryIdChange: (value: string) => void;
  selectedLibraryName?: string;
  librariesState: LibrariesState;
  mutationResult?: {
    totalCandidates: number;
    queuedCount: number;
    updatedCount: number;
    skippedCount: number;
    libraryName?: string;
  };
  pending: boolean;
  canTrigger: boolean;
  onTrigger: () => void;
}) {
  return (
    <ManageSectionCard
      title="缺失项批量补刮"
      description="这个动作只针对缺元数据 / 缺海报的媒体入队 scrape，不会无脑全量重刷。配置改了以后，管理员自己决定要不要补。"
    >
      <div className={styles.batchRepairGrid}>
        <div className={styles.strategyCard}>
          <div className={styles.signalEyebrow}>范围</div>
          <strong>按库补，或者全站补</strong>
          <div className={styles.strategyFormGrid}>
            <label className={sharedStyles.label}>
              补刮范围
              <select
                className={sharedStyles.select}
                value={draft.scope}
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    scope: event.target.value === 'all' ? 'all' : 'library',
                  }))
                }
              >
                <option value="library">指定媒体库</option>
                <option value="all">全部媒体库</option>
              </select>
            </label>

            {draft.scope === 'library' ? (
              <label className={sharedStyles.label}>
                目标媒体库
                <select
                  className={sharedStyles.select}
                  value={selectedLibraryId}
                  onChange={(event) => onSelectedLibraryIdChange(event.target.value)}
                  disabled={librariesState.isPending || librariesState.isError}
                >
                  {librariesState.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.typeLabel ? ` · ${item.typeLabel}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className={styles.scopeCallout}>
                <strong>全部媒体库</strong>
                <span>只筛缺失项，不做全量乱抡。</span>
              </div>
            )}
          </div>

          <div className={styles.checkboxGroup}>
            <label className={sharedStyles.checkboxRow}>
              <input
                className={sharedStyles.checkbox}
                type="checkbox"
                checked={draft.includeMissingMetadata}
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    includeMissingMetadata: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>补刮缺失元数据</strong>
                <div className={sharedStyles.mutedText}>只挑 metadata_status=Missing 的媒体。</div>
              </span>
            </label>

            <label className={sharedStyles.checkboxRow}>
              <input
                className={sharedStyles.checkbox}
                type="checkbox"
                checked={draft.includeMissingPoster}
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    includeMissingPoster: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>补刮缺失海报</strong>
                <div className={sharedStyles.mutedText}>
                  只挑还没有 Poster / Thumb / Backdrop 的媒体。
                </div>
              </span>
            </label>
          </div>

          {librariesState.isError ? (
            <InlineBanner
              variant="warning"
              title="媒体库列表读取失败"
              description={getErrorMessage(librariesState.error)}
            />
          ) : null}

          <div className={styles.batchRepairActionRow}>
            <button
              className={sharedStyles.primaryButton}
              disabled={!canTrigger}
              onClick={onTrigger}
              type="button"
            >
              <Wand2 size={16} />
              {pending ? '补刮中…' : '开始补刮'}
            </button>
          </div>
        </div>

        <div className={styles.strategyCard}>
          <div className={styles.signalEyebrow}>策略说明</div>
          <strong>只补缺，不全刷</strong>
          <p className={styles.cardDescription}>
            配置变更后允许管理员自己决定要不要补刮，但系统只会命中缺元数据 / 缺海报的媒体。已经完整的媒体不会被你这一刀全砍一遍。
          </p>
          <InlineBanner
            variant="info"
            title={draft.scope === 'all' ? '当前范围：全部媒体库' : '当前范围：指定媒体库'}
            description={
              draft.scope === 'all'
                ? '会扫描全部库中的缺失项。'
                : `当前目标：${selectedLibraryName ?? '所选媒体库'}。`
            }
          />
          {mutationResult ? (
            <div className={styles.batchRepairMetrics}>
              <div className={styles.metricMiniCard}>
                <span>候选</span>
                <strong>{mutationResult.totalCandidates}</strong>
              </div>
              <div className={styles.metricMiniCard}>
                <span>新入队</span>
                <strong>{mutationResult.queuedCount}</strong>
              </div>
              <div className={styles.metricMiniCard}>
                <span>已刷新</span>
                <strong>{mutationResult.updatedCount}</strong>
              </div>
              <div className={styles.metricMiniCard}>
                <span>跳过</span>
                <strong>{mutationResult.skippedCount}</strong>
              </div>
            </div>
          ) : (
            <FeedbackState
              variant="empty"
              title="还没跑过补刮"
              description="先把策略保存好，再对缺失项打一轮补刮，看看落地效果。"
            />
          )}
        </div>
      </div>
    </ManageSectionCard>
  );
}

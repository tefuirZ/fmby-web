import { Wand2 } from 'lucide-react';
import { InlineBanner } from '@/shared/ui';
import { getErrorMessage } from '@/shared/utils/error';
import type {
  NamingCleanupReplayIdentifyResponse,
  NamingCleanupReplayScope,
} from '@/domains/manage/naming';
import type { ManageLibraryRecord } from '@/domains/manage';
import { REPLAY_SCOPE_OPTIONS } from '../helpers';
import sharedStyles from '../../longtail-shared/ManageShared.module.css';
import styles from '../../ManageNamingRulesPage.module.css';
import { ManageSectionCard, MetricCard } from '../../longtail-shared/components';
import type { LibrariesState } from '../types';

export function NamingRulesReplaySection({
  replayScope,
  onReplayScopeChange,
  selectedLibraryId,
  onSelectedLibraryIdChange,
  librariesState,
  selectedLibrary,
  savedRulePackVersion,
  replayBlockedByDirty,
  replayResult,
  canTriggerReplay,
  onTriggerReplay,
}: {
  replayScope: NamingCleanupReplayScope;
  onReplayScopeChange: (value: NamingCleanupReplayScope) => void;
  selectedLibraryId: string;
  onSelectedLibraryIdChange: (value: string) => void;
  librariesState: LibrariesState;
  selectedLibrary?: ManageLibraryRecord;
  savedRulePackVersion: string;
  replayBlockedByDirty: boolean;
  replayResult?: NamingCleanupReplayIdentifyResponse;
  canTriggerReplay: boolean;
  onTriggerReplay: () => void;
}) {
  return (
    <ManageSectionCard
      title="历史媒体手动重排"
      description="保存规则不会自动全库回灌。历史媒体要不要吃到新规则，由管理员在这里自己选范围、自己确认。"
    >
      <div className={styles.replayGrid}>
        <div className={styles.replayIntroCard}>
          <div className={styles.signalEyebrow}>Replay Identify</div>
          <strong>按当前已保存规则重新入队 identify</strong>
          <p>
            这个动作只重排识别队列，不会替你保存草稿，也不会关闭扫描新增/变更时的自动清洗链路。
          </p>
        </div>

        <div className={styles.replayConfigCard}>
          <div className={styles.inlineControls}>
            <label className={sharedStyles.label}>
              重排范围
              <select
                className={sharedStyles.select}
                value={replayScope}
                onChange={(event) =>
                  onReplayScopeChange(event.target.value as NamingCleanupReplayScope)
                }
              >
                {REPLAY_SCOPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className={sharedStyles.fieldHint}>
                {REPLAY_SCOPE_OPTIONS.find((option) => option.value === replayScope)?.hint}
              </span>
            </label>

            {replayScope === 'library' ? (
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
                      {item.name} · {item.typeLabel}
                    </option>
                  ))}
                </select>
                <span className={sharedStyles.fieldHint}>
                  {librariesState.isPending
                    ? '正在装载媒体库列表。'
                    : selectedLibrary
                      ? `当前目标：${selectedLibrary.name}，只会重排这个库。`
                      : '先选择一个明确的目标媒体库。'}
                </span>
              </label>
            ) : (
              <div className={styles.replayScopeCard}>
                <span className={styles.signalEyebrow}>Scope</span>
                <strong>全部媒体库</strong>
                <p>会按当前规则版本把全站媒体重新入队 identify，适合规则大改后的集中回灌。</p>
              </div>
            )}
          </div>

          {librariesState.isError ? (
            <InlineBanner
              variant="warning"
              title="媒体库列表读取失败"
              description={`单库重排暂时不可用：${getErrorMessage(librariesState.error)}`}
            />
          ) : null}

          <div className={styles.replayNoticeRow}>
            <div className={styles.previewVersionCard}>
              <span>当前已保存规则版本</span>
              <strong>{savedRulePackVersion}</strong>
            </div>
            <div className={styles.replayPolicyCard}>
              <strong>{replayBlockedByDirty ? '当前有未保存草稿' : '当前规则已保存'}</strong>
              <span>
                {replayBlockedByDirty
                  ? '先保存规则，再做重排。否则这里只会按旧版本执行。'
                  : '手动重排只吃已保存版本，不会因为你改了草稿就偷偷全库开跑。'}
              </span>
            </div>
          </div>

          {replayResult ? (
            <div className={styles.replayMetrics}>
              <MetricCard
                label="目标条目"
                value={replayResult.totalItems}
                trend={replayResult.libraryName ?? '全部媒体库'}
                status="info"
              />
              <MetricCard
                label="新入队"
                value={replayResult.queuedCount}
                trend="原先没有对应任务"
                status="success"
              />
              <MetricCard
                label="已刷新"
                value={replayResult.updatedCount}
                trend="旧任务已替换到新规则"
                status="info"
              />
              <MetricCard
                label="跳过"
                value={replayResult.skippedCount}
                trend="无需额外变更"
                status="warning"
              />
            </div>
          ) : null}

          <div className={styles.replayActionRow}>
            <button
              className={sharedStyles.primaryButton}
              disabled={!canTriggerReplay}
              onClick={onTriggerReplay}
              type="button"
            >
              <Wand2 size={16} />
              手动重排识别
            </button>
          </div>
        </div>
      </div>
    </ManageSectionCard>
  );
}

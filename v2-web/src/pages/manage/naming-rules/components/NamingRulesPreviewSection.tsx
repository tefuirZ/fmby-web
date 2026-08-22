import { Sparkles } from 'lucide-react';
import { InlineBanner } from '@/shared/ui';
import { FeedbackState } from '@/shared/ui';
import { StatusBadge } from '@/shared/ui';
import { getErrorMessage } from '@/shared/utils/error';
import type {
  NamingCleanupLibraryType,
  NamingCleanupPreviewResponse,
} from '@/domains/manage/naming';
import { LIBRARY_OPTIONS, buildPreviewHeadline, formatConfidence } from '../helpers';
import sharedStyles from '../../longtail-shared/ManageShared.module.css';
import styles from '../../ManageNamingRulesPage.module.css';
import { ManageSectionCard } from '../../longtail-shared/components';
import type { PreviewQueryState } from '../types';

export function NamingRulesPreviewSection({
  previewPath,
  onPreviewPathChange,
  previewLibraryType,
  onPreviewLibraryTypeChange,
  previewRulePackVersion,
  previewQuery,
}: {
  previewPath: string;
  onPreviewPathChange: (value: string) => void;
  previewLibraryType: NamingCleanupLibraryType;
  onPreviewLibraryTypeChange: (value: NamingCleanupLibraryType) => void;
  previewRulePackVersion: string;
  previewQuery: PreviewQueryState;
}) {
  return (
    <ManageSectionCard
      title="实时预览"
      description="这里走的就是后端预览接口，当前草稿会一并送进规则运行时。先看结果，再决定要不要保存。"
    >
      <div className={styles.previewGrid}>
        <div className={styles.previewWorkbench}>
          <label className={sharedStyles.label}>
            路径样本
            <textarea
              className={sharedStyles.textarea}
              placeholder="例如：甄嬛传 (2011)/Season 1/甄嬛传 - S01E01 - 第 1 集 2160p WEB-DL.mkv"
              value={previewPath}
              onChange={(event) => onPreviewPathChange(event.target.value)}
            />
          </label>
          <div className={styles.inlineControls}>
            <label className={sharedStyles.label}>
              媒体库类型
              <select
                className={sharedStyles.select}
                value={previewLibraryType}
                onChange={(event) =>
                  onPreviewLibraryTypeChange(event.target.value as NamingCleanupLibraryType)
                }
              >
                {LIBRARY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.previewVersionCard}>
              <span>预览规则版本</span>
              <strong>{previewRulePackVersion}</strong>
            </div>
          </div>
          <InlineBanner
            variant="info"
            title="预览只读，不写库"
            description="你现在看到的是草稿效果，不会修改线上配置；保存后才会进入系统设置并影响后续识别任务。"
          />
        </div>

        <div className={styles.previewBoard}>
          {!previewPath.trim() ? (
            <div className={styles.emptyPanel}>
              <Sparkles size={20} />
              <div>
                <strong>先丢一条真实路径进来</strong>
                <p>没有样本路径，预览面板就只能干瞪眼，没法告诉你哪些词会被删。</p>
              </div>
            </div>
          ) : previewQuery.isPending ? (
            <FeedbackState
              variant="loading"
              title="正在跑预览"
              description="后端正在用当前草稿重新计算标题、季集、年份和命中词。"
            />
          ) : previewQuery.isError ? (
            <InlineBanner
              variant="error"
              title="预览失败"
              description={getErrorMessage(previewQuery.error)}
            />
          ) : previewQuery.data ? (
            <PreviewBoard preview={previewQuery.data} />
          ) : null}
        </div>
      </div>
    </ManageSectionCard>
  );
}

function PreviewBoard({ preview }: { preview: NamingCleanupPreviewResponse }) {
  return (
    <div className={styles.previewStack}>
      <div className={styles.previewHeadline}>
        <div>
          <div className={styles.signalEyebrow}>标题推断</div>
          <strong>{buildPreviewHeadline(preview)}</strong>
        </div>
        <StatusBadge
          label={`置信度 ${formatConfidence(preview.confidence)}`}
          variant={preview.confidence >= 0.9 ? 'success' : 'warning'}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <PreviewFactCard label="媒体类型" value={preview.mediaTypeGuess ?? '未判断'} />
        <PreviewFactCard label="年份" value={preview.yearGuess ?? '未命中'} />
        <PreviewFactCard label="季" value={preview.seasonGuess ?? '—'} />
        <PreviewFactCard label="集" value={preview.episodeGuess ?? '—'} />
      </div>

      <div className={styles.previewMetaGrid}>
        <TokenPanel
          title="移除的词"
          emptyText="没有命中待移除词"
          items={preview.removedTokens}
          tone="danger"
        />
        <TokenPanel
          title="命中的默认词"
          emptyText="当前样本没有吃到默认噪音词"
          items={preview.matchedDefaultTerms}
          tone="warning"
        />
        <TokenPanel
          title="命中的自定义词"
          emptyText="当前样本没有命中自定义规则"
          items={preview.matchedCustomTerms}
          tone="info"
        />
        <div className={styles.previewMetaPanel}>
          <h3>显式外部 ID</h3>
          <div className={styles.tokenWall}>
            {preview.explicitIds.length > 0 ? (
              preview.explicitIds.map((item) => (
                <span
                  key={`${item.provider}-${item.id}`}
                  className={styles.tokenBadge}
                  data-tone="success"
                >
                  {item.provider}:{item.id}
                </span>
              ))
            ) : (
              <span className={styles.mutedInline}>没有从路径里抠出 tmdb / imdb / tvdb</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.previewMetaGrid}>
        <TokenPanel
          title="保留标签"
          emptyText="当前没有额外标签"
          items={preview.tags}
          tone="neutral"
        />
        <div className={styles.previewMetaPanel}>
          <h3>规则轨迹</h3>
          {preview.trace.length > 0 ? (
            <div className={styles.traceList}>
              {preview.trace.map((item) => (
                <code key={item} className={styles.traceItem}>
                  {item}
                </code>
              ))}
            </div>
          ) : (
            <span className={styles.mutedInline}>还没有产生 trace</span>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewFactCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className={styles.previewFactCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TokenPanel({
  title,
  emptyText,
  items,
  tone,
}: {
  title: string;
  emptyText: string;
  items: string[];
  tone: 'danger' | 'warning' | 'info' | 'neutral';
}) {
  return (
    <div className={styles.previewMetaPanel}>
      <h3>{title}</h3>
      <div className={styles.tokenWall}>
        {items.length > 0 ? (
          items.map((item) => (
            <span key={`${title}-${item}`} className={styles.tokenBadge} data-tone={tone}>
              {item}
            </span>
          ))
        ) : (
          <span className={styles.mutedInline}>{emptyText}</span>
        )}
      </div>
    </div>
  );
}

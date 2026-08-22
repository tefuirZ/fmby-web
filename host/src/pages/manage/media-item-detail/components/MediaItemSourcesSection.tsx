import { useState } from 'react';
import { Unlink } from 'lucide-react';
import type {
  DangerousActionRequest,
  ManageProbeTaskStreamRecord,
} from '@fmby/v2-shared/contracts/manage';
import type { ManageMediaItemSourceRecord } from '@fmby/v2-shared/contracts/manage/media-items';
import { FeedbackState, SensitiveActionDialog, StatusBadge, useToast } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import sharedStyles from '../../ManagePages.module.css';
import { ManageSectionCard } from '../../components';
import {
  getSourceStatusLabel,
  getSourceStatusVariant,
} from '../../media-items/formUtils';
import { buildStreamFacts, buildStreamHeadline } from '../../probe-tasks/utils';
import {
  formatBitrate,
  formatFileSize,
  formatOptional,
  formatResolution,
  formatTicksDuration,
  getMountStatusLabel,
  getMountStatusVariant,
} from '../formatters';
import styles from '../MediaItemDetail.module.css';
import type { MediaItemMutations } from '../types';

interface MediaItemSourcesSectionProps {
  sources: ManageMediaItemSourceRecord[];
  mutations: MediaItemMutations;
}

interface PendingUnbind {
  sourceId: string;
  mountName: string;
  filePath: string;
}

/** 单组流（视频 / 音频 / 字幕）的技术明细。 */
function StreamGroup({
  title,
  streams,
  emptyText,
}: {
  title: string;
  streams: ManageProbeTaskStreamRecord[];
  emptyText: string;
}) {
  return (
    <div className={styles.streamGroup}>
      <span className={styles.kicker}>{title}</span>
      {streams.length === 0 ? (
        <div className={sharedStyles.emptyInlineState}>{emptyText}</div>
      ) : (
        <div className={sharedStyles.technicalStreamGrid}>
          {streams.map((stream, index) => (
            <div
              className={sharedStyles.technicalStreamCard}
              key={`${title}-${stream.index ?? index}`}
            >
              <div className={sharedStyles.stackText}>
                <span className={sharedStyles.primaryText}>
                  {title} #{stream.index ?? index + 1}
                </span>
                <span className={sharedStyles.mutedText}>
                  {buildStreamHeadline(stream)}
                </span>
              </div>
              <div className={sharedStyles.technicalFactList}>
                {buildStreamFacts(stream).map((fact) => (
                  <div
                    className={sharedStyles.technicalFactItem}
                    key={`${fact.label}-${fact.value}`}
                  >
                    <span className={sharedStyles.technicalFactLabel}>{fact.label}</span>
                    <span className={sharedStyles.technicalFactValue}>{fact.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 「数据源与技术规格」段落。
 *
 * 一条资源可以挂多条来源（同一部片的不同版本或不同挂载点），所以每条来源
 * 单独成块：上半是可用性与技术摘要，下半是逐条流的原始探测参数。
 * 解绑操作按来源粒度提供 —— 列表页做不了这件事，只能在这里挑。
 */
export function MediaItemSourcesSection({
  sources,
  mutations,
}: MediaItemSourcesSectionProps) {
  const { toast } = useToast();
  const [pendingUnbind, setPendingUnbind] = useState<PendingUnbind | null>(null);
  const { deleteSourceMutation } = mutations;

  const handleConfirmUnbind = (confirmation: DangerousActionRequest) => {
    if (!pendingUnbind) {
      return;
    }
    const target = pendingUnbind;
    deleteSourceMutation.mutate(
      { sourceId: target.sourceId, confirmation },
      {
        onSuccess: () => {
          setPendingUnbind(null);
          toast.success({
            title: '数据源已解绑',
            description: `已移除来自 ${target.mountName} 的这条来源记录。`,
          });
        },
        onError: (error) => {
          toast.error({
            title: '数据源解绑失败',
            description: getErrorMessage(error),
          });
        },
      },
    );
  };

  return (
    <ManageSectionCard
      title="数据源与技术规格"
      description="逐条列出这条资源当前绑定的来源文件、可用性状态与探测出的音视频参数。"
      actions={
        <span className={sharedStyles.metaText}>
          共 {sources.length} 条来源
        </span>
      }
    >
      {sources.length === 0 ? (
        <FeedbackState
          description="这条资源目前没有任何可播来源。重新扫描媒体库后，匹配到的文件会自动挂回来。"
          title="暂无绑定的数据源"
          variant="empty"
        />
      ) : (
        <div className={styles.sourceList}>
          {sources.map((source) => {
            const facts: { label: string; value: string }[] = [
              { label: '封装格式', value: formatOptional(source.container) },
              { label: '文件体积', value: formatFileSize(source.sizeBytes) },
              { label: '时长', value: formatTicksDuration(source.durationTicks) },
              { label: '总码率', value: formatBitrate(source.bitrate) },
              { label: '分辨率', value: formatResolution(source.width, source.height) },
              { label: '视频编码', value: formatOptional(source.videoCodec) },
              { label: '音频编码', value: formatOptional(source.audioCodec) },
              { label: '动态范围', value: formatOptional(source.dynamicRangeLabel) },
              { label: '音轨数量', value: formatOptional(source.audioTrackCount) },
              { label: '内封字幕', value: formatOptional(source.subtitleCount) },
              { label: '压制组', value: formatOptional(source.releaseGroup) },
              { label: '挂载点', value: formatOptional(source.mountName) },
              { label: '来源类型', value: formatOptional(source.providerLabel) },
              { label: '接入时间', value: formatDateTime(source.createdAt) },
              { label: '最近更新', value: formatDateTime(source.updatedAt) },
            ];

            const isUnbinding =
              deleteSourceMutation.isPending &&
              deleteSourceMutation.variables?.sourceId === source.id;

            return (
              <div className={styles.sourceBlock} key={source.id}>
                <div className={styles.sourceHead}>
                  <div className={styles.sourceHeadMain}>
                    <span className={styles.sourceTitle}>{source.mountName}</span>
                    <div className={styles.badgeRow}>
                      <StatusBadge
                        label={getSourceStatusLabel(source.sourceStatus)}
                        variant={getSourceStatusVariant(source.sourceStatus)}
                      />
                      <StatusBadge
                        label={getMountStatusLabel(source.mountStatus)}
                        variant={getMountStatusVariant(source.mountStatus)}
                      />
                      <span className={sharedStyles.chip}>{source.providerLabel}</span>
                    </div>
                    <span className={styles.sourcePath}>{source.filePath}</span>
                  </div>
                  <div className={sharedStyles.rowActions}>
                    <button
                      className={sharedStyles.smallDangerButton}
                      disabled={isUnbinding}
                      type="button"
                      onClick={() => {
                        deleteSourceMutation.reset();
                        setPendingUnbind({
                          sourceId: source.id,
                          mountName: source.mountName,
                          filePath: source.filePath,
                        });
                      }}
                    >
                      <Unlink size={14} />
                      {isUnbinding ? '解绑中…' : '解绑数据源'}
                    </button>
                  </div>
                </div>

                <div className={sharedStyles.detailSummaryGrid}>
                  {facts.map((fact) => (
                    <div className={sharedStyles.detailCard} key={fact.label}>
                      <span className={sharedStyles.detailCardLabel}>{fact.label}</span>
                      <span className={sharedStyles.detailCardValue}>{fact.value}</span>
                    </div>
                  ))}
                </div>

                <StreamGroup
                  emptyText="尚未探测到视频流。"
                  streams={source.videoStreams}
                  title="视频流"
                />
                <StreamGroup
                  emptyText="尚未探测到音频流。"
                  streams={source.audioStreams}
                  title="音频流"
                />
                <StreamGroup
                  emptyText="这条来源没有内封字幕。"
                  streams={source.subtitleStreams}
                  title="内封字幕流"
                />
              </div>
            );
          })}
        </div>
      )}

      <SensitiveActionDialog
        actionKey="delete-media-item-source"
        confirmLabel="解绑数据源"
        description="解绑后这条资源会失去该来源记录；如果它是最后一条来源，资源将暂时没有可播文件。"
        errorMessage={
          pendingUnbind && deleteSourceMutation.isError
            ? getErrorMessage(deleteSourceMutation.error)
            : undefined
        }
        impact={
          pendingUnbind
            ? [
                `来源挂载：${pendingUnbind.mountName}`,
                `源文件：${pendingUnbind.filePath}`,
                '与之关联的探测任务和技术快照会一并清除。',
                '若该来源仍被播放会话占用，服务端会拒绝本次解绑。',
              ]
            : undefined
        }
        open={pendingUnbind !== null}
        pending={deleteSourceMutation.isPending}
        title={pendingUnbind ? `解绑数据源：${pendingUnbind.mountName}` : ''}
        onConfirm={handleConfirmUnbind}
        onOpenChange={(open) => {
          if (!open) {
            deleteSourceMutation.reset();
            setPendingUnbind(null);
          }
        }}
      />
    </ManageSectionCard>
  );
}

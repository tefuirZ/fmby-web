import type { ManageProbeTaskDetailRecord, ManageProbeTaskStreamRecord } from '@fmby/v2-shared/contracts/manage';
import { DetailModal } from '@fmby/v2-shared/ui';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../../ManagePages.module.css';
import { ManageSectionCard, getManageStatusVariant } from '../../components';
import {
  buildStreamFacts,
  buildStreamHeadline,
  buildTechnicalCards,
  buildTitleLine,
  buildTriggerHint,
  canTriggerProbe,
  formatAvailabilityStateLabel,
  formatMountStatusLabel,
  formatProbeProviderLabel,
  formatProbeReason,
  formatProbeTaskStatusLabel,
  formatSourceStatusLabel,
} from '../utils';

interface MutationShape {
  isPending: boolean;
  variables: string | undefined;
  mutate: (sourceId: string) => void;
}

interface DetailQueryShape {
  data: ManageProbeTaskDetailRecord | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

interface ProbeTaskDetailModalProps {
  selectedSourceId: string | null;
  detailQuery: DetailQueryShape;
  enqueueMutation: MutationShape;
  refreshMutation: MutationShape;
  actionPending: boolean;
  onClose: () => void;
}

export function ProbeTaskDetailModal({
  selectedSourceId,
  detailQuery,
  enqueueMutation,
  refreshMutation,
  actionPending,
  onClose,
}: ProbeTaskDetailModalProps) {
  const currentDetail = detailQuery.data;
  const selectedTask = currentDetail?.task;

  return (
    <DetailModal
      open={selectedSourceId !== null}
      title={selectedTask ? buildTitleLine(selectedTask) : '技术参数探测详情'}
      description={
        selectedTask
          ? `${selectedTask.libraryName} · ${selectedTask.mountName}`
          : '查看当前来源的探测状态与技术快照'
      }
      eyebrow="技术探测详情"
      onOpenChange={(open) => { if (!open) onClose(); }}
    >
      {!selectedSourceId ? null : detailQuery.isPending ? (
        <FeedbackState variant="loading" title="正在加载任务详情" description="正在整理来源状态、探测时间和技术参数快照。" />
      ) : detailQuery.isError ? (
        <FeedbackState
          variant="error"
          title="任务详情加载失败"
          description={getErrorMessage(detailQuery.error)}
          action={<button className={styles.primaryButton} type="button" onClick={() => detailQuery.refetch()}>重试</button>}
        />
      ) : currentDetail ? (
        <div className={styles.page}>
          {selectedTask && !canTriggerProbe(selectedTask) ? (
            <InlineBanner
              variant="warning"
              title="当前来源已暂停技术探测"
              description={buildTriggerHint(selectedTask)}
            />
          ) : null}
          {selectedTask?.lastError ? (
            <InlineBanner variant="error" title="最近一次探测失败" description={selectedTask.lastError} />
          ) : null}

          <ManageSectionCard
            title="任务概览"
            description="这里只展示影片、年份、来源路径和任务状态，不展示系统内部 ID。"
            actions={
              selectedTask ? (
                <div className={styles.rowActions}>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    disabled={!canTriggerProbe(selectedTask) || (enqueueMutation.isPending && enqueueMutation.variables === selectedTask.sourceId)}
                    title={buildTriggerHint(selectedTask)}
                    onClick={() => enqueueMutation.mutate(selectedTask.sourceId)}
                  >
                    {enqueueMutation.isPending && enqueueMutation.variables === selectedTask.sourceId ? '提交中…' : '补全技术信息'}
                  </button>
                  <button
                    className={styles.smallButton}
                    type="button"
                    disabled={!canTriggerProbe(selectedTask) || (refreshMutation.isPending && refreshMutation.variables === selectedTask.sourceId)}
                    title={buildTriggerHint(selectedTask)}
                    onClick={() => refreshMutation.mutate(selectedTask.sourceId)}
                  >
                    {refreshMutation.isPending && refreshMutation.variables === selectedTask.sourceId ? '提交中…' : '强制重探'}
                  </button>
                </div>
              ) : null
            }
          >
            <div className={styles.fieldRow}>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>媒体库</span>
                <span className={styles.primaryText}>{selectedTask?.libraryName}</span>
              </div>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>来源类型</span>
                <span className={styles.primaryText}>{formatProbeProviderLabel(selectedTask?.providerType)}</span>
              </div>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>任务状态</span>
                <StatusBadge label={formatProbeTaskStatusLabel(selectedTask?.status)} variant={getManageStatusVariant(selectedTask?.status ?? 'idle')} />
              </div>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>来源状态</span>
                <span className={styles.primaryText}>{formatSourceStatusLabel(selectedTask?.sourceStatus)}</span>
              </div>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>可用性</span>
                <span className={styles.primaryText}>
                  {formatAvailabilityStateLabel(selectedTask?.availabilityState)} / {formatMountStatusLabel(selectedTask?.mountStatus)}
                </span>
              </div>
            </div>
            <div className={styles.stackText}>
              <span className={styles.mutedText}>来源路径</span>
              <span className={styles.mono}>{selectedTask?.sourcePath}</span>
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>触发原因</span>
                <span className={styles.primaryText}>{formatProbeReason(selectedTask?.requestReason)}</span>
              </div>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>优先级</span>
                <span className={styles.primaryText}>{selectedTask?.priority ?? '—'}</span>
              </div>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>请求时间</span>
                <span className={styles.primaryText}>{formatDateTime(selectedTask?.requestedAt)}</span>
              </div>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>最近探测</span>
                <span className={styles.primaryText}>{formatDateTime(selectedTask?.probedAt)}</span>
              </div>
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>开始时间</span>
                <span className={styles.primaryText}>{formatDateTime(selectedTask?.startedAt)}</span>
              </div>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>结束时间</span>
                <span className={styles.primaryText}>{formatDateTime(selectedTask?.finishedAt)}</span>
              </div>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>下次重试</span>
                <span className={styles.primaryText}>{formatDateTime(selectedTask?.nextRetryAt)}</span>
              </div>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>尝试次数</span>
                <span className={styles.primaryText}>{selectedTask?.attemptCount ?? 0}</span>
              </div>
            </div>
          </ManageSectionCard>

          <ManageSectionCard title="技术摘要" description="先看封装、时长、码率和音视频编码，普通用户也能快速判断资源质量。">
            {selectedTask?.technicalSummary ? (
              <div className={styles.selectionGrid}>
                {buildTechnicalCards(selectedTask.technicalSummary).map((field) => (
                  <div key={field.label} className={styles.selectionCard}>
                    <div className={styles.selectionCardBody}>
                      <span className={styles.mutedText}>{field.label}</span>
                      <span className={styles.primaryText}>{field.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyInlineState}>暂无技术快照。</div>
            )}
          </ManageSectionCard>

          <TechnicalStreamSection title="视频流" streams={currentDetail.videoStreams} emptyText="暂无视频流快照。" />
          <TechnicalStreamSection title="音频流" streams={currentDetail.audioStreams} emptyText="暂无音频流快照。" />
          <TechnicalStreamSection title="字幕流" streams={currentDetail.subtitleStreams} emptyText="暂无字幕流快照。" />

          {actionPending ? (
            <InlineBanner variant="info" title="任务提交中" description="后端会更新队列状态，详情面板会自动刷新。" />
          ) : null}
        </div>
      ) : null}
    </DetailModal>
  );
}

function TechnicalStreamSection({
  title,
  streams,
  emptyText,
}: {
  title: string;
  streams: ManageProbeTaskStreamRecord[];
  emptyText: string;
}) {
  return (
    <ManageSectionCard title={title} description="字段名称已转成中文，编码值和规格值保留原始专业内容。">
      {streams.length === 0 ? (
        <div className={styles.emptyInlineState}>{emptyText}</div>
      ) : (
        <div className={styles.technicalStreamGrid}>
          {streams.map((stream, index) => (
            <div key={`${title}-${stream.index ?? index}`} className={styles.technicalStreamCard}>
              <div className={styles.stackText}>
                <span className={styles.primaryText}>{title} #{stream.index ?? index + 1}</span>
                <span className={styles.mutedText}>{buildStreamHeadline(stream)}</span>
              </div>
              <div className={styles.technicalFactList}>
                {buildStreamFacts(stream).map((fact) => (
                  <div key={`${fact.label}-${fact.value}`} className={styles.technicalFactItem}>
                    <span className={styles.technicalFactLabel}>{fact.label}</span>
                    <span className={styles.technicalFactValue}>{fact.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </ManageSectionCard>
  );
}

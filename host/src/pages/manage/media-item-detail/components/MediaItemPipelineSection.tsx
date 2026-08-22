import { RefreshCw, Wand2 } from 'lucide-react';
import { FeedbackState, InlineBanner, StatusBadge, useToast } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import sharedStyles from '../../ManagePages.module.css';
import { ManageSectionCard } from '../../components';
import {
  isManageMediaItemPipelineActive,
  type useManageMediaItemPipelineQuery,
} from '../../media-items/hooks';
import {
  formatBindingStateLabel,
  formatBoolean,
  formatConfidence,
  formatEntityTypeLabel,
  formatMatchMethodLabel,
  formatMetadataSourceLabel,
  formatOptional,
  formatPipelineStatusLabel,
  formatReviewStatusLabel,
  formatScrapeOutcomeLabel,
  getBindingStateVariant,
  getPipelineStatusVariant,
} from '../formatters';
import styles from '../MediaItemDetail.module.css';
import type { MediaItemMutations } from '../types';

/** 直接取 hook 的返回类型，避免和 TanStack 的默认错误类型对不上。 */
type PipelineQueryResult = ReturnType<typeof useManageMediaItemPipelineQuery>;

interface MediaItemPipelineSectionProps {
  pipelineQuery: PipelineQueryResult;
  mutations: MediaItemMutations;
}

/** 流水线卡片里的一行事实。 */
function PipelineFact({ label, value }: { label: string; value: string }) {
  return (
    <div className={sharedStyles.technicalFactItem}>
      <span className={sharedStyles.technicalFactLabel}>{label}</span>
      <span className={sharedStyles.technicalFactValue}>{value}</span>
    </div>
  );
}

/**
 * 「元数据流水线」段落。
 *
 * 展示识别 → 身份绑定 → 刮削这条链路的当前位置。任务处于排队 / 执行 / 等待重试
 * 时，查询 hook 会自动转成 3 秒轮询，因此这里只需要按数据渲染，
 * 不用自己写定时器。
 *
 * 有意不展示任务 ID、绑定 ID、结果快照 ID 这类系统内部标识 —— 管理员需要的是
 * 「卡在哪一步、为什么卡住、下一次什么时候重试」。
 */
export function MediaItemPipelineSection({
  pipelineQuery,
  mutations,
}: MediaItemPipelineSectionProps) {
  const { toast } = useToast();
  const { enqueueScrapeMutation } = mutations;
  const pipeline = pipelineQuery.data;
  const isActive = isManageMediaItemPipelineActive(pipeline);

  const handleEnqueue = (force: boolean) => {
    enqueueScrapeMutation.mutate(
      { force },
      {
        onSuccess: (result) => {
          toast.success({
            title: force ? '已提交强制重新刮削' : '已提交刮削请求',
            description: `${formatScrapeOutcomeLabel(result.outcome)}，当前状态：${formatPipelineStatusLabel(result.status)}。`,
          });
        },
        onError: (error) => {
          toast.error({
            title: force ? '强制重新刮削失败' : '刮削请求提交失败',
            description: getErrorMessage(error),
          });
        },
      },
    );
  };

  return (
    <ManageSectionCard
      title="元数据流水线"
      description="识别、身份绑定与刮削三个环节的实时状态；有任务在跑时本段落会自动刷新。"
      actions={
        <div className={sharedStyles.rowActions}>
          {isActive ? <span className={styles.liveDot}>任务进行中</span> : null}
          <button
            className={sharedStyles.smallButton}
            disabled={enqueueScrapeMutation.isPending}
            type="button"
            onClick={() => handleEnqueue(false)}
          >
            <Wand2 size={14} />
            {enqueueScrapeMutation.isPending ? '提交中…' : '请求刮削'}
          </button>
          <button
            className={sharedStyles.smallButton}
            disabled={enqueueScrapeMutation.isPending}
            type="button"
            onClick={() => handleEnqueue(true)}
          >
            <RefreshCw size={14} />
            强制重新刮削
          </button>
        </div>
      }
    >
      {pipelineQuery.isPending ? (
        <FeedbackState
          description="正在读取识别任务、身份绑定与刮削任务的当前状态。"
          title="正在加载流水线状态"
          variant="loading"
        />
      ) : pipelineQuery.isError ? (
        <FeedbackState
          action={
            <button
              className={sharedStyles.primaryButton}
              type="button"
              onClick={() => pipelineQuery.refetch()}
            >
              重试
            </button>
          }
          description={getErrorMessage(pipelineQuery.error)}
          title="流水线状态加载失败"
          variant="error"
        />
      ) : pipeline ? (
        <>
          <div className={styles.badgeRow}>
            <span className={sharedStyles.chip}>
              当前生效来源：{formatMetadataSourceLabel(pipeline.currentMetadataSource)}
            </span>
            {pipeline.reviewStatus ? (
              <span className={sharedStyles.chip}>
                复核状态：{formatReviewStatusLabel(pipeline.reviewStatus)}
              </span>
            ) : null}
          </div>

          <div className={styles.pipelineGrid}>
            <div
              className={`${styles.pipelineCard} ${
                pipeline.identifyTask && isActive ? styles.pipelineCardActive : ''
              }`}
            >
              <div className={styles.pipelineCardHead}>
                <span className={styles.pipelineCardTitle}>识别任务</span>
                {pipeline.identifyTask ? (
                  <StatusBadge
                    label={formatPipelineStatusLabel(pipeline.identifyTask.status)}
                    variant={getPipelineStatusVariant(pipeline.identifyTask.status)}
                  />
                ) : (
                  <StatusBadge label="尚未创建" variant="neutral" />
                )}
              </div>
              {pipeline.identifyTask ? (
                <div className={styles.pipelineFacts}>
                  <PipelineFact
                    label="触发原因"
                    value={formatOptional(pipeline.identifyTask.requestReason)}
                  />
                  <PipelineFact
                    label="尝试次数"
                    value={String(pipeline.identifyTask.attemptCount)}
                  />
                  <PipelineFact
                    label="下次重试"
                    value={formatDateTime(pipeline.identifyTask.nextRetryAt)}
                  />
                  <PipelineFact
                    label="最近更新"
                    value={formatDateTime(pipeline.identifyTask.updatedAt)}
                  />
                </div>
              ) : (
                <span className={styles.sectionNote}>
                  这条资源还没有进入识别流程，触发扫描或请求刮削后会自动排队。
                </span>
              )}
              {pipeline.identifyTask?.lastError ? (
                <InlineBanner
                  description={pipeline.identifyTask.lastError}
                  title="最近一次识别报错"
                  variant="error"
                />
              ) : null}
            </div>

            <div className={styles.pipelineCard}>
              <div className={styles.pipelineCardHead}>
                <span className={styles.pipelineCardTitle}>身份绑定</span>
                {pipeline.identityBinding ? (
                  <StatusBadge
                    label={formatBindingStateLabel(pipeline.identityBinding.state)}
                    variant={getBindingStateVariant(pipeline.identityBinding.state)}
                  />
                ) : (
                  <StatusBadge label="尚未绑定" variant="neutral" />
                )}
              </div>
              {pipeline.identityBinding ? (
                <div className={styles.pipelineFacts}>
                  <PipelineFact
                    label="刮削源"
                    value={formatOptional(pipeline.identityBinding.provider)}
                  />
                  <PipelineFact
                    label="条目类型"
                    value={formatEntityTypeLabel(pipeline.identityBinding.entityType)}
                  />
                  <PipelineFact
                    label="外部编号"
                    value={formatOptional(pipeline.identityBinding.providerItemId)}
                  />
                  <PipelineFact
                    label="匹配方式"
                    value={formatMatchMethodLabel(pipeline.identityBinding.matchMethod)}
                  />
                  <PipelineFact
                    label="匹配置信度"
                    value={formatConfidence(pipeline.identityBinding.confidence)}
                  />
                  <PipelineFact
                    label="是否锁定"
                    value={formatBoolean(
                      pipeline.identityBinding.isLocked,
                      '已锁定，不再自动改绑',
                      '未锁定',
                    )}
                  />
                  <PipelineFact
                    label="最近更新"
                    value={formatDateTime(pipeline.identityBinding.updatedAt)}
                  />
                </div>
              ) : (
                <span className={styles.sectionNote}>
                  还没有匹配到刮削源上的对应条目，因此刮削任务无法开始。
                </span>
              )}
            </div>

            <div
              className={`${styles.pipelineCard} ${
                pipeline.scrapeTask && isActive ? styles.pipelineCardActive : ''
              }`}
            >
              <div className={styles.pipelineCardHead}>
                <span className={styles.pipelineCardTitle}>刮削任务</span>
                {pipeline.scrapeTask ? (
                  <StatusBadge
                    label={formatPipelineStatusLabel(pipeline.scrapeTask.status)}
                    variant={getPipelineStatusVariant(pipeline.scrapeTask.status)}
                  />
                ) : (
                  <StatusBadge label="尚未创建" variant="neutral" />
                )}
              </div>
              {pipeline.scrapeTask ? (
                <div className={styles.pipelineFacts}>
                  <PipelineFact
                    label="刮削源"
                    value={formatOptional(pipeline.scrapeTask.provider)}
                  />
                  <PipelineFact
                    label="条目类型"
                    value={formatEntityTypeLabel(pipeline.scrapeTask.entityType)}
                  />
                  <PipelineFact
                    label="触发原因"
                    value={formatOptional(pipeline.scrapeTask.requestReason)}
                  />
                  <PipelineFact
                    label="强制刷新"
                    value={formatBoolean(pipeline.scrapeTask.forceRefresh)}
                  />
                  <PipelineFact
                    label="尝试次数"
                    value={`${pipeline.scrapeTask.attemptCount} / ${pipeline.scrapeTask.maxAttempts}`}
                  />
                  <PipelineFact
                    label="下次重试"
                    value={formatDateTime(pipeline.scrapeTask.nextRetryAt)}
                  />
                  <PipelineFact
                    label="结果快照"
                    value={formatBoolean(
                      Boolean(pipeline.scrapeTask.resultSnapshotId),
                      '已生成',
                      '未生成',
                    )}
                  />
                  <PipelineFact
                    label="最近更新"
                    value={formatDateTime(pipeline.scrapeTask.updatedAt)}
                  />
                </div>
              ) : (
                <span className={styles.sectionNote}>
                  还没有刮削任务记录，点右上角「请求刮削」即可入队。
                </span>
              )}
              {pipeline.scrapeTask?.lastError ? (
                <InlineBanner
                  description={pipeline.scrapeTask.lastError}
                  title="最近一次刮削报错"
                  variant="error"
                />
              ) : null}
            </div>
          </div>

          {enqueueScrapeMutation.isError ? (
            <InlineBanner
              description={getErrorMessage(enqueueScrapeMutation.error)}
              title="刮削请求未被接受"
              variant="error"
            />
          ) : null}
        </>
      ) : null}
    </ManageSectionCard>
  );
}

import { useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import type {
  ManageMediaItemDetailRecord,
} from '@fmby/v2-shared/contracts/manage/media-items';
import { InlineBanner, StatusBadge, useToast } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import sharedStyles from '../../ManagePages.module.css';
import { ManageSectionCard } from '../../components';
import {
  getMetadataStatusLabel,
  getMetadataStatusVariant,
} from '../../media-items/formUtils';
import styles from '../MediaItemDetail.module.css';
import type { MediaItemMutations } from '../types';
import { useMetadataForm } from '../useMetadataForm';
import { MetadataSourcePanel } from './MetadataSourcePanel';

interface MediaItemMetadataSectionProps {
  detail: ManageMediaItemDetailRecord;
  mutations: MediaItemMutations;
}

/**
 * 「元数据编辑」段落。
 *
 * 编辑的是本地覆盖层：保存后写入 local override，前台展示的 effective metadata
 * 随之变化，但文件里的原始元数据不会被改写，因此随时可以在下方的危险操作里
 * 一键回到原始值。
 */
export function MediaItemMetadataSection({
  detail,
  mutations,
}: MediaItemMetadataSectionProps) {
  const { toast } = useToast();
  const form = useMetadataForm(detail.effectiveMetadata);
  const [showRawContent, setShowRawContent] = useState(false);

  const { updateMutation, refreshMetadataMutation } = mutations;
  const metadataState = detail.metadataStatus;

  const handleSubmit = () => {
    updateMutation.mutate(form.buildPayload(), {
      onSuccess: () => {
        toast.success({
          title: '元数据已保存',
          description: '本地覆盖已更新，前台展示会立即跟随。',
        });
      },
      onError: (error) => {
        toast.error({
          title: '元数据保存失败',
          description: getErrorMessage(error),
        });
      },
    });
  };

  const handleRefresh = () => {
    refreshMetadataMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success({
          title: '已重新读取元数据',
          description: '服务端已按当前来源重新解析，页面显示的是最新结果。',
        });
      },
      onError: (error) => {
        toast.error({
          title: '重新读取元数据失败',
          description: getErrorMessage(error),
        });
      },
    });
  };

  return (
    <ManageSectionCard
      title="元数据编辑"
      description="这里改的是本地覆盖层，原始文件与刮削结果都不会被改写，随时可以回退。"
      actions={
        <div className={sharedStyles.rowActions}>
          <button
            className={sharedStyles.smallButton}
            disabled={refreshMetadataMutation.isPending}
            type="button"
            onClick={handleRefresh}
          >
            <RefreshCw size={14} />
            {refreshMetadataMutation.isPending ? '读取中…' : '重新读取来源'}
          </button>
          <StatusBadge
            label={getMetadataStatusLabel(metadataState.status)}
            variant={getMetadataStatusVariant(metadataState.status)}
          />
        </div>
      }
    >
      {metadataState.errorMessage ? (
        <InlineBanner
          description={metadataState.errorMessage}
          title="最近一次元数据解析报错"
          variant="error"
        />
      ) : null}

      {form.hasRemoteDrift ? (
        <InlineBanner
          actions={
            <button
              className={sharedStyles.smallButton}
              type="button"
              onClick={form.resetToRemote}
            >
              载入服务端版本
            </button>
          }
          description="服务端上的元数据在你编辑期间发生了变化。为了不覆盖你的输入，页面保留了当前草稿；直接保存会以草稿为准。"
          title="服务端已有更新的版本"
          variant="warning"
        />
      ) : null}

      <div className={styles.formStack}>
        <div className={sharedStyles.fieldRow}>
          <label className={sharedStyles.fieldGroup}>
            <span className={sharedStyles.label}>标题</span>
            <input
              className={`${sharedStyles.input} ${form.errors.title ? sharedStyles.inputInvalid : ''}`}
              type="text"
              value={form.form.title}
              onChange={(event) => form.setField('title', event.target.value)}
            />
            {form.errors.title ? (
              <span className={sharedStyles.fieldErrorText}>{form.errors.title}</span>
            ) : null}
          </label>

          <label className={sharedStyles.fieldGroup}>
            <span className={sharedStyles.label}>原始标题</span>
            <input
              className={sharedStyles.input}
              type="text"
              value={form.form.originalTitle}
              onChange={(event) => form.setField('originalTitle', event.target.value)}
            />
          </label>

          <label className={sharedStyles.fieldGroup}>
            <span className={sharedStyles.label}>排序标题</span>
            <input
              className={sharedStyles.input}
              type="text"
              value={form.form.sortTitle}
              onChange={(event) => form.setField('sortTitle', event.target.value)}
            />
            <span className={sharedStyles.fieldHelpText}>
              留空时按标题排序，用于处理「The」开头这类排序需求。
            </span>
          </label>
        </div>

        <div className={sharedStyles.fieldRow}>
          <label className={sharedStyles.fieldGroup}>
            <span className={sharedStyles.label}>年份</span>
            <input
              className={`${sharedStyles.input} ${form.errors.year ? sharedStyles.inputInvalid : ''}`}
              inputMode="numeric"
              type="text"
              value={form.form.year}
              onChange={(event) => form.setField('year', event.target.value)}
            />
            {form.errors.year ? (
              <span className={sharedStyles.fieldErrorText}>{form.errors.year}</span>
            ) : null}
          </label>

          <label className={sharedStyles.fieldGroup}>
            <span className={sharedStyles.label}>首播日期</span>
            <input
              className={sharedStyles.input}
              type="date"
              value={form.form.premiered}
              onChange={(event) => form.setField('premiered', event.target.value)}
            />
          </label>

          <label className={sharedStyles.fieldGroup}>
            <span className={sharedStyles.label}>社区评分</span>
            <input
              className={`${sharedStyles.input} ${form.errors.communityRating ? sharedStyles.inputInvalid : ''}`}
              inputMode="decimal"
              type="text"
              value={form.form.communityRating}
              onChange={(event) => form.setField('communityRating', event.target.value)}
            />
            {form.errors.communityRating ? (
              <span className={sharedStyles.fieldErrorText}>
                {form.errors.communityRating}
              </span>
            ) : (
              <span className={sharedStyles.fieldHelpText}>取值范围 0 到 10。</span>
            )}
          </label>
        </div>

        <label className={sharedStyles.fieldGroup}>
          <span className={sharedStyles.label}>剧情简介</span>
          <textarea
            className={sharedStyles.textarea}
            rows={5}
            value={form.form.overview}
            onChange={(event) => form.setField('overview', event.target.value)}
          />
        </label>

        <div className={sharedStyles.fieldRow}>
          <label className={sharedStyles.fieldGroup}>
            <span className={sharedStyles.label}>类型标签</span>
            <input
              className={sharedStyles.input}
              type="text"
              value={form.form.genres}
              onChange={(event) => form.setField('genres', event.target.value)}
            />
            <span className={sharedStyles.fieldHelpText}>多个值用顿号或逗号分隔。</span>
          </label>

          <label className={sharedStyles.fieldGroup}>
            <span className={sharedStyles.label}>导演</span>
            <input
              className={sharedStyles.input}
              type="text"
              value={form.form.directors}
              onChange={(event) => form.setField('directors', event.target.value)}
            />
            <span className={sharedStyles.fieldHelpText}>多个值用顿号或逗号分隔。</span>
          </label>

          <label className={sharedStyles.fieldGroup}>
            <span className={sharedStyles.label}>制作方</span>
            <input
              className={sharedStyles.input}
              type="text"
              value={form.form.studios}
              onChange={(event) => form.setField('studios', event.target.value)}
            />
            <span className={sharedStyles.fieldHelpText}>多个值用顿号或逗号分隔。</span>
          </label>
        </div>

        <div className={sharedStyles.fieldGroup}>
          <div className={styles.rawToggleRow}>
            <span className={sharedStyles.label}>演职员</span>
            <button
              className={sharedStyles.smallButton}
              type="button"
              onClick={form.addActor}
            >
              <Plus size={14} />
              添加一位
            </button>
          </div>

          {form.form.actors.length === 0 ? (
            <div className={sharedStyles.emptyInlineState}>
              还没有演职员记录，点「添加一位」开始录入。
            </div>
          ) : (
            <div className={styles.actorList}>
              {form.form.actors.map((actor) => (
                <div className={styles.actorRow} key={actor.key}>
                  <input
                    aria-label="演职员姓名"
                    className={sharedStyles.input}
                    placeholder="姓名"
                    type="text"
                    value={actor.name}
                    onChange={(event) =>
                      form.updateActor(actor.key, { name: event.target.value })
                    }
                  />
                  <input
                    aria-label="出演角色"
                    className={sharedStyles.input}
                    placeholder="角色"
                    type="text"
                    value={actor.role}
                    onChange={(event) =>
                      form.updateActor(actor.key, { role: event.target.value })
                    }
                  />
                  <button
                    aria-label={`移除 ${actor.name || '这一行'}`}
                    className={sharedStyles.smallDangerButton}
                    type="button"
                    onClick={() => form.removeActor(actor.key)}
                  >
                    <Trash2 size={14} />
                    移除
                  </button>
                </div>
              ))}
            </div>
          )}
          <span className={sharedStyles.fieldHelpText}>
            姓名为空的行不会被保存；每一行原有的头像与档案链接会原样保留。
          </span>
        </div>

        {updateMutation.isError ? (
          <InlineBanner
            description={getErrorMessage(updateMutation.error)}
            title="保存失败"
            variant="error"
          />
        ) : null}

        <div className={sharedStyles.buttonRow}>
          <button
            className={sharedStyles.primaryButton}
            disabled={!form.canSubmit || updateMutation.isPending}
            type="button"
            onClick={handleSubmit}
          >
            {updateMutation.isPending ? '保存中…' : '保存元数据'}
          </button>
          <button
            className={sharedStyles.ghostButton}
            disabled={!form.isDirty || updateMutation.isPending}
            type="button"
            onClick={form.resetToRemote}
          >
            放弃修改
          </button>
          <span className={sharedStyles.metaText}>
            {form.isDirty ? '有未保存的修改' : '当前与服务端一致'}
          </span>
        </div>
      </div>

      <MetadataSourcePanel
        detail={detail}
        showRawContent={showRawContent}
        onToggleRawContent={() => setShowRawContent((current) => !current)}
      />
    </ManageSectionCard>
  );
}

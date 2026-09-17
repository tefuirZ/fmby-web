/** 单条外挂字幕行（V1F 拆分：MediaItemSubtitleSection → 子组件）。 */

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ManageMediaItemSubtitleOverrideRecord } from '@fmby/v2-shared/contracts/manage/media-items';
import { StatusBadge, useToast } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { formatOperator } from '../formatters';
import sharedStyles from '../../ManagePages.module.css';
import styles from '../MediaItemDetail.module.css';
import type { MediaItemMutations } from '../types';

export type { PendingSubtitleDelete };

interface PendingSubtitleDelete {
  overrideId: string;
  filename: string;
  language: string;
}

interface SubtitleRowDraft {
  language: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: string;
}

function toDraft(record: ManageMediaItemSubtitleOverrideRecord): SubtitleRowDraft {
  return {
    language: record.language ?? '',
    isActive: record.isActive,
    isDefault: record.isDefault,
    sortOrder: String(record.sortOrder),
  };
}

function isSameDraft(left: SubtitleRowDraft, right: SubtitleRowDraft): boolean {
  return (
    left.language === right.language &&
    left.isActive === right.isActive &&
    left.isDefault === right.isDefault &&
    left.sortOrder === right.sortOrder
  );
}

export function SubtitleOverrideRow({
  record,
  mutations,
  onRequestDelete,
}: {
  record: ManageMediaItemSubtitleOverrideRecord;
  mutations: MediaItemMutations;
  onRequestDelete: (target: PendingSubtitleDelete) => void;
}) {
  const { toast } = useToast();
  const { updateSubtitleMutation, deleteSubtitleMutation } = mutations;
  const [editedDraft, setEditedDraft] = useState<SubtitleRowDraft | null>(null);

  const serverDraft = toDraft(record);
  const draft = editedDraft ?? serverDraft;
  const isDirty = editedDraft !== null && !isSameDraft(editedDraft, serverDraft);

  const patchDraft = (patch: Partial<SubtitleRowDraft>) => {
    setEditedDraft((current) => ({ ...(current ?? serverDraft), ...patch }));
  };

  const parsedSortOrder = Number(draft.sortOrder);
  const sortOrderValid =
    draft.sortOrder.trim() !== '' && Number.isInteger(parsedSortOrder) && parsedSortOrder >= 0;

  const isSaving =
    updateSubtitleMutation.isPending &&
    updateSubtitleMutation.variables?.overrideId === record.id;
  const isDeleting =
    deleteSubtitleMutation.isPending &&
    deleteSubtitleMutation.variables?.overrideId === record.id;

  const handleSave = () => {
    updateSubtitleMutation.mutate(
      {
        overrideId: record.id,
        payload: {
          language: draft.language.trim() === '' ? undefined : draft.language.trim(),
          isActive: draft.isActive,
          isDefault: draft.isDefault,
          sortOrder: parsedSortOrder,
        },
      },
      {
        onSuccess: () => {
          toast.success({
            title: '字幕设置已更新',
            description: `${record.originalFilename} 的挂载参数已保存。`,
          });
        },
        onError: (error) => {
          toast.error({
            title: '字幕设置保存失败',
            description: getErrorMessage(error),
          });
        },
      },
    );
  };

  return (
    <div className={styles.subtitleRow}>
      <div className={styles.subtitleHead}>
        <div className={sharedStyles.stackText}>
          <span className={styles.subtitleName}>{record.originalFilename}</span>
          <span className={styles.assetMeta}>
            {record.subtitleFormat.toUpperCase()} · {record.mimeType} · 由{' '}
            {formatOperator(
              record.createdByDisplayName,
              record.createdByUsername,
              record.createdBy,
            )}{' '}
            上传于 {formatDateTime(record.createdAt)}
          </span>
          <span className={styles.assetMeta}>存储路径 {record.storagePath}</span>
        </div>
        <div className={styles.badgeRow}>
          <StatusBadge
            label={record.isActive ? '已启用' : '已停用'}
            variant={record.isActive ? 'success' : 'neutral'}
          />
          {record.isDefault ? <StatusBadge label="默认字幕" variant="info" /> : null}
          <a
            className={sharedStyles.smallButton}
            href={record.url}
            rel="noreferrer"
            target="_blank"
          >
            下载
          </a>
          <button
            className={sharedStyles.smallDangerButton}
            disabled={isDeleting}
            type="button"
            onClick={() =>
              onRequestDelete({
                overrideId: record.id,
                filename: record.originalFilename,
                language: record.language ?? '',
              })
            }
          >
            <Trash2 size={14} />
            {isDeleting ? '删除中…' : '删除'}
          </button>
        </div>
      </div>

      <div className={styles.subtitleForm}>
        <label className={sharedStyles.fieldGroup}>
          <span className={sharedStyles.label}>语言标记</span>
          <input
            className={sharedStyles.input}
            placeholder="例如 zh-CN"
            type="text"
            value={draft.language}
            onChange={(event) => patchDraft({ language: event.target.value })}
          />
        </label>

        <label className={sharedStyles.fieldGroup}>
          <span className={sharedStyles.label}>排序序号</span>
          <input
            className={`${sharedStyles.input} ${sortOrderValid ? '' : sharedStyles.inputInvalid}`}
            inputMode="numeric"
            type="text"
            value={draft.sortOrder}
            onChange={(event) => patchDraft({ sortOrder: event.target.value })}
          />
          {sortOrderValid ? (
            <span className={sharedStyles.fieldHelpText}>数值越小越靠前。</span>
          ) : (
            <span className={sharedStyles.fieldErrorText}>请填写不小于 0 的整数。</span>
          )}
        </label>

        <div className={sharedStyles.fieldGroup}>
          <span className={sharedStyles.label}>挂载方式</span>
          <div className={styles.toggleRow}>
            <label className={styles.toggleLabel}>
              <input
                checked={draft.isActive}
                className={sharedStyles.checkbox}
                type="checkbox"
                onChange={(event) => patchDraft({ isActive: event.target.checked })}
              />
              启用
            </label>
            <label className={styles.toggleLabel}>
              <input
                checked={draft.isDefault}
                className={sharedStyles.checkbox}
                type="checkbox"
                onChange={(event) => patchDraft({ isDefault: event.target.checked })}
              />
              设为默认
            </label>
          </div>
        </div>

        <div className={sharedStyles.buttonRow}>
          <button
            className={sharedStyles.smallButton}
            disabled={!isDirty || !sortOrderValid || isSaving}
            type="button"
            onClick={handleSave}
          >
            {isSaving ? '保存中…' : '保存设置'}
          </button>
          <button
            className={sharedStyles.ghostButton}
            disabled={!isDirty || isSaving}
            type="button"
            onClick={() => setEditedDraft(null)}
          >
            还原
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 「外挂字幕」段落。
 *
 * 这里管的是上传到服务端的外挂字幕；内封字幕属于媒体文件本身，
 * 在上面的「数据源与技术规格」里以字幕流的形式呈现，两者不混。
 */

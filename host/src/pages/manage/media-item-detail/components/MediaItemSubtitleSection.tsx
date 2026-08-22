import { useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import type { DangerousActionRequest } from '@fmby/v2-shared/contracts/manage';
import type { ManageMediaItemSubtitleOverrideRecord } from '@fmby/v2-shared/contracts/manage/media-items';
import { InlineBanner, SensitiveActionDialog, StatusBadge, useToast } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import sharedStyles from '../../ManagePages.module.css';
import { ManageSectionCard } from '../../components';
import { EM_DASH, formatFileSize, formatOperator, formatOptional } from '../formatters';
import styles from '../MediaItemDetail.module.css';
import type { MediaItemMutations } from '../types';

interface MediaItemSubtitleSectionProps {
  subtitles: ManageMediaItemSubtitleOverrideRecord[];
  mutations: MediaItemMutations;
}

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

/**
 * 单条外挂字幕：上半是只读身份信息，下半是可改的挂载参数。
 *
 * 草稿用 `null` 表示「这一行还没被动过」，于是不需要任何同步副作用：
 * 未编辑的行永远跟随服务端；编辑过的行按「草稿 vs 服务端当前值」判断是否
 * 还有未保存内容，保存成功后两者自然相等，按钮自动回到禁用态。
 * 这样在别的行触发保存、导致整份详情缓存刷新时，本行的输入也不会被冲掉。
 */
function SubtitleOverrideRow({
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
export function MediaItemSubtitleSection({
  subtitles,
  mutations,
}: MediaItemSubtitleSectionProps) {
  const { toast } = useToast();
  const { uploadSubtitleMutation, deleteSubtitleMutation } = mutations;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploadLanguage, setUploadLanguage] = useState('');
  const [uploadActive, setUploadActive] = useState(true);
  const [uploadDefault, setUploadDefault] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingSubtitleDelete | null>(null);

  // 新字幕默认排在现有字幕之后，避免与既有序号打架。
  const nextSortOrder = subtitles.reduce(
    (max, record) => Math.max(max, record.sortOrder + 1),
    0,
  );

  const handleUpload = () => {
    if (!selectedFile) {
      return;
    }
    uploadSubtitleMutation.mutate(
      {
        file: selectedFile,
        language: uploadLanguage.trim() === '' ? undefined : uploadLanguage.trim(),
        isActive: uploadActive,
        isDefault: uploadDefault,
        sortOrder: nextSortOrder,
      },
      {
        onSuccess: () => {
          setSelectedFile(null);
          setUploadLanguage('');
          setUploadDefault(false);
          setFileInputKey((current) => current + 1);
          toast.success({
            title: '字幕已上传',
            description: '新字幕已挂载到这条资源，播放器会在下次加载时读取。',
          });
        },
        onError: (error) => {
          toast.error({
            title: '字幕上传失败',
            description: getErrorMessage(error),
          });
        },
      },
    );
  };

  const handleConfirmDelete = (confirmation: DangerousActionRequest) => {
    if (!pendingDelete) {
      return;
    }
    const target = pendingDelete;
    deleteSubtitleMutation.mutate(
      { overrideId: target.overrideId, confirmation },
      {
        onSuccess: () => {
          setPendingDelete(null);
          toast.success({
            title: '字幕已删除',
            description: `${target.filename} 已从这条资源上移除。`,
          });
        },
        onError: (error) => {
          toast.error({
            title: '字幕删除失败',
            description: getErrorMessage(error),
          });
        },
      },
    );
  };

  return (
    <ManageSectionCard
      title="外挂字幕"
      description="上传到服务端的字幕文件，可单独控制启用、默认与排序；内封字幕请看数据源段落。"
      actions={
        <span className={sharedStyles.metaText}>共 {subtitles.length} 条外挂字幕</span>
      }
    >
      <div className={styles.uploadForm}>
        <label className={sharedStyles.fieldGroup}>
          <span className={sharedStyles.label}>选择字幕文件</span>
          <input
            accept=".srt,.ass,.ssa,.vtt,.sub,.sup,text/plain"
            className={styles.fileInput}
            key={fileInputKey}
            type="file"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
          <span className={sharedStyles.fieldHelpText}>
            {selectedFile
              ? `已选择 ${selectedFile.name}（${formatFileSize(selectedFile.size)}）`
              : '支持 SRT、ASS、SSA、VTT 等常见字幕格式。'}
          </span>
        </label>

        <label className={sharedStyles.fieldGroup}>
          <span className={sharedStyles.label}>语言标记</span>
          <input
            className={sharedStyles.input}
            placeholder="例如 zh-CN"
            type="text"
            value={uploadLanguage}
            onChange={(event) => setUploadLanguage(event.target.value)}
          />
          <span className={sharedStyles.fieldHelpText}>
            留空时由服务端按文件名推断。
          </span>
        </label>

        <div className={sharedStyles.fieldGroup}>
          <span className={sharedStyles.label}>挂载方式</span>
          <div className={styles.toggleRow}>
            <label className={styles.toggleLabel}>
              <input
                checked={uploadActive}
                className={sharedStyles.checkbox}
                type="checkbox"
                onChange={(event) => setUploadActive(event.target.checked)}
              />
              上传后立即启用
            </label>
            <label className={styles.toggleLabel}>
              <input
                checked={uploadDefault}
                className={sharedStyles.checkbox}
                type="checkbox"
                onChange={(event) => setUploadDefault(event.target.checked)}
              />
              设为默认字幕
            </label>
          </div>
          <span className={sharedStyles.fieldHelpText}>
            排序序号自动取 {nextSortOrder}，上传后可随时调整。
          </span>
        </div>

        <div className={sharedStyles.buttonRow}>
          <button
            className={sharedStyles.primaryButton}
            disabled={!selectedFile || uploadSubtitleMutation.isPending}
            type="button"
            onClick={handleUpload}
          >
            <Upload size={16} />
            {uploadSubtitleMutation.isPending ? '上传中…' : '上传字幕'}
          </button>
        </div>
      </div>

      {uploadSubtitleMutation.isError ? (
        <InlineBanner
          description={getErrorMessage(uploadSubtitleMutation.error)}
          title="字幕上传失败"
          variant="error"
        />
      ) : null}

      {subtitles.length === 0 ? (
        <div className={sharedStyles.emptyInlineState}>
          这条资源还没有外挂字幕，播放时只会使用媒体文件里的内封字幕。
        </div>
      ) : (
        <div className={styles.subtitleList}>
          {subtitles.map((record) => (
            <SubtitleOverrideRow
              key={record.id}
              mutations={mutations}
              record={record}
              onRequestDelete={(target) => {
                deleteSubtitleMutation.reset();
                setPendingDelete(target);
              }}
            />
          ))}
        </div>
      )}

      <SensitiveActionDialog
        actionKey="delete-media-item-subtitle"
        confirmLabel="删除字幕"
        description="删除后这条外挂字幕将从服务端移除，正在使用它的播放会话会在下次加载时回落到其它字幕。"
        errorMessage={
          pendingDelete && deleteSubtitleMutation.isError
            ? getErrorMessage(deleteSubtitleMutation.error)
            : undefined
        }
        impact={
          pendingDelete
            ? [
                `字幕文件：${pendingDelete.filename || EM_DASH}`,
                `语言标记：${formatOptional(pendingDelete.language)}`,
                '服务端上的字幕文件会被一并清除，无法撤销。',
              ]
            : undefined
        }
        open={pendingDelete !== null}
        pending={deleteSubtitleMutation.isPending}
        title={pendingDelete ? `删除字幕：${pendingDelete.filename}` : ''}
        onConfirm={handleConfirmDelete}
        onOpenChange={(open) => {
          if (!open) {
            deleteSubtitleMutation.reset();
            setPendingDelete(null);
          }
        }}
      />
    </ManageSectionCard>
  );
}

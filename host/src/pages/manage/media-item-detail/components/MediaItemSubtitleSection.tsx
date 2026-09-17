import { useState } from 'react';
import { Upload } from 'lucide-react';
import type { DangerousActionRequest } from '@fmby/v2-shared/contracts/manage';
import type { ManageMediaItemSubtitleOverrideRecord } from '@fmby/v2-shared/contracts/manage/media-items';
import { InlineBanner, SensitiveActionDialog, useToast } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import sharedStyles from '../../ManagePages.module.css';
import { ManageSectionCard } from '../../components';
import { EM_DASH, formatFileSize, formatOptional } from '../formatters';
import styles from '../MediaItemDetail.module.css';
import type { MediaItemMutations } from '../types';

interface MediaItemSubtitleSectionProps {
  subtitles: ManageMediaItemSubtitleOverrideRecord[];
  mutations: MediaItemMutations;
}

import { SubtitleOverrideRow } from './SubtitleOverrideRow';
import type { PendingSubtitleDelete } from './SubtitleOverrideRow';
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

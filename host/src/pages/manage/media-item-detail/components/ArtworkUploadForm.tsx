import { useState } from 'react';
import { Upload } from 'lucide-react';
import type { ManageMediaItemArtworkKind } from '@fmby/v2-shared/contracts/manage/media-items';
import { InlineBanner, useToast } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import sharedStyles from '../../ManagePages.module.css';
import { formatFileSize, getArtworkKindLabel } from '../formatters';
import styles from '../MediaItemDetail.module.css';
import type { MediaItemMutations } from '../types';

const ARTWORK_KINDS: { value: ManageMediaItemArtworkKind; label: string }[] = [
  { value: 'poster', label: '海报（竖版 2:3）' },
  { value: 'backdrop', label: '背景图（横版 16:9）' },
  { value: 'thumb', label: '缩略图（横版 16:9）' },
];

interface ArtworkUploadFormProps {
  uploadArtworkMutation: MediaItemMutations['uploadArtworkMutation'];
}

/** 「图片资产」上传表单：图片用途 + 文件选择 + 上传并覆盖。 */
export function ArtworkUploadForm({ uploadArtworkMutation }: ArtworkUploadFormProps) {
  const { toast } = useToast();
  const [artworkKind, setArtworkKind] = useState<ManageMediaItemArtworkKind>('poster');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // 上传成功后靠改 key 强制重建 input，把已选文件名清掉。
  const [fileInputKey, setFileInputKey] = useState(0);

  const handleUpload = () => {
    if (!selectedFile) {
      return;
    }
    uploadArtworkMutation.mutate(
      { artworkKind, file: selectedFile },
      {
        onSuccess: () => {
          setSelectedFile(null);
          setFileInputKey((current) => current + 1);
          toast.success({
            title: '图片已上传',
            description: `${getArtworkKindLabel(artworkKind)}已替换为本地版本。`,
          });
        },
        onError: (error) => {
          toast.error({
            title: '图片上传失败',
            description: getErrorMessage(error),
          });
        },
      },
    );
  };

  return (
    <>
      <div className={styles.uploadForm}>
        <label className={sharedStyles.fieldGroup}>
          <span className={sharedStyles.label}>图片用途</span>
          <select
            className={sharedStyles.select}
            value={artworkKind}
            onChange={(event) =>
              setArtworkKind(event.target.value as ManageMediaItemArtworkKind)
            }
          >
            {ARTWORK_KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </label>

        <label className={sharedStyles.fieldGroup}>
          <span className={sharedStyles.label}>选择图片文件</span>
          <input
            accept="image/*"
            className={styles.fileInput}
            key={fileInputKey}
            type="file"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
          <span className={sharedStyles.fieldHelpText}>
            {selectedFile
              ? `已选择 ${selectedFile.name}（${formatFileSize(selectedFile.size)}）`
              : '支持常见图片格式，上传后立即作为该用途的本地覆盖生效。'}
          </span>
        </label>

        <div className={sharedStyles.buttonRow}>
          <button
            className={sharedStyles.primaryButton}
            disabled={!selectedFile || uploadArtworkMutation.isPending}
            type="button"
            onClick={handleUpload}
          >
            <Upload size={16} />
            {uploadArtworkMutation.isPending ? '上传中…' : '上传并覆盖'}
          </button>
        </div>
      </div>

      {uploadArtworkMutation.isError ? (
        <InlineBanner
          description={getErrorMessage(uploadArtworkMutation.error)}
          title="上传失败"
          variant="error"
        />
      ) : null}
    </>
  );
}

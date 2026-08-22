import { useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import type { DangerousActionRequest } from '@fmby/v2-shared/contracts/manage';
import type {
  ManageMediaItemArtworkKind,
  ManageMediaItemDetailRecord,
} from '@fmby/v2-shared/contracts/manage/media-items';
import { InlineBanner, SensitiveActionDialog, StatusBadge, useToast } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import sharedStyles from '../../ManagePages.module.css';
import { ManageSectionCard } from '../../components';
import {
  EM_DASH,
  formatFileSize,
  formatOperator,
  formatOptional,
  formatResolution,
  getArtworkKindLabel,
  isWideArtwork,
} from '../formatters';
import styles from '../MediaItemDetail.module.css';
import type { MediaItemMutations } from '../types';
import { ArtImage } from './ArtImage';

interface MediaItemArtworkSectionProps {
  detail: ManageMediaItemDetailRecord;
  mutations: MediaItemMutations;
}

interface PendingArtworkDelete {
  overrideId: string;
  kindLabel: string;
  filename: string;
}

const ARTWORK_KINDS: { value: ManageMediaItemArtworkKind; label: string }[] = [
  { value: 'poster', label: '海报（竖版 2:3）' },
  { value: 'backdrop', label: '背景图（横版 16:9）' },
  { value: 'thumb', label: '缩略图（横版 16:9）' },
];

/**
 * 「图片资产」段落。
 *
 * 三份数据放在一起看才有意义：
 *   - 自定义封面：管理员上传的本地覆盖，优先级最高，可删；
 *   - 刮削图片：刮削源返回的候选，只读；
 *   - 随文件资源：跟着媒体文件一起躺在挂载点上的图，只读。
 * 前台最终用哪张由后端按优先级决定，这里把三层都摊开，便于排查「为什么封面不对」。
 */
export function MediaItemArtworkSection({
  detail,
  mutations,
}: MediaItemArtworkSectionProps) {
  const { toast } = useToast();
  const { uploadArtworkMutation, deleteArtworkMutation } = mutations;

  const [artworkKind, setArtworkKind] = useState<ManageMediaItemArtworkKind>('poster');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // 上传成功后靠改 key 强制重建 input，把已选文件名清掉。
  const [fileInputKey, setFileInputKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<PendingArtworkDelete | null>(null);

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

  const handleConfirmDelete = (confirmation: DangerousActionRequest) => {
    if (!pendingDelete) {
      return;
    }
    const target = pendingDelete;
    deleteArtworkMutation.mutate(
      { overrideId: target.overrideId, confirmation },
      {
        onSuccess: () => {
          setPendingDelete(null);
          toast.success({
            title: '自定义图片已删除',
            description: `${target.kindLabel}已回落到刮削或随文件的版本。`,
          });
        },
        onError: (error) => {
          toast.error({
            title: '自定义图片删除失败',
            description: getErrorMessage(error),
          });
        },
      },
    );
  };

  return (
    <ManageSectionCard
      title="图片资产"
      description="自定义封面优先于刮削图片与随文件资源，删除后自动回落到下一层。"
      actions={
        <span className={sharedStyles.metaText}>
          自定义 {detail.artworkOverrides.length} 张 · 刮削 {detail.scrapedArtworks.length}{' '}
          张 · 随文件 {detail.remoteAssets.length} 项
        </span>
      }
    >
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

      <div className={sharedStyles.stackText}>
        <span className={styles.kicker}>自定义封面</span>
        {detail.artworkOverrides.length === 0 ? (
          <div className={sharedStyles.emptyInlineState}>
            还没有上传过自定义图片，前台使用的是刮削结果或随文件的图片。
          </div>
        ) : (
          <div className={styles.assetGrid}>
            {detail.artworkOverrides.map((artwork) => {
              const kindLabel = getArtworkKindLabel(artwork.artworkKind);
              const isDeleting =
                deleteArtworkMutation.isPending &&
                deleteArtworkMutation.variables?.overrideId === artwork.id;

              return (
                <div className={styles.assetCard} key={artwork.id}>
                  <ArtImage
                    alt={`${kindLabel}：${artwork.originalFilename}`}
                    compact
                    placeholder="图片无法加载"
                    src={artwork.url}
                    wide={isWideArtwork(artwork.artworkKind)}
                  />
                  <div className={styles.assetBody}>
                    <div className={styles.badgeRow}>
                      <span className={sharedStyles.chip}>{kindLabel}</span>
                      <StatusBadge
                        label={artwork.isActive ? '生效中' : '未生效'}
                        variant={artwork.isActive ? 'success' : 'neutral'}
                      />
                    </div>
                    <span className={styles.assetName}>{artwork.originalFilename}</span>
                    <span className={styles.assetMeta}>
                      {formatResolution(artwork.width, artwork.height)} ·{' '}
                      {formatFileSize(artwork.sizeBytes)} · {artwork.mimeType}
                    </span>
                    <span className={styles.assetMeta}>
                      由{' '}
                      {formatOperator(
                        artwork.createdByDisplayName,
                        artwork.createdByUsername,
                        artwork.createdBy,
                      )}{' '}
                      上传于 {formatDateTime(artwork.createdAt)}
                    </span>
                  </div>
                  <div className={styles.assetActions}>
                    <a
                      className={sharedStyles.smallButton}
                      href={artwork.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      查看原图
                    </a>
                    <button
                      className={sharedStyles.smallDangerButton}
                      disabled={isDeleting}
                      type="button"
                      onClick={() => {
                        deleteArtworkMutation.reset();
                        setPendingDelete({
                          overrideId: artwork.id,
                          kindLabel,
                          filename: artwork.originalFilename,
                        });
                      }}
                    >
                      <Trash2 size={14} />
                      {isDeleting ? '删除中…' : '删除'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={sharedStyles.stackText}>
        <span className={styles.kicker}>刮削图片</span>
        {detail.scrapedArtworks.length === 0 ? (
          <div className={sharedStyles.emptyInlineState}>
            刮削源还没有返回可用的图片候选。
          </div>
        ) : (
          <div className={styles.assetGrid}>
            {detail.scrapedArtworks.map((artwork) => (
              <div className={styles.assetCard} key={`${artwork.kind}-${artwork.url}`}>
                <ArtImage
                  alt={`刮削${getArtworkKindLabel(artwork.kind)}`}
                  compact
                  placeholder="图片无法加载"
                  src={artwork.url}
                  wide={isWideArtwork(artwork.kind)}
                />
                <div className={styles.assetBody}>
                  <div className={styles.badgeRow}>
                    <span className={sharedStyles.chip}>
                      {getArtworkKindLabel(artwork.kind)}
                    </span>
                  </div>
                  <span className={styles.assetMeta}>
                    {formatResolution(artwork.width, artwork.height)} · 语言{' '}
                    {formatOptional(artwork.language)}
                  </span>
                </div>
                <div className={styles.assetActions}>
                  <a
                    className={sharedStyles.smallButton}
                    href={artwork.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    查看原图
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={sharedStyles.stackText}>
        <span className={styles.kicker}>随文件资源</span>
        {detail.remoteAssets.length === 0 ? (
          <div className={sharedStyles.emptyInlineState}>
            挂载点上没有发现与这条资源同名的图片或附属文件。
          </div>
        ) : (
          <div className={sharedStyles.tableWrap}>
            <table className={sharedStyles.table}>
              <thead>
                <tr>
                  <th>资源类型</th>
                  <th>所在挂载</th>
                  <th>文件路径</th>
                  <th>缓存状态</th>
                  <th>接入时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {detail.remoteAssets.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <div className={sharedStyles.stackText}>
                        <span className={sharedStyles.primaryText}>
                          {asset.assetTypeLabel}
                        </span>
                        <span className={sharedStyles.mutedText}>
                          语言 {formatOptional(asset.language)}
                        </span>
                      </div>
                    </td>
                    <td>{formatOptional(asset.mountName)}</td>
                    <td>
                      <span className={sharedStyles.mono}>{asset.filePath}</span>
                    </td>
                    <td>
                      <StatusBadge
                        label={asset.isCached ? '已缓存' : '未缓存'}
                        variant={asset.isCached ? 'success' : 'neutral'}
                      />
                      {asset.cachePath ? (
                        <div className={sharedStyles.mutedText}>{asset.cachePath}</div>
                      ) : null}
                    </td>
                    <td>{formatDateTime(asset.createdAt)}</td>
                    <td>
                      <a
                        className={sharedStyles.smallButton}
                        href={asset.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        打开
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SensitiveActionDialog
        actionKey="delete-media-item-artwork"
        confirmLabel="删除自定义图片"
        description="删除后该用途的图片会回落到刮削结果或随文件的版本；如果两者都没有，前台将显示为无图。"
        errorMessage={
          pendingDelete && deleteArtworkMutation.isError
            ? getErrorMessage(deleteArtworkMutation.error)
            : undefined
        }
        impact={
          pendingDelete
            ? [
                `图片用途：${pendingDelete.kindLabel}`,
                `原始文件名：${pendingDelete.filename || EM_DASH}`,
                '服务端会同时清除已生成的缓存副本。',
              ]
            : undefined
        }
        open={pendingDelete !== null}
        pending={deleteArtworkMutation.isPending}
        title={pendingDelete ? `删除自定义图片：${pendingDelete.kindLabel}` : ''}
        onConfirm={handleConfirmDelete}
        onOpenChange={(open) => {
          if (!open) {
            deleteArtworkMutation.reset();
            setPendingDelete(null);
          }
        }}
      />
    </ManageSectionCard>
  );
}

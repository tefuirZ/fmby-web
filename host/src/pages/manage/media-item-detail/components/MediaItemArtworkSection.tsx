import { useState } from 'react';
import type { DangerousActionRequest } from '@fmby/v2-shared/contracts/manage';
import type { ManageMediaItemDetailRecord } from '@fmby/v2-shared/contracts/manage/media-items';
import { SensitiveActionDialog, useToast } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import sharedStyles from '../../ManagePages.module.css';
import { ManageSectionCard } from '../../components';
import { EM_DASH } from '../formatters';
import type { MediaItemMutations } from '../types';
import { ArtworkUploadForm } from './ArtworkUploadForm';
import { ArtworkOverridesGrid } from './ArtworkOverridesGrid';
import { ScrapedArtworksGrid } from './ScrapedArtworksGrid';
import { RemoteAssetsTable } from './RemoteAssetsTable';

interface MediaItemArtworkSectionProps {
  detail: ManageMediaItemDetailRecord;
  mutations: MediaItemMutations;
}

interface PendingArtworkDelete {
  overrideId: string;
  kindLabel: string;
  filename: string;
}

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

  const [pendingDelete, setPendingDelete] = useState<PendingArtworkDelete | null>(null);


  const handleRequestDelete = (payload: { overrideId: string; kindLabel: string; filename: string }) => {
    deleteArtworkMutation.reset();
    setPendingDelete(payload);
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
      <ArtworkUploadForm uploadArtworkMutation={uploadArtworkMutation} />

      <ArtworkOverridesGrid
        artworkOverrides={detail.artworkOverrides}
        deleteArtworkMutation={deleteArtworkMutation}
        onRequestDelete={handleRequestDelete}
      />

      <ScrapedArtworksGrid scrapedArtworks={detail.scrapedArtworks} />

      <RemoteAssetsTable remoteAssets={detail.remoteAssets} />

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

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { DangerousActionRequest } from '@/domains/manage';
import type { ManageMediaItemDetailRecord } from '@/domains/manage/media-items';
import { SensitiveActionDialog, useToast } from '@/shared/ui';
import { formatDateTime } from '@/shared/utils/date';
import { getErrorMessage } from '@/shared/utils/error';
import sharedStyles from '../../ManagePages.module.css';
import { ManageSectionCard } from '../../components';
import { formatOperator } from '../formatters';
import styles from '../MediaItemDetail.module.css';
import type { MediaItemMutations } from '../types';

interface MediaItemDangerZoneSectionProps {
  detail: ManageMediaItemDetailRecord;
  mutations: MediaItemMutations;
}

/**
 * 「危险操作」段落。
 *
 * 只收口一件事：把人工编辑过的元数据整份丢弃，回到扫描 / 刮削得到的原始值。
 * 图片、字幕、数据源的删除各自留在对应段落里，因为它们需要先选中具体的对象。
 */
export function MediaItemDangerZoneSection({
  detail,
  mutations,
}: MediaItemDangerZoneSectionProps) {
  const { toast } = useToast();
  const { resetMutation } = mutations;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const localOverride = detail.localMetadataOverride;
  const hasLocalOverride = detail.metadataStatus.hasLocalOverride;

  const handleConfirm = (confirmation: DangerousActionRequest) => {
    resetMutation.mutate(confirmation, {
      onSuccess: () => {
        setConfirmOpen(false);
        toast.success({
          title: '本地元数据覆盖已清除',
          description: '这条资源已回到扫描与刮削得到的原始元数据。',
        });
      },
      onError: (error) => {
        toast.error({
          title: '清除本地覆盖失败',
          description: getErrorMessage(error),
        });
      },
    });
  };

  return (
    <ManageSectionCard
      title="危险操作"
      description="以下操作会直接丢弃人工编辑结果，执行前需要按站点策略完成二次确认。"
    >
      <div className={sharedStyles.dangerPanel}>
        <div className={styles.dangerRow}>
          <div className={styles.dangerCopy}>
            <span className={sharedStyles.primaryText}>清除本地元数据覆盖</span>
            <span className={sharedStyles.mutedText}>
              {hasLocalOverride
                ? localOverride
                  ? `当前覆盖由 ${formatOperator(localOverride.updatedByDisplayName, localOverride.updatedByUsername, localOverride.updatedBy)} 于 ${formatDateTime(localOverride.updatedAt)} 保存，清除后标题、简介、演职员等字段都会回到原始值。`
                  : '清除后标题、简介、演职员等字段都会回到扫描与刮削得到的原始值。'
                : '这条资源目前没有本地覆盖，无需清除。'}
            </span>
          </div>
          <button
            className={sharedStyles.dangerButton}
            disabled={!hasLocalOverride || resetMutation.isPending}
            type="button"
            onClick={() => {
              resetMutation.reset();
              setConfirmOpen(true);
            }}
          >
            <RotateCcw size={16} />
            {resetMutation.isPending ? '清除中…' : '清除本地覆盖'}
          </button>
        </div>
      </div>

      <SensitiveActionDialog
        actionKey="reset-media-item-metadata"
        confirmLabel="清除本地覆盖"
        description="清除后本地覆盖记录会被删除，前台立即改用扫描与刮削得到的元数据，该操作不可撤销。"
        errorMessage={resetMutation.isError ? getErrorMessage(resetMutation.error) : undefined}
        impact={[
          `影响资源：《${detail.item.title}》`,
          '标题、原始标题、排序标题、年份、评分、简介、类型、导演、制作方、演职员全部回到原始值。',
          '自定义封面与外挂字幕不受影响，需要单独删除。',
        ]}
        open={confirmOpen}
        pending={resetMutation.isPending}
        title={`清除本地元数据覆盖：${detail.item.title}`}
        onConfirm={handleConfirm}
        onOpenChange={(open) => {
          if (!open) {
            resetMutation.reset();
            setConfirmOpen(false);
          }
        }}
      />
    </ManageSectionCard>
  );
}

/** 合集批量操作尾部：进度面板 + 批量条 + 三个危险确认框（V1F 拆分）。 */

import {
  BatchActionBar,
  BatchProgressPanel,
  SensitiveActionDialog,
} from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import type { BatchItemState } from '@fmby/v2-shared/batch';
import styles from '../../longtail-shared/ManageShared.module.css';

interface CollectionBatchActionsProps {
  runnerItems: readonly BatchItemState[];
  onDismiss: () => void;
  onRetryItem: (id: string) => void;
  onRetryFailed: () => void;
  selectedCount: number;
  onClearSelection: () => void;
  onRequestBatchDelete: () => void;
  batchDeleteOpen: boolean;
  onBatchDeleteOpenChange: (open: boolean) => void;
  onConfirmBatchDelete: () => void;
  batchDeleteImpact: string[];
  // 单条删除
  pendingDeleteTitle: string | null;
  deletePending: boolean;
  deleteError: unknown;
  onDeleteOpenChange: (open: boolean) => void;
  onConfirmDelete: () => void;
  // 成员移除
  pendingMemberTitle: string | null;
  memberDeletePending: boolean;
  memberDeleteError: unknown;
  onMemberDeleteOpenChange: (open: boolean) => void;
  onConfirmMemberDelete: () => void;
}

export function CollectionBatchActions({
  runnerItems,
  onDismiss,
  onRetryItem,
  onRetryFailed,
  selectedCount,
  onClearSelection,
  onRequestBatchDelete,
  batchDeleteOpen,
  onBatchDeleteOpenChange,
  onConfirmBatchDelete,
  batchDeleteImpact,
  pendingDeleteTitle,
  deletePending,
  deleteError,
  onDeleteOpenChange,
  onConfirmDelete,
  pendingMemberTitle,
  memberDeletePending,
  memberDeleteError,
  onMemberDeleteOpenChange,
  onConfirmMemberDelete,
}: CollectionBatchActionsProps) {
  return (
    <>
      {runnerItems.length > 0 ? (
        <BatchProgressPanel
          items={runnerItems}
          actionLabel="删除合集"
          onDismiss={onDismiss}
          onRetryItem={(id) => onRetryItem(id)}
          onRetryFailed={onRetryFailed}
        />
      ) : null}

      <BatchActionBar
        count={selectedCount}
        onClear={onClearSelection}
        hint="删除会级联移除成员；逐条执行，失败项可单独重试。"
      >
        <button className={styles.smallDangerButton} type="button" onClick={onRequestBatchDelete}>
          批量删除
        </button>
      </BatchActionBar>

      <SensitiveActionDialog
        open={batchDeleteOpen}
        actionKey="delete-managed-collection"
        title={`批量删除 ${selectedCount} 个合集`}
        description="将逐条删除选中合集并级联移除成员；失败项会在进度面板列出，可单独重试。"
        impact={batchDeleteImpact}
        confirmLabel="确认批量删除"
        onOpenChange={onBatchDeleteOpenChange}
        onConfirm={onConfirmBatchDelete}
      />

      <SensitiveActionDialog
        open={pendingDeleteTitle !== null}
        actionKey="delete-managed-collection"
        title={pendingDeleteTitle ? `删除合集：${pendingDeleteTitle}` : ''}
        description="删除会同时移除合集内的全部成员记录，且不可恢复。"
        impact={[
          '物理删除，级联清空成员。',
          '豆瓣同步/预设来源的合集删除后，需要重新同步才能恢复。',
        ]}
        errorMessage={deleteError ? getErrorMessage(deleteError) : undefined}
        confirmLabel="确认删除"
        pending={deletePending}
        onOpenChange={onDeleteOpenChange}
        onConfirm={onConfirmDelete}
      />

      <SensitiveActionDialog
        open={pendingMemberTitle !== null}
        actionKey="delete-managed-collection-member"
        title={pendingMemberTitle ? `移除成员：${pendingMemberTitle}` : ''}
        description="成员会从这个合集里移除，媒体本体不受影响。"
        errorMessage={memberDeleteError ? getErrorMessage(memberDeleteError) : undefined}
        confirmLabel="确认移除"
        pending={memberDeletePending}
        onOpenChange={onMemberDeleteOpenChange}
        onConfirm={onConfirmMemberDelete}
      />
    </>
  );
}

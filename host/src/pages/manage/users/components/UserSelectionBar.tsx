/** 用户页多选粘底操作条（V1F 拆分：ManageUsersPage → 子组件）。 */

import styles from '../../longtail-shared/ManageShared.module.css';

interface UserSelectionBarProps {
  selectedCount: number;
  softDeleteTargetCount: number;
  onClearSelection: () => void;
  onOpenBatchEdit: () => void;
  onRequestBatchDelete: () => void;
}

export function UserSelectionBar({
  selectedCount,
  softDeleteTargetCount,
  onClearSelection,
  onOpenBatchEdit,
  onRequestBatchDelete,
}: UserSelectionBarProps) {
  if (selectedCount === 0) {
    return null;
  }
  return (
  <div className={styles.stickyBar}>
        <div className={styles.stackText}>
          <strong>已选择 {selectedCount} 个账号</strong>
          <span className={styles.mutedText}>
            当前删除语义为软删除：账号会停用并吊销活跃会话，已停用账号仍可批量编辑或恢复。
            待激活注册申请请走列表里的批准/拒绝注册。
          </span>
        </div>
        <div className={styles.rowActions}>
          <button className={styles.secondaryButton} type="button" onClick={() => onClearSelection()}>清空选择</button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              onOpenBatchEdit()
            }}
          >
            批量编辑
          </button>
          <button
            className={styles.dangerButton}
            type="button"
            disabled={softDeleteTargetCount === 0}
            onClick={onRequestBatchDelete}
          >
            {softDeleteTargetCount === 0 ? '已处于软删除状态' : '批量删除'}
          </button>
        </div>
      </div>

  );
}

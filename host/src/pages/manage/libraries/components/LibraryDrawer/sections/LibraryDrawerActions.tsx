import type { Dispatch, SetStateAction } from 'react';
import type { ManageLibraryDetailRecord } from '@fmby/v2-shared/contracts/manage';
import { buildLibraryFormState } from '../../../formUtils';
import type { LibraryDrawerState, LibraryFormState } from '../../../types';
import styles from '../../../../ManagePages.module.css';

interface LibraryDrawerCreateActionsProps {
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function LibraryDrawerCreateActions({ isSaving, onClose, onSave }: LibraryDrawerCreateActionsProps) {
  return (
    <div className={styles.stickyBar}>
      <div className={styles.stackText}>
        <strong>保存媒体库</strong>
        <span className={styles.mutedText}>提交后会同步覆盖来源绑定与显式授权列表。</span>
      </div>
      <div className={styles.rowActions}>
        <button className={styles.secondaryButton} type="button" onClick={onClose} disabled={isSaving}>
          取消
        </button>
        <button className={styles.primaryButton} type="button" onClick={onSave} disabled={isSaving}>
          {isSaving ? '保存中…' : '创建媒体库'}
        </button>
      </div>
    </div>
  );
}

interface LibraryDrawerEditActionsProps {
  currentDetail: ManageLibraryDetailRecord | undefined;
  isSaving: boolean;
  setFormState: Dispatch<SetStateAction<LibraryFormState>>;
  setDrawerState: (state: LibraryDrawerState | null) => void;
  onClose: () => void;
  onSave: () => void;
}

export function LibraryDrawerEditActions({
  currentDetail,
  isSaving,
  setFormState,
  setDrawerState,
  onClose,
  onSave,
}: LibraryDrawerEditActionsProps) {
  return (
    <div className={styles.stickyBar}>
      <div className={styles.stackText}>
        <strong>保存变更</strong>
        <span className={styles.mutedText}>提交后会整体替换来源绑定和显式授权列表。</span>
      </div>
      <div className={styles.rowActions}>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => {
            if (!currentDetail) {
              onClose();
              return;
            }
            setFormState(buildLibraryFormState(currentDetail));
            setDrawerState({ mode: 'view', libraryId: currentDetail.library.id });
          }}
          disabled={isSaving}
        >
          返回详情
        </button>
        <button className={styles.primaryButton} type="button" onClick={onSave} disabled={isSaving}>
          {isSaving ? '保存中…' : '保存变更'}
        </button>
      </div>
    </div>
  );
}

interface LibraryDrawerDeletePanelProps {
  isDeleting: boolean;
  isSaving?: boolean;
  onDelete: () => void;
}

export function LibraryDrawerDeletePanel({
  isDeleting,
  isSaving,
  onDelete,
}: LibraryDrawerDeletePanelProps) {
  return (
    <div className={styles.dangerPanel}>
      <div className={styles.stackText}>
        <strong>删除媒体库</strong>
        <span className={styles.mutedText}>删除后会移除当前媒体库及其来源绑定，已有内容将不再出现在前台浏览视图。</span>
      </div>
      <div className={styles.rowActions}>
        <button
          className={styles.dangerButton}
          type="button"
          onClick={onDelete}
          disabled={isSaving || isDeleting}
        >
          删除媒体库
        </button>
      </div>
    </div>
  );
}

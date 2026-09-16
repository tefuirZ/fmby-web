/** 合集新建/编辑表单（V1F 拆分：ManageCollectionsPage → 子组件）。 */

import { Dialog } from '@fmby/v2-shared/ui';
import type { CollectionVisibility } from '@fmby/v2-shared/contracts/manage/peripherals';
import styles from '../../longtail-shared/ManageShared.module.css';

export interface CollectionFormState {
  title: string;
  overview: string;
  posterUrl: string;
  visibility: CollectionVisibility;
}

interface CollectionFormDialogProps {
  open: boolean;
  editing: boolean;
  editingTitle?: string;
  formState: CollectionFormState;
  pending: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onFormStateChange: (next: CollectionFormState) => void;
}

export function CollectionFormDialog({
  open,
  editing,
  editingTitle,
  formState,
  pending,
  onClose,
  onSubmit,
  onFormStateChange,
}: CollectionFormDialogProps) {
  return (
  <Dialog
    open={open}
    eyebrow={editing ? '编辑合集' : '新建合集'}
    title={editing ? `编辑：${editingTitle}` : '新建手工合集'}
    description="标题必填；可见性决定合集是否在浏览面出现。"
    onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}
    footer={
      <>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => onClose()}
          disabled={pending}
        >
          取消
        </button>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={onSubmit}
          disabled={pending || formState.title.trim().length === 0}
        >
          {pending ? '保存中…' : editing ? '保存修改' : '创建合集'}
        </button>
      </>
    }
  >
    <div className={styles.fieldGroup}>
      <label className={styles.label}>
        标题（必填，最长 512 字）
        <input
          className={styles.input}
          value={formState.title}
          maxLength={512}
          onChange={(e) => onFormStateChange({ ...formState, title: e.target.value })}
          placeholder="例如：科幻经典补完计划"
        />
      </label>
      <div className={styles.fieldRow}>
        <label className={styles.label}>
          可见性
          <select
            className={styles.select}
            value={formState.visibility}
            onChange={(e) =>
              onFormStateChange({ ...formState, visibility: e.target.value as CollectionVisibility })
            }
          >
            <option value="Active">Active（对外可见）</option>
            <option value="Hidden">Hidden（隐藏）</option>
          </select>
        </label>
        <label className={styles.label}>
          海报地址（可选，最长 512 字）
          <input
            className={styles.input}
            value={formState.posterUrl}
            maxLength={512}
            onChange={(e) => onFormStateChange({ ...formState, posterUrl: e.target.value })}
            placeholder="https://…"
          />
        </label>
      </div>
      <label className={styles.label}>
        简介（可选，最长 2000 字）
        <textarea
          className={styles.textarea}
          rows={4}
          value={formState.overview}
          maxLength={2000}
          onChange={(e) => onFormStateChange({ ...formState, overview: e.target.value })}
          placeholder="这个合集收录了什么、按什么顺序看。"
        />
      </label>
    </div>
  </Dialog>

  );
}

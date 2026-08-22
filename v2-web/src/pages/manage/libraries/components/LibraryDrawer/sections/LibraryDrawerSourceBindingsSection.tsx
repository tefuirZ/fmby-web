import type { Dispatch, SetStateAction } from 'react';
import { Link } from 'react-router';
import type { ManageMountRecord } from '@/domains/manage';
import { ManageSectionCard } from '../../../../components';
import { nextScanPriority } from '../../../formUtils';
import type { LibraryFormState } from '../../../types';
import styles from '../../../../ManagePages.module.css';

interface LibraryDrawerSourceBindingsSectionProps {
  mode: 'create' | 'edit';
  formState: LibraryFormState;
  setFormState: Dispatch<SetStateAction<LibraryFormState>>;
  mounts: ManageMountRecord[];
  isSaving: boolean;
}

export function LibraryDrawerSourceBindingsSection({
  mode,
  formState,
  setFormState,
  mounts,
  isSaving,
}: LibraryDrawerSourceBindingsSectionProps) {
  const handleSourceBindingChange = (
    index: number,
    field: 'mountId' | 'subPath' | 'scanPriority',
    value: string | number,
  ) => {
    setFormState((prev) => ({
      ...prev,
      sourceBindings: prev.sourceBindings.map((binding, bindingIndex) =>
        bindingIndex === index
          ? { ...binding, [field]: field === 'scanPriority' ? Number(value) || 0 : value }
          : binding,
      ),
    }));
  };

  const handleRemoveSourceBinding = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      sourceBindings: prev.sourceBindings.filter((_, bindingIndex) => bindingIndex !== index),
    }));
  };

  const handleAddSourceBinding = () => {
    if (mounts.length === 0) return;
    setFormState((prev) => ({
      ...prev,
      sourceBindings: [
        ...prev.sourceBindings,
        { mountId: mounts[0]?.id ?? '', subPath: '', scanPriority: nextScanPriority(prev.sourceBindings) },
      ],
    }));
  };

  return (
    <ManageSectionCard
      title="来源绑定"
      description={
        mode === 'create' ? '一个媒体库可以绑定多个来源，数字越小优先级越高。' : '编辑时会整体替换当前来源绑定列表。'
      }
      actions={
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={handleAddSourceBinding}
          disabled={isSaving || mounts.length === 0}
        >
          添加来源
        </button>
      }
    >
      {mounts.length === 0 && mode === 'create' ? (
        <div className={styles.emptyInlineState}>
          <div className={styles.stackText}>
            <strong>当前没有可绑定的数据源</strong>
            <span className={styles.mutedText}>可以先创建媒体库，稍后再去数据源页补绑定。</span>
          </div>
          <div className={styles.rowActions}>
            <Link className={styles.smallButton} to="/manage/media/mounts">
              去管理来源
            </Link>
          </div>
        </div>
      ) : formState.sourceBindings.length === 0 ? (
        <div className={styles.emptyInlineState}>
          <div className={styles.stackText}>
            <strong>还没有绑定来源</strong>
            <span className={styles.mutedText}>点击"添加来源"后，可为该媒体库绑定多个 mount + 子路径。</span>
          </div>
        </div>
      ) : (
        <div className={styles.list}>
          {formState.sourceBindings.map((binding, index) => (
            <div key={binding.id ?? `${mode}-${index}`} className={styles.listItem}>
              <div className={styles.sourceRow}>
                <label className={styles.label}>
                  来源
                  <select
                    className={styles.select}
                    value={binding.mountId}
                    onChange={(event) => handleSourceBindingChange(index, 'mountId', event.target.value)}
                    disabled={isSaving}
                  >
                    <option value="">选择数据源</option>
                    {mounts.map((mount) => (
                      <option key={mount.id} value={mount.id}>
                        {mount.name} · {mount.typeLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.label}>
                  子路径
                  <input
                    className={styles.input}
                    value={binding.subPath}
                    onChange={(event) => handleSourceBindingChange(index, 'subPath', event.target.value)}
                    placeholder="留空表示来源根目录"
                    disabled={isSaving}
                  />
                </label>
                <label className={styles.label}>
                  扫描优先级
                  <input
                    className={styles.input}
                    type="number"
                    value={binding.scanPriority}
                    onChange={(event) => handleSourceBindingChange(index, 'scanPriority', Number(event.target.value))}
                    disabled={isSaving}
                  />
                </label>
                <div className={styles.rowActions}>
                  <button
                    className={styles.ghostButton}
                    type="button"
                    onClick={() => handleRemoveSourceBinding(index)}
                    disabled={isSaving}
                  >
                    移除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ManageSectionCard>
  );
}

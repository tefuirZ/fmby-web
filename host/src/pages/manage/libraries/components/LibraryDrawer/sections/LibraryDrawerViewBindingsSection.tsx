import type { ManageLibraryDetailRecord } from '@fmby/v2-shared/contracts/manage';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { ManageSectionCard, getManageStatusVariant } from '../../../../components';
import styles from '../../../../ManagePages.module.css';

interface LibraryDrawerViewBindingsSectionProps {
  currentDetail: ManageLibraryDetailRecord;
}

export function LibraryDrawerViewBindingsSection({ currentDetail }: LibraryDrawerViewBindingsSectionProps) {
  return (
    <ManageSectionCard title="来源绑定" description="展示 mount、子路径、优先级和来源能力。">
      {currentDetail.sourceBindings.length === 0 ? (
        <div className={styles.emptyInlineState}>当前还没有来源绑定。</div>
      ) : (
        <div className={styles.list}>
          {currentDetail.sourceBindings.map((binding) => (
            <div key={binding.id} className={styles.listItem}>
              <div className={styles.fieldGroup}>
                <div className={styles.inlineMeta}>
                  <span className={styles.primaryText}>{binding.mountName}</span>
                  <StatusBadge label={binding.mountStatus} variant={getManageStatusVariant(binding.mountStatus)} />
                  <span className={styles.metaText}>{binding.typeLabel}</span>
                </div>
                <div className={styles.stackText}>
                  <span className={styles.mutedText}>{binding.pathLabel}</span>
                  <span className={styles.mutedText}>扫描优先级：{binding.scanPriority}</span>
                </div>
                <div className={styles.chipRow}>
                  {binding.capabilities.length === 0 ? (
                    <span className={styles.mutedText}>未声明能力标签</span>
                  ) : (
                    binding.capabilities.map((capability) => (
                      <span key={`${binding.id}-${capability}`} className={styles.chip}>
                        {capability}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ManageSectionCard>
  );
}

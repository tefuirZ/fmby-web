import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { StatusBadge } from '@fmby/v2-shared/ui';
import type {
  NamingCleanupCustomTerm,
  NamingCleanupMatchMode,
} from '@fmby/v2-shared/contracts/manage/naming';
import { MATCH_MODE_OPTIONS } from '../helpers';
import sharedStyles from '../../longtail-shared/ManageShared.module.css';
import styles from '../../ManageNamingRulesPage.module.css';
import { ManageSectionCard } from '../../longtail-shared/components';

export function NamingRulesCustomTermsSection({
  customTerms,
  onAddCustomTerm,
  onUpdateCustomTerm,
  onRemoveCustomTerm,
}: {
  customTerms: NamingCleanupCustomTerm[];
  onAddCustomTerm: () => void;
  onUpdateCustomTerm: (termId: string, patch: Partial<NamingCleanupCustomTerm>) => void;
  onRemoveCustomTerm: (termId: string) => void;
}) {
  return (
    <ManageSectionCard
      title="自定义清洗词"
      description="专门收口你自己的命名规范。想按单词删还是按片段删，都在这儿控。"
      actions={
        <button className={sharedStyles.secondaryButton} onClick={onAddCustomTerm} type="button">
          <Plus size={16} />
          新增规则
        </button>
      }
    >
      {customTerms.length === 0 ? (
        <div className={styles.emptyPanel}>
          <ShieldCheck size={20} />
          <div>
            <strong>还没有自定义词</strong>
            <p>默认词能兜底，但真到运营场景，字幕组尾巴、站点标记、内部命名规范还是得你自己补。</p>
          </div>
        </div>
      ) : (
        <div className={styles.termList}>
          {customTerms.map((item, index) => (
            <article key={item.id} className={styles.termCard}>
              <div className={styles.termCardHeader}>
                <div>
                  <div className={styles.signalEyebrow}>规则 {index + 1}</div>
                  <strong>{item.term.trim() || '未命名规则'}</strong>
                </div>
                <div className={styles.termCardActions}>
                  <StatusBadge
                    label={item.enabled ? '启用中' : '已停用'}
                    variant={item.enabled ? 'success' : 'warning'}
                  />
                  <button
                    className={sharedStyles.dangerButton}
                    onClick={() => onRemoveCustomTerm(item.id)}
                    type="button"
                  >
                    <Trash2 size={16} />
                    删除
                  </button>
                </div>
              </div>

              <div className={styles.termGrid}>
                <label className={sharedStyles.label}>
                  词项
                  <input
                    className={sharedStyles.input}
                    placeholder="例如：YYeTs / WEB-DL / 内部压制组名"
                    value={item.term}
                    onChange={(event) =>
                      onUpdateCustomTerm(item.id, { term: event.target.value })
                    }
                  />
                </label>
                <label className={sharedStyles.label}>
                  分类
                  <input
                    className={sharedStyles.input}
                    placeholder="例如：release-group / source / custom"
                    value={item.category}
                    onChange={(event) =>
                      onUpdateCustomTerm(item.id, { category: event.target.value })
                    }
                  />
                </label>
              </div>

              <div className={styles.termGrid}>
                <label className={sharedStyles.label}>
                  命中模式
                  <select
                    className={sharedStyles.select}
                    value={item.matchMode}
                    onChange={(event) =>
                      onUpdateCustomTerm(item.id, {
                        matchMode: event.target.value as NamingCleanupMatchMode,
                      })
                    }
                  >
                    {MATCH_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className={sharedStyles.fieldHint}>
                    {MATCH_MODE_OPTIONS.find((option) => option.value === item.matchMode)?.hint}
                  </span>
                </label>
                <label className={sharedStyles.label}>
                  备注
                  <input
                    className={sharedStyles.input}
                    placeholder="例如：某字幕组统一后缀"
                    value={item.note ?? ''}
                    onChange={(event) =>
                      onUpdateCustomTerm(item.id, { note: event.target.value })
                    }
                  />
                </label>
              </div>

              <label className={sharedStyles.checkboxRow}>
                <input
                  className={sharedStyles.checkbox}
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(event) =>
                    onUpdateCustomTerm(item.id, { enabled: event.target.checked })
                  }
                />
                <span>
                  <strong>启用这条规则</strong>
                  <div className={sharedStyles.mutedText}>
                    停用后规则会保留在草稿里，但不参与实际清洗。
                  </div>
                </span>
              </label>
            </article>
          ))}
        </div>
      )}
    </ManageSectionCard>
  );
}

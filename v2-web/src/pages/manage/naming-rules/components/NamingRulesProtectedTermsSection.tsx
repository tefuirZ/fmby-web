import { Plus, ShieldCheck } from 'lucide-react';
import sharedStyles from '../../longtail-shared/ManageShared.module.css';
import styles from '../../ManageNamingRulesPage.module.css';
import { ManageSectionCard } from '../../longtail-shared/components';

export function NamingRulesProtectedTermsSection({
  protectedTermInput,
  onProtectedTermInputChange,
  onAddProtectedTerm,
  protectedTerms,
  onRemoveProtectedTerm,
}: {
  protectedTermInput: string;
  onProtectedTermInputChange: (value: string) => void;
  onAddProtectedTerm: () => void;
  protectedTerms: string[];
  onRemoveProtectedTerm: (term: string) => void;
}) {
  return (
    <ManageSectionCard
      title="保留词"
      description="保留词会优先保护你指定的内容，哪怕它同时命中了默认词或自定义词，也不会被删掉。"
    >
      <div className={styles.protectedComposer}>
        <label className={sharedStyles.label}>
          新增保留词
          <input
            className={sharedStyles.input}
            placeholder="例如：dc / 4k修复 / 国语"
            value={protectedTermInput}
            onChange={(event) => onProtectedTermInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onAddProtectedTerm();
              }
            }}
          />
        </label>
        <button className={sharedStyles.secondaryButton} onClick={onAddProtectedTerm} type="button">
          <Plus size={16} />
          加入保护
        </button>
      </div>

      {protectedTerms.length === 0 ? (
        <div className={styles.emptyPanel}>
          <ShieldCheck size={20} />
          <div>
            <strong>当前没有保留词</strong>
            <p>如果某些词经常被误删，就把它们钉在这里，别让默认规则瞎抡。</p>
          </div>
        </div>
      ) : (
        <div className={styles.tokenWall}>
          {protectedTerms.map((term) => (
            <button
              key={term}
              className={styles.protectedToken}
              onClick={() => onRemoveProtectedTerm(term)}
              type="button"
            >
              {term}
              <span>移除</span>
            </button>
          ))}
        </div>
      )}
    </ManageSectionCard>
  );
}

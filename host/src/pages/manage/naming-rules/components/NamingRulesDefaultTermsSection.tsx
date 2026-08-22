import clsx from 'clsx';
import { Sparkles } from 'lucide-react';
import sharedStyles from '../../longtail-shared/ManageShared.module.css';
import styles from '../../ManageNamingRulesPage.module.css';
import { ManageSectionCard } from '../../longtail-shared/components';

export function NamingRulesDefaultTermsSection({
  defaultSearch,
  onDefaultSearchChange,
  defaultTerms,
  filteredDefaultTerms,
  activeDefaultCount,
  disabledDefaultTermCount,
  disabledDefaultTermSet,
  protectedTermSet,
  onToggleDefaultTerm,
}: {
  defaultSearch: string;
  onDefaultSearchChange: (value: string) => void;
  defaultTerms: string[];
  filteredDefaultTerms: string[];
  activeDefaultCount: number;
  disabledDefaultTermCount: number;
  disabledDefaultTermSet: Set<string>;
  protectedTermSet: Set<string>;
  onToggleDefaultTerm: (term: string) => void;
}) {
  return (
    <ManageSectionCard
      title="默认噪音词"
      description="这是系统内置底盘。点一下就能把某个默认词踢出规则集，适合处理误伤。"
    >
      <div className={styles.defaultToolbar}>
        <label className={sharedStyles.label}>
          搜默认词
          <input
            className={sharedStyles.input}
            placeholder="搜 2160p / web / hdr / hevc"
            value={defaultSearch}
            onChange={(event) => onDefaultSearchChange(event.target.value)}
          />
        </label>
        <div className={styles.defaultSummary}>
          <span>默认词总数：{defaultTerms.length}</span>
          <span>启用中：{activeDefaultCount}</span>
          <span>已禁用：{disabledDefaultTermCount}</span>
        </div>
      </div>

      {filteredDefaultTerms.length === 0 ? (
        <div className={styles.emptyPanel}>
          <Sparkles size={20} />
          <div>
            <strong>没搜到匹配词</strong>
            <p>换个关键词，或者直接清空搜索框看全量默认词。</p>
          </div>
        </div>
      ) : (
        <div className={styles.defaultTokenGrid}>
          {filteredDefaultTerms.map((term) => {
            const disabled = disabledDefaultTermSet.has(term);
            const protectedTerm = protectedTermSet.has(term);
            return (
              <button
                key={term}
                className={clsx(
                  styles.defaultToken,
                  disabled && styles.defaultTokenDisabled,
                  protectedTerm && styles.defaultTokenProtected,
                )}
                onClick={() => onToggleDefaultTerm(term)}
                type="button"
              >
                <strong>{term}</strong>
                <span>{disabled ? '已禁用' : '参与清洗'}</span>
                {protectedTerm ? <em>保留词保护中</em> : null}
              </button>
            );
          })}
        </div>
      )}
    </ManageSectionCard>
  );
}

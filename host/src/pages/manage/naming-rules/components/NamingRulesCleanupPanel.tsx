/** 命名刮削页「清洗规则」折叠面板（V1F 拆分：ManageNamingRulesPage → 子组件）。 */

import { StatusBadge } from '@fmby/v2-shared/ui';
import styles from '../../ManageNamingRulesPage.module.css';
import { NamingRulesCustomTermsSection } from './NamingRulesCustomTermsSection';
import { NamingRulesDefaultTermsSection } from './NamingRulesDefaultTermsSection';
import { NamingRulesProtectedTermsSection } from './NamingRulesProtectedTermsSection';
import type {
  useNamingRulesPageState,
  useNamingRulesPageActions,
} from '../hooks';

type PageState = ReturnType<typeof useNamingRulesPageState>;
type PageActions = ReturnType<typeof useNamingRulesPageActions>;

interface NamingRulesCleanupPanelProps {
  cleanupPanelOpen: boolean;
  onCleanupPanelOpenChange: (open: boolean) => void;
  cleanupDefaultTermsOpen: boolean;
  onCleanupDefaultTermsOpenChange: (open: boolean) => void;
  draft: PageState['draft'];
  defaultSearch: string;
  onDefaultSearchChange: (value: string) => void;
  defaultTerms: string[];
  filteredDefaultTerms: string[];
  activeDefaultCount: number;
  disabledDefaultTermSet: Set<string>;
  protectedTermSet: Set<string>;
  protectedTermInput: string;
  onProtectedTermInputChange: (value: string) => void;
  onToggleDefaultTerm: PageActions['toggleDefaultTerm'];
  onAddCustomTerm: PageActions['addCustomTerm'];
  onUpdateCustomTerm: PageActions['updateCustomTerm'];
  onRemoveCustomTerm: PageActions['removeCustomTerm'];
  onAddProtectedTerm: PageActions['addProtectedTerm'];
  onRemoveProtectedTerm: PageActions['removeProtectedTerm'];
}

export function NamingRulesCleanupPanel(props: NamingRulesCleanupPanelProps) {
  const {
    cleanupPanelOpen,
    onCleanupPanelOpenChange,
    cleanupDefaultTermsOpen,
    onCleanupDefaultTermsOpenChange,
    draft,
    defaultSearch,
    onDefaultSearchChange,
    defaultTerms,
    filteredDefaultTerms,
    activeDefaultCount,
    disabledDefaultTermSet,
    protectedTermSet,
    protectedTermInput,
    onProtectedTermInputChange,
    onToggleDefaultTerm,
    onAddCustomTerm,
    onUpdateCustomTerm,
    onRemoveCustomTerm,
    onAddProtectedTerm,
    onRemoveProtectedTerm,
  } = props;
  return (
<details
  className={styles.collapseCard}
  open={cleanupPanelOpen}
  onToggle={(event) => onCleanupPanelOpenChange((event.currentTarget as HTMLDetailsElement).open)}
>
  <summary className={styles.collapseSummary}>
    <div>
      <div className={styles.signalEyebrow}>清洗规则</div>
      <strong>展开后再编辑默认词、自定义词和保留词</strong>
      <p>清洗规则继续保留，但不再把整页塞满。要改的时候再展开，页面才不至于像杂货铺。</p>
    </div>
    <StatusBadge
      label={cleanupPanelOpen ? '已展开' : '已折叠'}
      variant={cleanupPanelOpen ? 'info' : 'success'}
    />
  </summary>

  <div className={styles.collapseBody}>
    <details
      className={styles.collapseInner}
      open={cleanupDefaultTermsOpen}
      onToggle={(event) =>
        onCleanupDefaultTermsOpenChange((event.currentTarget as HTMLDetailsElement).open)
      }
    >
      <summary className={styles.collapseInnerSummary}>
        <strong>默认噪音词</strong>
        <span>
          启用中 {activeDefaultCount} 个，已禁用 {draft.cleanup.disabledDefaultTerms.length} 个
        </span>
      </summary>
      <div className={styles.collapseInnerBody}>
        <NamingRulesDefaultTermsSection
          defaultSearch={defaultSearch}
          onDefaultSearchChange={onDefaultSearchChange}
          defaultTerms={defaultTerms}
          filteredDefaultTerms={filteredDefaultTerms}
          activeDefaultCount={activeDefaultCount}
          disabledDefaultTermCount={draft.cleanup.disabledDefaultTerms.length}
          disabledDefaultTermSet={disabledDefaultTermSet}
          protectedTermSet={protectedTermSet}
          onToggleDefaultTerm={onToggleDefaultTerm}
        />
      </div>
    </details>

    <NamingRulesCustomTermsSection
      customTerms={draft.cleanup.customTerms}
      onAddCustomTerm={onAddCustomTerm}
      onUpdateCustomTerm={onUpdateCustomTerm}
      onRemoveCustomTerm={onRemoveCustomTerm}
    />
    <NamingRulesProtectedTermsSection
      protectedTermInput={protectedTermInput}
      onProtectedTermInputChange={onProtectedTermInputChange}
      onAddProtectedTerm={onAddProtectedTerm}
      protectedTerms={draft.cleanup.protectedTerms}
      onRemoveProtectedTerm={onRemoveProtectedTerm}
    />
  </div>
</details>
  );
}

import { StatusBadge } from '@fmby/v2-shared/ui';
import disclosureStyles from '../MountDrawer.module.css';

interface AdvancedSectionWrapperProps {
  advancedOpen: boolean;
  setAdvancedOpen: (open: boolean) => void;
  children: React.ReactNode;
}

export function AdvancedSectionWrapper({
  advancedOpen,
  setAdvancedOpen,
  children,
}: AdvancedSectionWrapperProps) {
  return (
    <details
      className={disclosureStyles.advancedDetails}
      open={advancedOpen}
      onToggle={(event) =>
        setAdvancedOpen((event.currentTarget as HTMLDetailsElement).open)
      }
    >
      <summary className={disclosureStyles.advancedSummary}>
        <span className={disclosureStyles.advancedSummaryText}>
          <strong>高级选项</strong>
          <span className={disclosureStyles.advancedSummaryHint}>
            能力声明、保留配置和技术细节都留在当前抽屉里，不会再被拆到全局高级页。
          </span>
        </span>
        <StatusBadge
          label={advancedOpen ? '已展开' : '已折叠'}
          variant={advancedOpen ? 'info' : 'neutral'}
        />
      </summary>
      <div className={disclosureStyles.advancedBody}>{children}</div>
    </details>
  );
}

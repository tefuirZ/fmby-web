import type { ManageLibraryDetailRecord } from '@fmby/v2-shared/contracts/manage';
import { ManageSectionCard } from '../../../../components';
import styles from '../../../../ManagePages.module.css';

interface LibraryDrawerViewSourcesSectionProps {
  currentDetail: ManageLibraryDetailRecord;
}

export function LibraryDrawerViewSourcesSection({ currentDetail }: LibraryDrawerViewSourcesSectionProps) {
  return (
    <ManageSectionCard
      title="实际媒体来源"
      description="这里按库内资源真实挂着的 media_sources 聚合，不等于当前来源绑定。"
    >
      {currentDetail.library.actualSourceNames.length === 0 ? (
        <div className={styles.emptyInlineState}>当前没有发现实际媒体来源。</div>
      ) : (
        <div className={styles.chipRow}>
          {currentDetail.library.actualSourceNames.map((sourceName) => (
            <span key={`${currentDetail.library.id}-${sourceName}`} className={styles.chip}>
              {sourceName}
            </span>
          ))}
        </div>
      )}
    </ManageSectionCard>
  );
}

import type { ManageMountDetailRecord } from '@/domains/manage';
import { ManageSectionCard } from '../../../../components';
import styles from '../../../../ManagePages.module.css';

interface MountPathPoliciesViewSectionProps {
  currentDetail: ManageMountDetailRecord;
}

export function MountPathPoliciesViewSection({
  currentDetail,
}: MountPathPoliciesViewSectionProps) {
  return (
    <ManageSectionCard
      title="路径级高级策略"
      description="留空表示整源都走默认选源。只有你真要做来源优先级或并发分流时，这里才会有内容。"
    >
      {currentDetail.pathPolicies.length === 0 ? (
        <div className={styles.emptyInlineState}>
          当前没有高级路径策略，系统会直接按默认顺序选可播放来源。
        </div>
      ) : (
        <div className={styles.entityGrid}>
          {currentDetail.pathPolicies.map((policy) => (
            <article key={policy.id} className={styles.entityCard}>
              <span className={styles.mutedText}>
                路径：{policy.pathPrefix || '整个数据源根目录'}
              </span>
              <strong>优先级 {policy.priority}</strong>
              <span className={styles.mutedText}>
                {policy.maxConcurrentStreams
                  ? `最大同时播放 ${policy.maxConcurrentStreams}`
                  : '不限制同时播放数'}
              </span>
            </article>
          ))}
        </div>
      )}
    </ManageSectionCard>
  );
}

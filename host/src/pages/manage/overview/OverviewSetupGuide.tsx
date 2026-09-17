/** 首次配置引导视图（V1F 拆分：ManageOverviewPage → 子组件）。 */

import { RefreshCw } from 'lucide-react';
import { Link } from 'react-router';
import { InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import type { BannerState } from '@fmby/v2-shared/ui/types';
import { mapSetupStepStatusLabel, mapSetupStepStatusVariant } from '../setup-guide';
import type { buildSetupGuide } from '../setup-guide';
import styles from '../ManagePages.module.css';
import guideStyles from '../ManageOnboarding.module.css';
import { ManagePageHeader, ManageSectionCard } from '../components';

interface OverviewSetupGuideProps {
  guide: ReturnType<typeof buildSetupGuide>;
  banner: BannerState | null;
  onRefresh: () => void;
}

export function OverviewSetupGuide({ guide, banner, onRefresh }: OverviewSetupGuideProps) {
  return (
  <div className={styles.page}>
    <ManagePageHeader
      title="先把媒体站跑起来"
      description="第一次进后台别先盯着统计，先把来源、媒体库、刮削和入库主链路走通。"
      meta={
        <StatusBadge
          label={`${guide.completedSteps} / ${guide.totalSteps} 步已完成`}
          variant="info"
        />
      }
      actions={
        <>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={onRefresh}
          >
            <RefreshCw size={16} />
            刷新状态
          </button>
          <Link className={styles.primaryButton} to="/manage/media/add">
            打开完整引导
          </Link>
        </>
      }
    />

    {banner ? (
      <InlineBanner
        variant={banner.variant}
        title={banner.title}
        description={banner.description}
      />
    ) : null}

    <ManageSectionCard
      title="按这个顺序走，最省心"
      description="每一步都带你去对应页面，不用先学会后台结构。"
    >
      <div className={guideStyles.stepGrid}>
        {guide.steps.map((step, index) => (
          <article
            key={step.id}
            className={guideStyles.stepCard}
            data-state={step.state}
          >
            <div className={guideStyles.stepHeader}>
              <div className={styles.stackText}>
                <span className={guideStyles.stepIndex}>{index + 1}</span>
                <strong className={guideStyles.stepTitle}>{step.title}</strong>
              </div>
              <StatusBadge
                label={mapSetupStepStatusLabel(step.state)}
                variant={mapSetupStepStatusVariant(step.state)}
              />
            </div>
            <p className={guideStyles.stepDescription}>{step.description}</p>
            <div className={guideStyles.stepActions}>
              <Link className={styles.primaryButton} to={step.to}>
                {step.actionLabel}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </ManageSectionCard>
  </div>
  );
}

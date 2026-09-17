/** 注册码页头部 + 指标板 + 横幅（V1F 拆分：ManageRegistrationCodesPage → 子组件）。 */

import { InlineBanner } from '@fmby/v2-shared/ui';
import type { BannerState } from '@fmby/v2-shared/ui/types';
import styles from '../../longtail-shared/ManageShared.module.css';
import { ManagePageHeader } from '../../longtail-shared/components';
import { RegistrationCodeMetricsBoard } from './RegistrationCodeMetricsBoard';

interface RegistrationCodeHeaderProps {
  batchCount: number;
  codeCount: number;
  totalAvailableCodes: number;
  totalUsedCodes: number;
  totalRestrictedCodes: number;
  banner: BannerState | null;
  actionErrorMessage: string | null;
}

export function RegistrationCodeHeader({
  batchCount,
  codeCount,
  totalAvailableCodes,
  totalUsedCodes,
  totalRestrictedCodes,
  banner,
  actionErrorMessage,
}: RegistrationCodeHeaderProps) {
  return (
    <>
      <ManagePageHeader
        title="注册码管理"
        description="批次化发码、共享码入口和单码明细都收在一个工作台里，窄屏也别再靠横向滚动硬撑。"
        meta={
          <span className={styles.metaText}>
            当前共 {batchCount} 个批次，{codeCount} 条注册码
          </span>
        }
      />

      <RegistrationCodeMetricsBoard
        metrics={{
          totalBatches: batchCount,
          totalCodes: codeCount,
          totalAvailableCodes,
          totalUsedCodes,
          totalRestrictedCodes,
        }}
      />

      {banner ? (
        <InlineBanner variant={banner.variant} title={banner.title} description={banner.description} />
      ) : null}

      {actionErrorMessage ? (
        <InlineBanner variant="error" title="注册码操作失败" description={actionErrorMessage} />
      ) : null}
    </>
  );
}

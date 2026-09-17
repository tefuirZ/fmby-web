/** 授权服务未装配时的 fail-closed 引导态（V1F 拆分：ManageLicensePage → 子组件）。 */

import { InlineBanner } from '@fmby/v2-shared/ui';
import styles from '../ManagePages.module.css';
import { ManagePageHeader, ManageSectionCard } from '../longtail-shared/components';

interface LicenseUnwiredPanelProps {
  onRetry: () => void;
}

export function LicenseUnwiredPanel({ onRetry }: LicenseUnwiredPanelProps) {
  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="授权与订阅"
        description="查看实例授权状态、租约与心跳，发起设备流或一次性凭据激活。"
      />
      <ManageSectionCard title="授权服务未装配" description="后端授权端点尚未提供，本页以只读引导态呈现。">
        <InlineBanner
          variant="info"
          title="等待后端装配"
          description="授权与订阅端点尚未就绪。后端按本页冻结的契约实现后，这里会展示实例激活、租约与心跳信息。"
        />
        <button className={styles.secondaryButton} type="button" onClick={onRetry}>
          重新检测
        </button>
      </ManageSectionCard>
    </div>
  );
}

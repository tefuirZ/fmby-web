/**
 * 付费能力守卫（W5-G 卡③：照 V1 `pages/manage/ManagePaidFeatureGuard.tsx` 对位）。
 *
 * 未授权时给出「需进阶版 + 去激活」引导，交互模型照 V1 不变：
 * warning FeedbackState + 「查看授权与订阅」/「返回管理首页」两个入口。
 *
 * 数据源差异（V2 无 bootstrap）：可见性来自 `GET /manage/license/status` 查询，
 * 加载中显示 loading；查询失败或无数据时 fail-closed 为未授权（照 V1「无 license
 * 载荷 → FREE」语义）。
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { isPaidFeatureEnabled } from '@/featureFlags';
import { useLicenseStatusQuery } from '@/pages/manage/license/hooks/useLicenseQueries';
import styles from './longtail-shared/ManageShared.module.css';

interface ManagePaidFeatureGuardProps {
  /** 单个 surface 或任一命中即可（照 V1 的 `string | string[]`）。 */
  feature: string | string[];
  title: string;
  description: string;
  children: ReactNode;
}

export function ManagePaidFeatureGuard({
  feature,
  title,
  description,
  children,
}: ManagePaidFeatureGuardProps) {
  const statusQuery = useLicenseStatusQuery();

  if (statusQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在校验授权"
        description="正在读取实例授权与能力可见性。"
      />
    );
  }

  const enabled = isPaidFeatureEnabled(statusQuery.data, feature);

  if (!enabled) {
    return (
      <FeedbackState
        variant="warning"
        title={title}
        description={description}
        action={
          <div className={styles.buttonRow}>
            <Link className={styles.secondaryButton} to="/manage/site/license">
              查看授权与订阅
            </Link>
            <Link className={styles.smallButton} to="/manage">
              返回管理首页
            </Link>
          </div>
        }
      />
    );
  }

  return <>{children}</>;
}

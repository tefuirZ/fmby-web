/**
 * 微软账号与 OAuth 管理页（FE-PARITY-MICROSOFT）。
 *
 * 页面自己持有两个 query（config-status / profiles），下发给各区块，避免重复请求。
 * 三态：loading / empty / error 都有显式呈现，不白屏、不吐原始错误对象。
 */

import { useQuery } from '@tanstack/react-query';
import { microsoftApi } from '@fmby/v2-shared/contracts/manage/microsoft';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../longtail-shared/ManageShared.module.css';
import { ManagePageHeader } from '../longtail-shared/components';
import { MicrosoftAccountsSection } from './MicrosoftAccountsSection';
import { MicrosoftOAuthSection } from './MicrosoftOAuthSection';
import { MicrosoftAccountActionsSection } from './MicrosoftAccountActionsSection';

export function ManageMicrosoftPage() {
  const configQuery = useQuery({
    queryKey: queryKeys.manage.microsoft.configStatus(),
    queryFn: () => microsoftApi.getAppConfigStatus(),
  });

  const profilesQuery = useQuery({
    queryKey: queryKeys.manage.microsoft.profiles(),
    queryFn: () => microsoftApi.listAuthProfiles(),
  });

  const isPending = configQuery.isPending || profilesQuery.isPending;
  const error = configQuery.error ?? profilesQuery.error;

  function refetchAll() {
    void configQuery.refetch();
    void profilesQuery.refetch();
  }

  if (isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载微软账号"
        description="正在读取应用凭据配置状态与已授权账号。"
      />
    );
  }

  if (error) {
    return (
      <FeedbackState
        variant="error"
        title="微软账号加载失败"
        description={getErrorMessage(error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={refetchAll}>
            重试
          </button>
        }
      />
    );
  }

  const configItems = configQuery.data ?? [];
  const profiles = profilesQuery.data ?? [];

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="微软账号与 OAuth"
        description="自建应用凭据状态、授权码流 / token 流绑定、账号启用停用与删除。"
        meta={
          <span className={styles.metaText}>
            令牌仅在内存中传递，不落本地存储与 URL
          </span>
        }
        actions={
          <button className={styles.secondaryButton} type="button" onClick={refetchAll}>
            刷新
          </button>
        }
      />
      <MicrosoftAccountsSection configItems={configItems} profiles={profiles} />
      <MicrosoftOAuthSection />
      <MicrosoftAccountActionsSection accounts={profiles} isPending={false} />
    </div>
  );
}

export default ManageMicrosoftPage;

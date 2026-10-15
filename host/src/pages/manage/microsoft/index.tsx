/**
 * 微软账号与 OAuth 管理页（FE-PARITY-MICROSOFT）。
 *
 * ★FE-LICENSE-GATED-MODULES：微软账号属付费能力（后端 license_gate 把 /manage/microsoft/auth/
 *   映射到 FEATURE_STORAGE_MICROSOFT_PROVIDER，未激活 fail-closed 403）。用可复用
 *   ManagePaidFeatureGuard 门控——未授权时 Content 不挂载 ⇒ 不发 /manage/microsoft/auth/*
 *   请求、不显裸 403，改显「需要授权」引导（去许可管理）。
 *
 * 结构（照 ManageUpstreamsPage / ManageRegistrationCodesPage 范式）：
 *  - ManageMicrosoftPageContent：持有两个 query（config-status / profiles），下发给各区块。
 *  - ManageMicrosoftPage：外层 ManagePaidFeatureGuard feature="microsoft" 包裹 Content。
 *
 * 三态：loading / empty / error 均有显式呈现，不白屏、不吐原始错误对象。
 */

import { useQuery } from '@tanstack/react-query';
import { microsoftApi } from '@fmby/v2-shared/contracts/manage/microsoft';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { getErrorMessage, isForbiddenError } from '@fmby/v2-shared/errors';
import styles from '../longtail-shared/ManageShared.module.css';
import { ManagePageHeader } from '../longtail-shared/components';
import { ManagePaidFeatureGuard } from '../ManagePaidFeatureGuard';
import { MicrosoftAccountsSection } from './MicrosoftAccountsSection';
import { MicrosoftOAuthSection } from './MicrosoftOAuthSection';
import { MicrosoftAccountActionsSection } from './MicrosoftAccountActionsSection';

/** 内容体（持有 queries）：仅当外层付费守卫放行时才挂载 ⇒ 未授权不发付费端点请求。 */
export function ManageMicrosoftPageContent() {
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
    // FE-LICENSE-GATED-MODULES ②：403（许可门未激活 / 能力不足）按「需要授权」语义呈现，
    // 不弹通用「加载失败」——避免让人以为账号坏（实为实例许可未激活，去激活即可）。
    const forbidden = isForbiddenError(error);
    return (
      <FeedbackState
        variant={forbidden ? 'warning' : 'error'}
        title={forbidden ? '此功能需要授权' : '微软账号加载失败'}
        description={
          forbidden
            ? '微软账号与 OAuth 属于付费能力，当前可能未授权或权限不足。请在「授权与订阅」中激活后重试。'
            : getErrorMessage(error)
        }
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

/** 页面入口：付费守卫门控。未授权 ⇒ 「需要授权」引导，Content 不挂载（不发付费请求）。 */
export function ManageMicrosoftPage() {
  return (
    <ManagePaidFeatureGuard
      feature="microsoft"
      title="微软账号需要授权"
      description="微软账号与 OAuth 属于付费能力。当前实例许可未激活时该模块不可用——激活后即可管理自建应用凭据与账号绑定。"
    >
      <ManageMicrosoftPageContent />
    </ManagePaidFeatureGuard>
  );
}

export default ManageMicrosoftPage;

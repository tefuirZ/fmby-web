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
import { useLicenseStatusQuery } from '../license/hooks/useLicenseQueries';
import { isPaidFeatureEnabled } from '@/featureFlags';
import { MicrosoftAccountsSection } from './MicrosoftAccountsSection';
import { MicrosoftOAuthSection } from './MicrosoftOAuthSection';
import { MicrosoftAccountActionsSection } from './MicrosoftAccountActionsSection';

/** 内容体（持有 queries）：仅当外层付费守卫放行时才挂载 ⇒ 未授权不发付费端点请求。 */
export function ManageMicrosoftPageContent() {
  // ★内层守卫（#2032 配套）：外层是 provider 级（'microsoft'），但后端
  //   MS-ACCOUNT-POOL-GATE 把**池面族 19 条路由**（profiles / auth start、complete、
  //   token/import / accounts/*）单独挂 `feature.storage.microsoft.account_pool`
  //   （license_gate.rs ：122-128）⇒ provider 已授权、池未购的用户会吃 403。
  //   这里按可见性：① profiles 查询 `enabled` 闸（不发 403 噪音）；② 三个
  //   section（列表/OAuth/操作 —— 全是池面，config-status 随列表块展示）包进
  //   ManagePaidFeatureGuard 呈现「需进阶版」引导（不挂载 ⇒ 不发请求）。
  const statusQuery = useLicenseStatusQuery();
  const poolEnabled = isPaidFeatureEnabled(statusQuery.data, 'microsoft-account-pool');

  const configQuery = useQuery({
    queryKey: queryKeys.manage.microsoft.configStatus(),
    queryFn: () => microsoftApi.getAppConfigStatus(),
  });

  const profilesQuery = useQuery({
    queryKey: queryKeys.manage.microsoft.profiles(),
    queryFn: () => microsoftApi.listAuthProfiles(),
    // 内层守卫配套：池不可见时不发 profiles（后端池面族 403）。
    // 注意 react-query v5 禁用查询恒 isPending ⇒ 下方 loading 闸需配合 poolEnabled。
    enabled: poolEnabled,
  });

  const isPending = configQuery.isPending || (poolEnabled && profilesQuery.isPending);
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
      {/* ★内层守卫（#2032 配套）：三个 section 全是池面（后端池面族 19 条路由）。
          池不可见时 Guard 呈现「需进阶版」引导，children 不挂载 ⇒ 不发请求。 */}
      <ManagePaidFeatureGuard
        feature="microsoft-account-pool"
        title="微软账号池需要授权"
        description="账号池（列表 / OAuth 授权 / 启停删除）属于付费能力（microsoft-account-pool）。当前实例许可未包含账号池时不可用。"
      >
        <MicrosoftAccountsSection configItems={configItems} profiles={profiles} />
        <MicrosoftOAuthSection />
        <MicrosoftAccountActionsSection accounts={profiles} isPending={false} />
      </ManagePaidFeatureGuard>
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

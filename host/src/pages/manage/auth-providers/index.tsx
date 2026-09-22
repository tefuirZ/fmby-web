/**
 * 登录提供方配置页（FE-PARITY-AUTH-PROVIDERS）。
 *
 * 消费此前零消费的 3 个端点：
 *  - GET  /api/manage/auth-providers
 *  - PUT  /api/manage/auth-providers
 *  - POST /api/manage/auth-providers/{provider}/diagnostics
 *
 * 三态：loading / empty / error 均显式呈现，不白屏、不吐原始错误对象。
 */

import { ManagePageHeader } from '@/pages/manage/longtail-shared/components';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';
import { AuthProvidersSection } from './AuthProvidersSection';

export function ManageAuthProvidersPage() {
  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="登录提供方"
        description="配置各登录/绑定/找回密码通道的开关与凭据，并可做配置自检。密钥只显示哪些字段已配置，不回显明文。"
        meta={<span className={styles.metaText}>需要 manage:settings 能力</span>}
      />

      <AuthProvidersSection />
    </div>
  );
}

export default ManageAuthProvidersPage;

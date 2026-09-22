/**
 * 微软账号与 OAuth（FE-PARITY-MICROSOFT）。
 *
 * 端点：GET /api/manage/microsoft/auth/config-status、GET .../profiles
 * 三态：loading / empty / error 均显式呈现，不白屏、不吐原始错误对象。
 */

import type { MicrosoftAppConfigStatusRecord, MicrosoftAuthAccountRecord } from '@fmby/v2-shared/contracts/manage/microsoft';
import { StatusBadge } from '@fmby/v2-shared/ui';
import styles from '../longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '../longtail-shared/components';

interface MicrosoftAccountsSectionProps {
  configItems: MicrosoftAppConfigStatusRecord[];
  profiles: MicrosoftAuthAccountRecord[];
}

export function MicrosoftAccountsSection({
  configItems,
  profiles,
}: MicrosoftAccountsSectionProps) {
  return (
    <>
      <ManageSectionCard
        title="应用凭据配置状态"
        description="自建应用 client_id / client_secret 是否就绪，以及令牌加密键状态。"
      >
        {configItems.length === 0 ? (
          <div className={styles.emptyInlineState}>后端未返回任何 provider 配置状态。</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>client_id</th>
                  <th>client_secret</th>
                  <th>回跳地址</th>
                  <th>来源</th>
                  <th>令牌键</th>
                </tr>
              </thead>
              <tbody>
                {configItems.map((item) => (
                  <tr key={item.providerType}>
                    <td>{item.providerType}</td>
                    <td>
                      <StatusBadge
                        label={item.clientIdConfigured ? '已配置' : '未配置'}
                        variant={item.clientIdConfigured ? 'success' : 'warning'}
                      />
                    </td>
                    <td>
                      <StatusBadge
                        label={item.clientSecretConfigured ? '已配置' : '未配置'}
                        variant={item.clientSecretConfigured ? 'success' : 'warning'}
                      />
                    </td>
                    <td className={styles.mono}>{item.redirectUri}</td>
                    <td>{item.clientIdSource}</td>
                    <td>
                      <StatusBadge
                        label={item.tokenKeyStatus}
                        variant={item.tokenKeyStatus === 'ready' ? 'success' : 'danger'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ManageSectionCard>

      <ManageSectionCard
        title={`已授权账号（${profiles.length}）`}
        description="账号状态、主体与最近错误；令牌不在管理面回显。"
      >
        {profiles.length === 0 ? (
          <div className={styles.emptyInlineState}>还没有任何已授权账号。</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>标识</th>
                  <th>类型</th>
                  <th>服务</th>
                  <th>状态</th>
                  <th>主体</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((account) => (
                  <tr key={account.id}>
                    <td className={styles.mono}>{account.userPrincipalName ?? account.principalId ?? '—'}</td>
                    <td>{account.providerType}</td>
                    <td>{account.serviceKind}</td>
                    <td>
                      <StatusBadge
                        label={account.status}
                        variant={account.status === 'active' ? 'success' : 'neutral'}
                      />
                    </td>
                    <td>{account.displayName ?? '—'}</td>
                    <td>{account.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ManageSectionCard>
    </>
  );
}

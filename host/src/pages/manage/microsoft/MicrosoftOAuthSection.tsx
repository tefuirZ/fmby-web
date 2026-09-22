/**
 * 微软 OAuth 授权码流 + token 流（FE-PARITY-MICROSOFT）。
 *
 * 端点：POST .../auth/start、/complete、/token/start、/token/complete、
 *       /token/drives、/token/sites、/token/import
 *
 * ★凭据口径（沿用 FE-CRUD-SECURITY-AUDIT）：token/complete 返回的
 *   access_token / refresh_token 只保留在组件内存 state，用于即时回填下一步表单；
 *   严禁写入 localStorage / sessionStorage / URL / console。
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { microsoftApi } from '@fmby/v2-shared/contracts/manage/microsoft';
import type {
  CompleteMicrosoftTokenAuthResult,
  MicrosoftDriveRecord,
  MicrosoftSiteRecord,
} from '@fmby/v2-shared/contracts/manage/microsoft';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '../longtail-shared/components';

export function MicrosoftOAuthSection() {
  const [providerType, setProviderType] = useState('global');
  const [tenantId, setTenantId] = useState('');
  const [driveId, setDriveId] = useState('');
  const [serviceKind, setServiceKind] = useState('onedrive');
  const [authorizationId, setAuthorizationId] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);
  const [tokenResult, setTokenResult] = useState<CompleteMicrosoftTokenAuthResult | null>(null);
  const [drives, setDrives] = useState<MicrosoftDriveRecord[]>([]);
  const [sites, setSites] = useState<MicrosoftSiteRecord[]>([]);
  const [siteQuery, setSiteQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function resetError() {
    setError(null);
    setNotice(null);
  }

  const startMutation = useMutation({
    mutationFn: () =>
      microsoftApi.startAuth({
        providerType,
        tenantId: tenantId.trim(),
        driveId: driveId.trim(),
        serviceKind,
      }),
    onSuccess: (res) => {
      resetError();
      setAuthorizationId(res.authorizationId);
      setAuthorizeUrl(res.authorizeUrl);
      setNotice('已生成授权链接，请在浏览器中完成授权后粘贴回调 URL。');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const completeMutation = useMutation({
    mutationFn: () => microsoftApi.completeAuth({ authorizationId, callbackUrl: callbackUrl.trim() }),
    onSuccess: (res) => {
      resetError();
      setNotice(`授权完成，账号状态：${res.status}`);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const startTokenMutation = useMutation({
    mutationFn: () => microsoftApi.startTokenAuth({ providerType, serviceKind }),
    onSuccess: (res) => {
      resetError();
      setAuthorizationId(res.authorizationId);
      setAuthorizeUrl(res.authorizeUrl);
      setNotice('已生成 token 授权链接。');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const completeTokenMutation = useMutation({
    mutationFn: () => microsoftApi.completeTokenAuth({ authorizationId, callbackUrl: callbackUrl.trim() }),
    onSuccess: (res) => {
      resetError();
      // ★仅内存保留，不持久化
      setTokenResult(res);
      setNotice('已取得令牌（仅本次会话内存保留，刷新即失效）。');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const drivesMutation = useMutation({
    mutationFn: () =>
      microsoftApi.listTokenDrives({
        providerType,
        accessToken: tokenResult?.accessToken,
      }),
    onSuccess: (items) => {
      resetError();
      setDrives(items);
      if (items.length === 0) {
        setNotice('该令牌下没有可用 drive。');
      }
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const sitesMutation = useMutation({
    mutationFn: () =>
      microsoftApi.searchTokenSites({
        providerType,
        q: siteQuery.trim(),
        accessToken: tokenResult?.accessToken,
      }),
    onSuccess: (items) => {
      resetError();
      setSites(items);
      if (items.length === 0) {
        setNotice('未搜索到匹配的站点。');
      }
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const importMutation = useMutation({
    mutationFn: () =>
      microsoftApi.importTokenAccount({
        providerType,
        serviceKind,
        driveId: driveId.trim(),
        accessToken: tokenResult?.accessToken,
        refreshToken: tokenResult?.refreshToken ?? undefined,
        tenantId: tenantId.trim() || undefined,
      }),
    onSuccess: (account) => {
      resetError();
      setNotice(`已导入账号 ${account.id}（状态 ${account.status}）。`);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const pending =
    startMutation.isPending ||
    completeMutation.isPending ||
    startTokenMutation.isPending ||
    completeTokenMutation.isPending ||
    drivesMutation.isPending ||
    sitesMutation.isPending ||
    importMutation.isPending;

  return (
    <>
      <ManageSectionCard
        title="OAuth 授权"
        description="授权码流：发起授权 → 浏览器完成 → 粘贴回调 URL 完成绑定。token 流用于先取令牌再导入。"
      >
        {error ? <InlineBanner variant="error" title="操作失败" description={error} /> : null}
        {notice ? <InlineBanner variant="success" title={notice} /> : null}

        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              Provider
              <select className={styles.select} value={providerType} onChange={(e) => setProviderType(e.target.value)}>
                <option value="global">global</option>
                <option value="china_21vianet">china_21vianet</option>
              </select>
            </label>
            <label className={styles.label}>
              服务类型
              <select className={styles.select} value={serviceKind} onChange={(e) => setServiceKind(e.target.value)}>
                <option value="onedrive">onedrive</option>
                <option value="sharepoint">sharepoint</option>
              </select>
            </label>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              租户 ID（tenantId）
              <input className={styles.input} value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
            </label>
            <label className={styles.label}>
              驱动器 ID（driveId）
              <input className={styles.input} value={driveId} onChange={(e) => setDriveId(e.target.value)} />
            </label>
          </div>
          <div className={styles.buttonRow}>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={pending || driveId.trim().length === 0}
              onClick={() => startMutation.mutate()}
            >
              发起授权码流
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={pending}
              onClick={() => startTokenMutation.mutate()}
            >
              发起 token 流
            </button>
          </div>

          {authorizeUrl ? (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                授权链接（请在新标签页打开）
                <input className={styles.input} readOnly value={authorizeUrl} />
              </label>
              <label className={styles.label}>
                authorizationId
                <input className={styles.input} readOnly value={authorizationId} />
              </label>
              <label className={styles.label}>
                回调 URL（授权后浏览器地址栏整串粘贴）
                <input
                  className={styles.input}
                  value={callbackUrl}
                  onChange={(e) => setCallbackUrl(e.target.value)}
                  placeholder="http://localhost/cb?code=…"
                />
              </label>
              <div className={styles.buttonRow}>
                <button
                  className={styles.primaryButton}
                  type="button"
                  disabled={pending || authorizationId.length === 0 || callbackUrl.trim().length === 0}
                  onClick={() => completeMutation.mutate()}
                >
                  完成授权码流
                </button>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  disabled={pending || authorizationId.length === 0 || callbackUrl.trim().length === 0}
                  onClick={() => completeTokenMutation.mutate()}
                >
                  换取令牌
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </ManageSectionCard>

      {tokenResult ? (
        <ManageSectionCard
          title="令牌后续操作"
          description="令牌仅保留在内存中，用于列举 drive / 搜索站点 / 导入账号；页面刷新即失效，不持久化。"
        >
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              站点搜索关键字
              <input className={styles.input} value={siteQuery} onChange={(e) => setSiteQuery(e.target.value)} />
            </label>
            <div className={styles.buttonRow}>
              <button className={styles.secondaryButton} type="button" disabled={pending} onClick={() => drivesMutation.mutate()}>
                列举 drive
              </button>
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={pending || siteQuery.trim().length === 0}
                onClick={() => sitesMutation.mutate()}
              >
                搜索站点
              </button>
              <button
                className={styles.primaryButton}
                type="button"
                disabled={pending || driveId.trim().length === 0}
                onClick={() => importMutation.mutate()}
              >
                导入账号
              </button>
            </div>
          </div>

          {drives.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>类型</th>
                    <th>ID</th>
                  </tr>
                </thead>
                <tbody>
                  {drives.map((drive) => (
                    <tr key={drive.id}>
                      <td>{drive.name ?? '—'}</td>
                      <td>{drive.driveType ?? '—'}</td>
                      <td className={styles.mono}>{drive.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {sites.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>显示名</th>
                    <th>ID</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((site) => (
                    <tr key={site.id}>
                      <td>{site.displayName ?? site.name ?? '—'}</td>
                      <td className={styles.mono}>{site.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </ManageSectionCard>
      ) : null}
    </>
  );
}

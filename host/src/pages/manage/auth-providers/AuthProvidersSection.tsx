/**
 * 登录提供方配置列表与保存（FE-PARITY-AUTH-PROVIDERS）。
 *
 * ★密钥口径：列表只显示「哪些密钥字段已配置」（后端 secret_fields_configured），
 *   不回显明文、不回显占位假值；要改动密钥走「重新填写」并标记清空/覆盖。
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authProvidersApi } from '@fmby/v2-shared/contracts/manage/authProviders';
import type {
  AuthProviderConfigViewRecord,
  AuthProviderConfigWriteInput,
} from '@fmby/v2-shared/contracts/manage/authProviders';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '@/pages/manage/longtail-shared/components';
import { ProviderDiagnosticsCard } from './ProviderDiagnosticsCard';

function toWriteInput(item: AuthProviderConfigViewRecord): AuthProviderConfigWriteInput {
  return {
    provider: item.provider,
    enabled: item.enabled,
    allowLogin: item.allowLogin,
    allowBinding: item.allowBinding,
    allowPasswordReset: item.allowPasswordReset,
    publicConfig: item.publicConfig,
  };
}

export function AuthProvidersSection() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<AuthProviderConfigWriteInput[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const configsQuery = useQuery({
    queryKey: queryKeys.manage.authProviders.configs(),
    queryFn: () => authProvidersApi.listConfigs(),
  });

  useEffect(() => {
    if (configsQuery.data && draft === null) {
      setDraft(configsQuery.data.items.map(toWriteInput));
    }
  }, [configsQuery.data, draft]);

  const saveMutation = useMutation({
    mutationFn: (items: AuthProviderConfigWriteInput[]) => authProvidersApi.replaceConfigs(items),
    onSuccess: (view) => {
      setError(null);
      setNotice('配置已保存（密钥经后端密封后落库）。');
      queryClient.setQueryData(queryKeys.manage.authProviders.configs(), view);
      setDraft(view.items.map(toWriteInput));
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  if (configsQuery.isPending) {
    return (
      <ManageSectionCard title="提供方配置" description="读取各登录通道配置。">
        <div className={styles.tableHint}>正在加载提供方配置…</div>
      </ManageSectionCard>
    );
  }

  if (configsQuery.isError) {
    return (
      <ManageSectionCard title="提供方配置" description="读取各登录通道配置。">
        <FeedbackState
          variant="error"
          title="提供方配置读取失败"
          description={getErrorMessage(configsQuery.error)}
          action={
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => void configsQuery.refetch()}
            >
              重试
            </button>
          }
        />
      </ManageSectionCard>
    );
  }

  const items = configsQuery.data?.items ?? [];
  const rows = draft ?? items.map(toWriteInput);

  function patch(index: number, patcher: Partial<AuthProviderConfigWriteInput>) {
    setDraft((current) =>
      (current ?? items.map(toWriteInput)).map((row, i) =>
        i === index ? { ...row, ...patcher } : row,
      ),
    );
  }

  return (
    <ManageSectionCard
      title={`提供方配置（${items.length}）`}
      description="开关控制登录 / 绑定 / 找回密码三个用途；密钥状态由后端给出，不回显明文。"
    >
      {error ? <InlineBanner variant="error" title="保存失败" description={error} /> : null}
      {notice ? <InlineBanner variant="success" title={notice} /> : null}

      {items.length === 0 ? (
        <div className={styles.emptyInlineState}>后端尚未返回任何登录提供方配置。</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>提供方</th>
                <th>启用</th>
                <th>登录</th>
                <th>绑定</th>
                <th>找回密码</th>
                <th>配置状态</th>
                <th>已配密钥字段</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const row = rows[index] ?? toWriteInput(item);
                return (
                  <tr key={item.provider}>
                    <td>{item.displayName || item.provider}</td>
                    <td>
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        checked={row.enabled}
                        aria-label={`启用 ${item.displayName || item.provider}`}
                        onChange={(e) => patch(index, { enabled: e.target.checked })}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        checked={row.allowLogin}
                        aria-label={`允许登录：${item.displayName || item.provider}`}
                        onChange={(e) => patch(index, { allowLogin: e.target.checked })}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        checked={row.allowBinding}
                        aria-label={`允许绑定：${item.displayName || item.provider}`}
                        onChange={(e) => patch(index, { allowBinding: e.target.checked })}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        checked={row.allowPasswordReset}
                        aria-label={`允许找回密码：${item.displayName || item.provider}`}
                        onChange={(e) => patch(index, { allowPasswordReset: e.target.checked })}
                      />
                    </td>
                    <td>
                      <StatusBadge
                        label={item.configured ? '已配置' : '未配置'}
                        variant={item.configured ? 'success' : 'warning'}
                      />
                    </td>
                    <td className={styles.mono}>
                      {item.secretFieldsConfigured.length === 0
                        ? '—'
                        : item.secretFieldsConfigured.join('、')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.buttonRow}>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={saveMutation.isPending || items.length === 0}
          onClick={() => saveMutation.mutate(rows)}
        >
          {saveMutation.isPending ? '保存中…' : '保存配置'}
        </button>
      </div>

      {items.map((item) => (
        <ProviderDiagnosticsCard key={item.provider} provider={item.provider} displayName={item.displayName} />
      ))}
    </ManageSectionCard>
  );
}

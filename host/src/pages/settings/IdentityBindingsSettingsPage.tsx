/**
 * 账号三方身份绑定管理页（FE-IDENTITY-BINDINGS）。
 *
 * 消费后端绑定面（session 鉴权、**不建会话**）：
 * - `GET  /api/account/identity-bindings`（列表）→ `identityBindingsApi.list`
 * - `POST /api/account/identity-bindings/{provider}/start|complete`（发起/完成）
 * - `POST /api/auth/identity/unbind?confirmed=true`（解绑，破坏性确认闸）
 *
 * provider 可用性取公开列表（`GET /api/auth/identity/providers` 的 `binding_enabled`）：
 * 仅 `enabled && bindingEnabled` 的 provider 可发起（fail-closed）；未开放者禁用/隐藏。
 *
 * 诚实纪律：后端 4xx/5xx（未启用 / challenge 过期 / 越权 / 端口未装配 /
 * 「最后一个可登录凭据」）一律经 `getErrorMessage` 原样呈现，绝不伪造成功态。
 */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  ConfirmDialog,
  FeedbackState,
  InlineBanner,
  Input,
} from '@fmby/v2-shared/ui';
import { identityBindingsApi, identityLoginApi } from '@fmby/v2-shared/contracts/auth';
import type { IdentityLoginStart, IdentityProviderType } from '@fmby/v2-shared/contracts/auth';
import { queryKeys } from '@fmby/v2-shared/query';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './SettingsCenter.module.css';
import { SettingsPageHeader, SettingsSectionCard } from './components';
import {
  bindingCompleteRequest,
  clearPendingBinding,
  consumeOAuthCallback,
  partitionBindingProviders,
  rememberPendingBinding,
} from './identityBindingsPresentation';

interface PendingBindingFlow {
  provider: IdentityProviderType;
  challengeId: string;
  action: string;
  authorizeUrl?: string;
  message?: string;
}

export function IdentityBindingsSettingsPage() {
  const queryClient = useQueryClient();
  const providersQuery = useQuery({
    queryKey: queryKeys.settings.identityProviders(),
    queryFn: () => identityLoginApi.providers(),
  });
  const bindingsQuery = useQuery({
    queryKey: queryKeys.settings.identityBindings(),
    queryFn: () => identityBindingsApi.list(),
  });

  const [pending, setPending] = useState<PendingBindingFlow | null>(null);
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [unbindTarget, setUnbindTarget] = useState<IdentityProviderType | null>(null);

  const invalidateBindings = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.settings.identityBindings() });

  const startMutation = useMutation({
    mutationFn: (provider: IdentityProviderType) =>
      identityBindingsApi.start(provider, { redirectUri: window.location.href }),
    onSuccess: (result: IdentityLoginStart, provider) => {
      setNotice(null);
      setCode('');
      setPending({
        provider,
        challengeId: result.challengeId,
        action: result.action,
        authorizeUrl: result.authorizeUrl,
        message: result.message,
      });
      // 仅 OAuth 外部回调需要回站上下文（state=challengeId → provider）；
      // enter_code（Email/Telegram）在同页完成，无需跨页暂存。
      if (result.authorizeUrl && result.action !== 'enter_code') {
        rememberPendingBinding({ provider, challengeId: result.challengeId });
      }
    },
  });

  const completeMutation = useMutation({
    mutationFn: (vars: { provider: IdentityProviderType; challengeId: string; action: string; code: string }) =>
      identityBindingsApi.complete(vars.provider, bindingCompleteRequest(vars, vars.code)),
    onSuccess: (binding) => {
      setNotice(`已绑定 ${binding.providerDisplayName ?? binding.provider}。`);
      setPending(null);
      setCode('');
      clearPendingBinding();
      invalidateBindings();
    },
  });

  const unbindMutation = useMutation({
    mutationFn: (provider: IdentityProviderType) => identityBindingsApi.unbind(provider),
    onSuccess: () => {
      setNotice('已解绑该三方身份。');
      setUnbindTarget(null);
      invalidateBindings();
    },
  });

  // OAuth 回站（Google）：同标签跳转回本页 URL 带 code + state(=challengeId)，
  // 按暂存上下文反查 provider 并真正调 complete 完成绑定（Major-1：不再静默跳过）。
  useEffect(() => {
    consumeOAuthCallback(window.location.search, (vars) => {
      setPending({ provider: vars.provider, challengeId: vars.challengeId, action: 'external_callback' });
      completeMutation.mutate(vars);
    });
    if (/\[?&\](code|state)=/.test(window.location.search)) {
      // 已消费（或无可消费）：清掉回站 query，避免刷新重复触发。
      window.history.replaceState(null, '', window.location.pathname);
    }
    // 仅在挂载时处理一次回站参数。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { bound, bindable } = useMemo(
    () => partitionBindingProviders(bindingsQuery.data ?? [], providersQuery.data ?? []),
    [bindingsQuery.data, providersQuery.data],
  );

  const { mutate: mutateComplete, isPending: completePending } = completeMutation;

  return (
    <div className={styles.pageSections}>
      <SettingsPageHeader
        title="账号绑定"
        description="管理可用于登录与找回密码的三方身份。绑定与解绑均即时生效。"
        meta="仅展示后端开放绑定的提供方。"
      />

      {notice ? <InlineBanner variant="success" title={notice} /> : null}
      {startMutation.isError ? (
        <InlineBanner
          variant="error"
          title="发起绑定失败"
          description={getErrorMessage(startMutation.error)}
        />
      ) : null}
      {completeMutation.isError ? (
        <InlineBanner
          variant="error"
          title="完成绑定失败"
          description={getErrorMessage(completeMutation.error)}
        />
      ) : null}
      {unbindMutation.isError ? (
        <InlineBanner
          variant="error"
          title="解绑失败"
          description={getErrorMessage(unbindMutation.error)}
        />
      ) : null}

      <SettingsSectionCard
        title="已绑定身份"
        description="这些三方账号已绑定到当前账号。解绑为不可逆操作。"
      >
        {bindingsQuery.isPending ? (
          <FeedbackState
            variant="loading"
            title="正在加载绑定"
            description="正在读取当前账号的三方身份绑定。"
          />
        ) : bindingsQuery.isError ? (
          <FeedbackState
            variant="error"
            title="绑定列表加载失败"
            description={getErrorMessage(bindingsQuery.error)}
            action={
              <Button variant="primary" onClick={() => bindingsQuery.refetch()}>
                重试
              </Button>
            }
          />
        ) : bound.length === 0 ? (
          <div className={styles.softNotice}>当前账号还没有绑定任何三方身份。</div>
        ) : (
          <ul className={styles.bindingList}>
            {bound.map((row) => (
              <li key={row.binding.id} className={styles.bindingRow}>
                <div className={styles.bindingMain}>
                  <strong className={styles.bindingTitle}>{row.displayName}</strong>
                  <span className={styles.bindingMeta}>
                    {row.binding.providerEmail ?? row.binding.providerSubject}
                    {row.binding.verifiedAt ? ` · 绑定于 ${row.binding.verifiedAt}` : ''}
                  </span>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={unbindMutation.isPending}
                  onClick={() => setUnbindTarget(row.provider)}
                >
                  解绑
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSectionCard>

      <SettingsSectionCard
        title="添加绑定"
        description="只能绑定后端已开放（binding_enabled）的提供方。"
      >
        {pending ? (
          <div className={styles.bindingPending}>
            <p className={styles.bindingPendingText}>
              {pending.message ?? `${pending.provider} 绑定已发起。`}
            </p>
            {pending.authorizeUrl ? (
              <a
                className={styles.bindingLink}
                href={pending.authorizeUrl}
                // Telegram 深链保持新标签打开；Google OAuth **同一标签跳转**——
                // 授权完成后回站落点（redirect_uri = 本页 URL）才能在本页挂载树上
                // 触发回站 effect 真正完成绑定（Major-1：避免新标签回站静默跳过）。
                target={pending.action === 'enter_code' ? '_blank' : '_self'}
                rel="noopener noreferrer"
              >
                {pending.action === 'enter_code' ? '打开 Telegram Bot' : '前往授权'}
              </a>
            ) : null}
            {pending.action === 'enter_code' ? (
              <form
                className={styles.bindingCodeForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!code.trim()) return;
                  mutateComplete({
                    provider: pending.provider,
                    challengeId: pending.challengeId,
                    action: pending.action,
                    code,
                  });
                }}
                noValidate
              >
                <label className={styles.field}>
                  验证码
                  <Input
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    placeholder="请输入收到的验证码"
                  />
                </label>
                <Button
                  variant="primary"
                  type="submit"
                  loading={completePending}
                  disabled={code.trim().length === 0}
                >
                  完成绑定
                </Button>
              </form>
            ) : (
              <p className={styles.fieldHint}>完成授权后回到本站即可自动完成绑定。</p>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPending(null);
                setCode('');
                clearPendingBinding();
              }}
            >
              取消
            </Button>
          </div>
        ) : providersQuery.isPending ? (
          <div className={styles.softNotice}>正在读取可绑定提供方…</div>
        ) : providersQuery.isError ? (
          <InlineBanner
            variant="error"
            title="无法读取可绑定提供方"
            description={getErrorMessage(providersQuery.error)}
          />
        ) : bindable.length === 0 ? (
          <div className={styles.softNotice}>
            没有可新增的绑定（已全部绑定，或管理员未开放任何提供方）。
          </div>
        ) : (
          <ul className={styles.bindingList}>
            {bindable.map((provider) => (
              <li key={provider.provider} className={styles.bindingRow}>
                <div className={styles.bindingMain}>
                  <strong className={styles.bindingTitle}>{provider.displayName}</strong>
                  <span className={styles.bindingMeta}>
                    {provider.provider}
                    {provider.configured ? '' : ' · 尚未完全配置'}
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  loading={startMutation.isPending && startMutation.variables === provider.provider}
                  disabled={startMutation.isPending}
                  onClick={() => startMutation.mutate(provider.provider)}
                >
                  绑定
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSectionCard>

      <ConfirmDialog
        open={unbindTarget !== null}
        title="解绑三方身份"
        description={`确认解绑 ${unbindTarget ?? ''}？解绑后该方式将无法用于登录，此操作不可逆。`}
        confirmLabel="确认解绑"
        cancelLabel="取消"
        pending={unbindMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setUnbindTarget(null);
        }}
        onConfirm={() => {
          if (unbindTarget) unbindMutation.mutate(unbindTarget);
        }}
      />
    </div>
  );
}

export default IdentityBindingsSettingsPage;

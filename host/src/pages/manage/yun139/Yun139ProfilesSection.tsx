/**
 * 139 凭据档案列表与操作（FE-PARITY-YUN139）。
 *
 * - 列表展示凭据状态；**过期项给出重新授权入口**（依据后端 last_error_kind /
 *   authorization_expires_at，不本地猜测）。
 * - 删除为不可逆操作 → ConfirmDialog + pending 禁用 + 失败透传 error_code。
 *
 * 三态：loading / empty / error 均有显式呈现。
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { yun139Api } from '@fmby/v2-shared/contracts/manage/yun139';
import { queryKeys } from '@fmby/v2-shared/query';
import { ConfirmDialog, FeedbackState, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '@/pages/manage/longtail-shared/components';
import {
  resolveCredentialExpiry,
  isDisabled,
  isPendingAuthorization,
} from './credentialExpiry';

function formatTime(epochMs: number | null): string {
  if (epochMs === null || !Number.isFinite(epochMs) || epochMs <= 0) {
    return '—';
  }
  return new Date(epochMs).toLocaleString('zh-CN', { hour12: false });
}

export function Yun139ProfilesSection() {
  const queryClient = useQueryClient();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const profilesQuery = useQuery({
    queryKey: queryKeys.manage.yun139.profiles(),
    queryFn: () => yun139Api.listCredentialProfiles(),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.manage.yun139.profiles() });
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => yun139Api.deleteCredentialProfile(id),
    onSuccess: () => {
      setError(null);
      setNotice('凭据档案已删除。');
      setPendingDeleteId(null);
      invalidate();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const profiles = profilesQuery.data ?? [];

  if (profilesQuery.isPending) {
    return (
      <ManageSectionCard title="凭据档案" description="查看与维护 139 凭据档案。">
        <div className={styles.tableHint}>正在加载凭据档案…</div>
      </ManageSectionCard>
    );
  }

  if (profilesQuery.isError) {
    return (
      <ManageSectionCard title="凭据档案" description="查看与维护 139 凭据档案。">
        <FeedbackState
          variant="error"
          title="凭据档案加载失败"
          description={getErrorMessage(profilesQuery.error)}
          action={
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => void profilesQuery.refetch()}
            >
              重试
            </button>
          }
        />
      </ManageSectionCard>
    );
  }

  return (
    <ManageSectionCard
      title={`凭据档案（${profiles.length}）`}
      description="凭据过期项需重新授权；账号标识以掩码呈现，不回显完整账号。"
    >
      {error ? <InlineBanner variant="error" title="操作失败" description={error} /> : null}
      {notice ? <InlineBanner variant="success" title={notice} /> : null}

      {profiles.length === 0 ? (
        <div className={styles.emptyInlineState}>还没有任何 139 凭据档案。</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>显示名</th>
                <th>账号（掩码）</th>
                <th>状态</th>
                <th>授权到期</th>
                <th>最近成功</th>
                <th>最近错误</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => {
                const expiry = resolveCredentialExpiry(profile);
                const expired = expiry.kind === 'expired';
                return (
                  <tr key={profile.id}>
                    <td>{profile.displayName}</td>
                    <td className={styles.mono}>{profile.accountIdentityMask ?? '—'}</td>
                    <td>
                      <StatusBadge
                        label={expired ? '凭据已过期' : profile.status}
                        variant={expired ? 'danger' : profile.status === 'active' ? 'success' : 'neutral'}
                      />
                    </td>
                    <td className="nowrap">{formatTime(profile.authorizationExpiresAt)}</td>
                    <td className="nowrap">{formatTime(profile.lastSuccessAt)}</td>
                    <td>{profile.lastErrorMessage ?? profile.lastErrorKind ?? '—'}</td>
                    <td className="nowrap">
                      {expired ? (
                        <span className={styles.fieldHint}>
                          {expiry.reason}
                          {expiry.backendMessage ? `（后端：${expiry.backendMessage}）` : ''}
                        </span>
                      ) : isPendingAuthorization(profile) ? (
                        <span className={styles.fieldHint}>待确认授权</span>
                      ) : isDisabled(profile) ? (
                        <span className={styles.fieldHint}>已被停用</span>
                      ) : (
                        <button
                          className={styles.smallDangerButton}
                          type="button"
                          disabled={deleteMutation.isPending}
                          aria-label={`删除 139 凭据档案：${profile.displayName}`}
                          onClick={() => setPendingDeleteId(profile.id)}
                        >
                          删除
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="删除 139 凭据档案"
        description="删除后引用该档案的挂载将无法刷新凭据，且不可恢复。"
        confirmLabel="确认删除"
        cancelLabel="取消"
        pending={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        onConfirm={() => {
          if (pendingDeleteId) deleteMutation.mutate(pendingDeleteId);
        }}
      />
    </ManageSectionCard>
  );
}

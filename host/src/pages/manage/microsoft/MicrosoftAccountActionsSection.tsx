/**
 * 微软账号操作（FE-PARITY-MICROSOFT）。
 *
 * 端点：POST accounts/{id}/enable、/disable、/recover、/note；DELETE accounts/{id}
 * 确认闸：后端该文件 `require_confirmed` 出现 0 次 → 契约层不带 confirmed=true；
 *        删除属不可逆操作 → UI 层 ConfirmDialog + pending 禁用 + 失败透传 error_code。
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { microsoftApi } from '@fmby/v2-shared/contracts/manage/microsoft';
import type { MicrosoftAuthAccountRecord } from '@fmby/v2-shared/contracts/manage/microsoft';
import { queryKeys } from '@fmby/v2-shared/query';
import { ConfirmDialog, InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '../longtail-shared/components';

interface MicrosoftAccountActionsSectionProps {
  accounts: MicrosoftAuthAccountRecord[];
  isPending: boolean;
}

export function MicrosoftAccountActionsSection({
  accounts,
  isPending,
}: MicrosoftAccountActionsSectionProps) {
  const queryClient = useQueryClient();
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.manage.microsoft.profiles() });
  }

  const run = (label: string, fn: () => Promise<unknown>) => {
    setError(null);
    setNotice(null);
    fn()
      .then(() => {
        setNotice(`${label}成功。`);
        invalidate();
      })
      .catch((err: unknown) => setError(getErrorMessage(err)));
  };

  const enableMutation = useMutation({ mutationFn: (id: string) => microsoftApi.enableAccount(id) });
  const disableMutation = useMutation({ mutationFn: (id: string) => microsoftApi.disableAccount(id) });
  const recoverMutation = useMutation({ mutationFn: (id: string) => microsoftApi.recoverAccount(id) });
  const noteMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      microsoftApi.updateAccountNote(id, note),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => microsoftApi.deleteAccount(id),
    onSuccess: () => {
      setNotice('账号已删除。');
      setPendingDeleteId(null);
      invalidate();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const busy =
    enableMutation.isPending ||
    disableMutation.isPending ||
    recoverMutation.isPending ||
    noteMutation.isPending ||
    deleteMutation.isPending;

  if (isPending) {
    return (
      <ManageSectionCard title="账号操作" description="启用 / 停用 / 恢复 / 备注 / 删除。">
        <div className={styles.tableHint}>正在加载账号…</div>
      </ManageSectionCard>
    );
  }

  if (accounts.length === 0) {
    return (
      <ManageSectionCard title="账号操作" description="启用 / 停用 / 恢复 / 备注 / 删除。">
        <div className={styles.emptyInlineState}>还没有账号，先完成 OAuth 授权或令牌导入。</div>
      </ManageSectionCard>
    );
  }

  return (
    <ManageSectionCard
      title="账号操作"
      description="启用 / 停用 / 恢复 / 改备注；删除为不可逆操作（需危险操作能力）。"
    >
      {error ? <InlineBanner variant="error" title="操作失败" description={error} /> : null}
      {notice ? <InlineBanner variant="success" title={notice} /> : null}

      <div className={styles.mobileCardList}>
        {accounts.map((account) => (
          <div className={styles.mobileRecordCard} key={account.id}>
            <div className={styles.mobileRecordHeader}>
              <span className={styles.mobileRecordTitle}>
                {account.displayName ?? account.userPrincipalName ?? account.id}
              </span>
            </div>
            <div className={styles.mobileRecordMeta}>
              {account.providerType} · {account.serviceKind} · {account.status}
            </div>
            <div className={styles.rowActions}>
              <button
                className={styles.smallButton}
                type="button"
                disabled={busy}
                onClick={() => run('启用', () => enableMutation.mutateAsync(account.id))}
              >
                启用
              </button>
              <button
                className={styles.smallButton}
                type="button"
                disabled={busy}
                onClick={() => run('停用', () => disableMutation.mutateAsync(account.id))}
              >
                停用
              </button>
              <button
                className={styles.smallButton}
                type="button"
                disabled={busy}
                onClick={() => run('恢复', () => recoverMutation.mutateAsync(account.id))}
              >
                恢复
              </button>
              <button
                className={styles.smallDangerButton}
                type="button"
                disabled={busy}
                aria-label={`删除微软账号：${account.displayName ?? account.id}`}
                onClick={() => setPendingDeleteId(account.id)}
              >
                删除
              </button>
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.label}>
                备注
                <input
                  className={styles.input}
                  value={noteDraft[account.id] ?? account.note ?? ''}
                  onChange={(e) => setNoteDraft({ ...noteDraft, [account.id]: e.target.value })}
                />
              </label>
              <button
                className={styles.smallButton}
                type="button"
                disabled={busy}
                onClick={() =>
                  run('备注更新', () =>
                    noteMutation.mutateAsync({
                      id: account.id,
                      note: noteDraft[account.id] ?? account.note ?? '',
                    }),
                  )
                }
              >
                保存备注
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="删除微软账号"
        description={`确认删除账号 ${pendingDeleteId ?? ''}？此操作不可逆，且会破坏引用该账号的挂载。`}
        confirmLabel="确认删除"
        cancelLabel="取消"
        pending={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteId(null);
          }
        }}
        onConfirm={() => {
          if (pendingDeleteId) {
            deleteMutation.mutate(pendingDeleteId);
          }
        }}
      />
    </ManageSectionCard>
  );
}

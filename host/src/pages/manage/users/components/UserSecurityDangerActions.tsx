/**
 * 用户安全危险操作（FE-USER-SECURITY-DANGER-UI）：
 *   ① 重置 TOTP（`POST /manage/users/{id}/mfa/totp/reset`）
 *   ② 安排 Telegram 密码重置（`POST /manage/users/{id}/telegram-password-reset`）
 *
 * 危险操作必须确认（后端 `?confirmed=true`，契约层已带）⇒ 复用 ConfirmDialog；
 * 幂等键走请求头 `x-idempotency-key`（契约层 `?` 可选：留空**不发该头**）；
 * 回执绝不展示明文密码（TelegramPasswordResetReceipt 本就无密码字段；契约测试有遍历键名断言）；
 * 错误走 getErrorMessage（展示后端原文，不吞拒绝原因）。
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import type { TelegramPasswordResetReceipt } from '@fmby/v2-shared/contracts/manage';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { ConfirmDialog } from '@fmby/v2-shared/ui';
import styles from '../../longtail-shared/ManageShared.module.css';

export interface UserSecurityDangerActionsProps {
  userId: string;
  username: string;
}

/** 随机幂等键生成（仅 Telegram 密码重置用；留空则不发头）。 */
function newIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function UserSecurityDangerActions({ userId, username }: UserSecurityDangerActionsProps) {
  const [totpDialogOpen, setTotpDialogOpen] = useState(false);
  const [tgDialogOpen, setTgDialogOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [tgReceipt, setTgReceipt] = useState<TelegramPasswordResetReceipt | null>(null);

  const totpMutation = useMutation({
    mutationFn: () => manageApi.resetUserTotp(userId),
    onSuccess: () => {
      setTotpDialogOpen(false);
    },
  });

  const tgMutation = useMutation({
    mutationFn: (key: string | undefined) =>
      manageApi.scheduleTelegramPasswordReset(userId, key),
    onSuccess: (receipt) => {
      setTgDialogOpen(false);
      setTgReceipt(receipt);
      setIdempotencyKey('');
    },
  });

  const submitTotp = () => {
    totpMutation.mutate();
  };

  const submitTelegram = () => {
    const key = idempotencyKey.trim();
    tgMutation.mutate(key === '' ? undefined : key);
  };

  return (
    <>
      <div className={styles.buttonRow}>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => setTotpDialogOpen(true)}
        >
          重置 TOTP
        </button>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => {
            setIdempotencyKey(newIdempotencyKey());
            setTgDialogOpen(true);
          }}
        >
          安排 Telegram 密码重置
        </button>
      </div>

      {/* ① 重置 TOTP 确认 */}
      <ConfirmDialog
        open={totpDialogOpen}
        title="重置 TOTP"
        description={`将清除用户 ${username} 的 TOTP 绑定，该用户需重新扫码绑定两步验证。`}
        impact="用户下次登录需重新绑定认证器"
        errorMessage={totpMutation.isError ? getErrorMessage(totpMutation.error) : undefined}
        confirmLabel="确认重置"
        pending={totpMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setTotpDialogOpen(false);
        }}
        onConfirm={submitTotp}
      />

      {/* ② 安排 Telegram 密码重置确认（含可选幂等键输入） */}
      <ConfirmDialog
        open={tgDialogOpen}
        title="安排 Telegram 密码重置"
        description={`将为用户 ${username} 安排密码重置：系统经 Telegram Bot 下发一次性设置载荷（有时效）。`}
        impact={['旧密码立即失效（载荷确认后）', '重复提交同一幂等键会复用既有操作']}
        errorMessage={tgMutation.isError ? getErrorMessage(tgMutation.error) : undefined}
        confirmLabel="确认安排"
        pending={tgMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setTgDialogOpen(false);
        }}
        onConfirm={submitTelegram}
      >
        <label className={styles.label}>
          幂等键（可选；留空则不携带 x-idempotency-key 头）
          <input
            className={styles.input}
            value={idempotencyKey}
            onChange={(event) => setIdempotencyKey(event.target.value)}
            placeholder="留空 = 不做幂等去重"
          />
        </label>
      </ConfirmDialog>

      {/* Telegram 重置回执（不含任何明文密码；payloadExpiresAt 为 epoch ms） */}
      {tgReceipt ? (
        <div className={styles.fieldGroup} role="status">
          <div>
            <strong>
              Telegram 密码重置已安排{tgReceipt.replayed ? '（幂等复用既有操作）' : ''}
            </strong>
          </div>
          <div className={styles.mutedText}>
            操作 ID：{tgReceipt.operationId} · 用户：{tgReceipt.username} · 投递状态：
            {tgReceipt.deliveryStatus}
          </div>
          <div className={styles.mutedText}>
            载荷有效期至：{new Date(tgReceipt.payloadExpiresAt).toLocaleString('zh-CN')}
          </div>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => setTgReceipt(null)}
          >
            知道了
          </button>
        </div>
      ) : null}
    </>
  );
}

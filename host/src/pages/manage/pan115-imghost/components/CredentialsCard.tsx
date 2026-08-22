import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pan115ImghostApi } from '@/domains/manage/pan115Imghost';
import type { Pan115ImghostQrcodeStatus } from '@/domains/manage/pan115Imghost';
import { ManageSectionCard } from '@/pages/manage/longtail-shared/components';
import { StatusBadge } from '@/shared/ui';
import { Dialog } from '@/shared/ui';
import { ConfirmDialog } from '@/shared/ui';
import { InlineBanner } from '@/shared/ui';
import { formatDateTime } from '@/shared/utils/date';
import { getErrorMessage } from '@/shared/utils/error';
import { isApiError } from '@/shared/types';
import { PAN115_COOKIE_APP_OPTIONS, PAN115_DEFAULT_COOKIE_APP } from '@/shared/utils/pan115-cookie-app';
import { queryKeys } from '@/shared/query-keys';
import { useImghostQrLogin } from '../hooks/useImghostQrLogin';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';

// ─── 常量 ─────────────────────────────────────────────────────────────────────

const QR_STATUS_LABELS: Record<Pan115ImghostQrcodeStatus, string> = {
  waiting: '等待扫码',
  scanned: '已扫码，待确认',
  signed: '确认成功',
  expired: '二维码已过期',
  canceled: '用户取消',
  aborted: '登录中断',
  unknown: '未知状态',
};

function getCredentialBadgeVariant(status: string) {
  switch (status) {
    case 'Active':
      return 'success' as const;
    case 'Pending':
      return 'info' as const;
    case 'Expired':
      return 'danger' as const;
    default:
      return 'neutral' as const;
  }
}

// ─── 组件 ─────────────────────────────────────────────────────────────────────

/**
 * 图床凭据卡片。
 *
 * 显示当前图床凭据状态（Active / Pending / Expired / Unbound），
 * 提供扫码绑定与解绑操作。
 *
 * 注意：图床凭据独立于挂载凭据，各自管理。
 */
export function CredentialsCard() {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const credentialsQueryKey = queryKeys.manage.pan115Imghost.credentials();

  const credQuery = useQuery({
    queryKey: credentialsQueryKey,
    queryFn: async () => {
      try {
        return await pan115ImghostApi.getCredentials();
      } catch (err) {
        if (isApiError(err) && err.code === 'NOT_FOUND') return null;
        throw err;
      }
    },
    staleTime: 15_000,
  });

  const deleteMutation = useMutation({
    mutationFn: () => pan115ImghostApi.deleteCredentials(),
    onSuccess: () => {
      setConfirmDelete(false);
      queryClient.invalidateQueries({ queryKey: credentialsQueryKey });
    },
  });

  const [cookieApp, setCookieApp] = useState<string>(PAN115_DEFAULT_COOKIE_APP);

  const {
    qrOpen,
    qrSession,
    qrStatus,
    qrError,
    activating,
    startPending,
    openQrDialog,
    closeQrDialog,
  } = useImghostQrLogin({ cookieApp });

  const cred = credQuery.data ?? null;
  const isBound = !!cred && cred.hasCookie && cred.status !== 'Unbound';

  return (
    <ManageSectionCard
      title="图床凭据（115）"
      description="图床凭据独立于挂载凭据，即使已绑定 Mount 也需单独扫码绑定图床。扫码完成后 Cookie 存入图床专用凭据表。"
      actions={
        <div className={styles.rowActions}>
          {!isBound ? (
            <>
              <select
                value={cookieApp}
                onChange={(e) => setCookieApp(e.target.value)}
                disabled={startPending}
                title="选择扫码使用的 cookie 槽位（不同槽位不会互相挤掉登录态）"
                style={{ marginRight: 8, fontSize: 12, padding: '4px 6px' }}
              >
                {PAN115_COOKIE_APP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                className={styles.primaryButton}
                type="button"
                disabled={startPending}
                onClick={openQrDialog}
              >
                {startPending ? '生成二维码…' : '扫码绑定图床'}
              </button>
            </>
          ) : (
            <>
              <button
                className={styles.smallButton}
                type="button"
                disabled={startPending}
                onClick={openQrDialog}
                title="重新扫码会覆盖当前 Cookie"
              >
                重新扫码
              </button>
              <button
                className={styles.smallDangerButton}
                type="button"
                onClick={() => setConfirmDelete(true)}
              >
                解绑凭据
              </button>
            </>
          )}
        </div>
      }
    >
      {/* ─── 状态展示 ─────────────────────────────────────────────────────── */}
      {credQuery.isPending ? (
        <p className={styles.mutedText}>正在读取凭据状态…</p>
      ) : credQuery.isError ? (
        <InlineBanner
          variant="error"
          title="凭据读取失败"
          description={getErrorMessage(credQuery.error)}
        />
      ) : !isBound ? (
        <p className={styles.mutedText}>
          当前尚未绑定图床凭据。点击右上角「扫码绑定图床」按钮，使用 115 移动端 App
          扫码即可完成绑定。
          <br />
          <strong>注意：图床凭据与挂载凭据相互独立，分别管理。</strong>
        </p>
      ) : cred ? (
        <div className={styles.fieldRow}>
          <div className={styles.stackText}>
            <span className={styles.mutedText}>凭据状态</span>
            <StatusBadge
              label={cred.status}
              variant={getCredentialBadgeVariant(cred.status)}
            />
          </div>
          <div className={styles.stackText}>
            <span className={styles.mutedText}>Cookie</span>
            <span>{cred.hasCookie ? '已下发' : '未下发'}</span>
          </div>
          {cred.lastActiveAt ? (
            <div className={styles.stackText}>
              <span className={styles.mutedText}>最近活跃</span>
              <span>{formatDateTime(cred.lastActiveAt)}</span>
            </div>
          ) : null}
          <div className={styles.stackText}>
            <span className={styles.mutedText}>更新时间</span>
            <span>{formatDateTime(cred.updatedAt)}</span>
          </div>
        </div>
      ) : null}

      {/* ─── 过期提示 ─────────────────────────────────────────────────────── */}
      {cred?.status === 'Expired' ? (
        <InlineBanner
          variant="warning"
          title="Cookie 已过期"
          description="图床 Cookie 已失效，请重新扫码绑定以恢复上传功能。"
        />
      ) : null}

      {deleteMutation.isError ? (
        <InlineBanner
          variant="error"
          title="解绑失败"
          description={getErrorMessage(deleteMutation.error)}
        />
      ) : null}

      {/* ─── 扫码弹窗 ─────────────────────────────────────────────────────── */}
      <Dialog
        open={qrOpen}
        eyebrow="扫码登录"
        title="115 图床扫码绑定"
        description="请使用 115 移动端 App 扫描下方二维码并在手机上确认。Cookie 仅用于图床上传，与挂载凭据相互隔离。"
        onOpenChange={(next) => {
          if (!next) closeQrDialog();
        }}
      >
        {qrError ? (
          <InlineBanner variant="error" title="扫码流程出错" description={qrError} />
        ) : null}
        {qrSession ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <img
              src={qrSession.qrImage ?? qrSession.qrUrl}
              alt="115 扫码登录二维码"
              style={{
                width: 220,
                height: 220,
                background: '#fff',
                padding: 8,
                borderRadius: 8,
              }}
            />
            <p className={styles.mutedText}>状态：{QR_STATUS_LABELS[qrStatus]}</p>
            {activating ? (
              <p className={styles.mutedText}>正在激活图床凭据…</p>
            ) : null}
            {qrStatus === 'expired' ||
            qrStatus === 'canceled' ||
            qrStatus === 'aborted' ? (
              <button
                className={styles.smallButton}
                type="button"
                disabled={startPending}
                onClick={openQrDialog}
              >
                重新生成二维码
              </button>
            ) : null}
          </div>
        ) : startPending ? (
          <p className={styles.mutedText}>正在请求二维码…</p>
        ) : null}
      </Dialog>

      {/* ─── 解绑确认 ─────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmDelete}
        title="解绑图床凭据"
        description="确定要解绑 115 图床凭据吗？解绑后已上传的图片本地副本依然可访问，但新上传将无法镜像到 115 云端。"
        impact="图床 Cookie 将被永久删除，无法恢复。"
        confirmLabel="确认解绑"
        cancelLabel="取消"
        pending={deleteMutation.isPending}
        onOpenChange={(next) => {
          if (!next) setConfirmDelete(false);
        }}
        onConfirm={() => deleteMutation.mutate()}
      />
    </ManageSectionCard>
  );
}

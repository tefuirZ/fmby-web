/**
 * 分享下载预览凭据（FE-PARITY-PAN115-SHARE-DL）。
 *
 * 端点（真源 crates/fmby-v2-http/src/routes/pan115_share_download.rs:224/228/232）：
 * - POST /api/manage/pan115/share-download-preview/qr-login
 * - GET  /api/manage/pan115/share-download-preview/qr-status?sessionId=
 * - POST /api/manage/pan115/share-download-preview/create
 *
 * 能力门 MANAGE_MOUNT；**无 require_confirmed** → 不带 confirmed=true。
 * 创建预览凭据属写操作 → ConfirmDialog + pending 禁用 + 失败透传 error_code。
 *
 * 三态：loading / empty / error 均显式呈现，不白屏、不吐原始错误对象。
 * ★诚实：qr_image 取图失败为 null → 只给链接，不伪造占位图。
 */

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { pan115Api } from '@fmby/v2-shared/contracts/manage/pan115';
import { ConfirmDialog, InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../../longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '../../longtail-shared/components';

/** 轮询间隔（扫码态需要等待用户在 115 客户端确认）。 */
const POLL_INTERVAL_MS = 3000;

export function PreviewCredentialSection() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [cookieHeader, setCookieHeader] = useState('');
  const [sourceMountId, setSourceMountId] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: () => pan115Api.previewQrLogin(),
    onSuccess: (res) => {
      setError(null);
      setSessionId(res.sessionId);
      setQrUrl(res.qrUrl);
      setQrImage(res.qrImage);
      setStatus(null);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: (sid: string) => pan115Api.previewQrStatus(sid),
    onSuccess: (res) => setStatus(res.status),
    onError: (err) => setError(getErrorMessage(err)),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      pan115Api.previewCreate({
        sessionId: sessionId ?? undefined,
        cookieHeader: cookieHeader.trim() || undefined,
        sourceMountId: sourceMountId.trim() || undefined,
      }),
    onSuccess: (res) => {
      setError(null);
      setPreviewId(res.previewId);
      setConfirmOpen(false);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  // 轮询扫码状态：仅在拿到 sessionId 且尚未终态时轮询。
  useEffect(() => {
    if (!sessionId) {
      return;
    }
    if (status === 'confirmed' || status === 'expired') {
      return;
    }
    const timer = setInterval(() => {
      statusMutation.mutate(sessionId);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // statusMutation 每次渲染都是新引用，故只依赖 sessionId/status。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, status]);

  const pending = loginMutation.isPending || createMutation.isPending;

  return (
    <ManageSectionCard
      title="分享下载预览凭据"
      description="扫码登录或复用已绑定挂载，创建一次性的分享下载预览凭据（拿到 preview_id 后可用于 previews/{id}/browse）。"
    >
      {error ? <InlineBanner variant="error" title="操作失败" description={error} /> : null}
      {previewId ? (
        <InlineBanner
          variant="success"
          title={`预览凭据已创建：${previewId}`}
          description="复制该 preview_id，到「预览浏览」区块填入即可浏览网盘目录。"
        />
      ) : null}

      <div className={styles.fieldGroup}>
        <div className={styles.buttonRow}>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={pending}
            onClick={() => loginMutation.mutate()}
          >
            发起扫码登录
          </button>
        </div>

        {sessionId ? (
          <>
            <label className={styles.label}>
              会话 ID
              <input className={styles.input} readOnly value={sessionId} />
            </label>
            <div className={styles.fieldRow}>
              <label className={styles.label}>
                扫码状态
                <input className={styles.input} readOnly value={status ?? '等待首次轮询…'} />
              </label>
            </div>
            {qrImage ? (
              <img src={qrImage} alt="115 登录二维码" className={styles.readonlyField} />
            ) : qrUrl ? (
              <div className={styles.fieldHint}>
                二维码图不可用（后端取图失败），请用链接扫码：
                <span className={styles.mono}> {qrUrl}</span>
              </div>
            ) : null}
          </>
        ) : null}

        <div className={styles.fieldRow}>
          <label className={styles.label}>
            手填 cookie（可选，与扫码二选一）
            <input
              className={styles.input}
              value={cookieHeader}
              onChange={(e) => setCookieHeader(e.target.value)}
            />
          </label>
          <label className={styles.label}>
            复用挂载 ID（可选）
            <input
              className={styles.input}
              value={sourceMountId}
              onChange={(e) => setSourceMountId(e.target.value)}
              placeholder="已绑定原生 115 挂载的 mount_id"
            />
          </label>
        </div>

        <div className={styles.buttonRow}>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={pending || (!sessionId && !cookieHeader.trim() && !sourceMountId.trim())}
            onClick={() => setConfirmOpen(true)}
          >
            创建预览凭据
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="创建分享下载预览凭据"
        description="将创建一次性预览凭据用于浏览网盘目录；请确认登录来源可信。"
        confirmLabel="确认创建"
        cancelLabel="取消"
        pending={createMutation.isPending}
        onOpenChange={setConfirmOpen}
        onConfirm={() => createMutation.mutate()}
      />
    </ManageSectionCard>
  );
}

/**
 * 139 扫码绑定（FE-PARITY-YUN139）。
 *
 * 三态：loading / empty / error 不白屏；qr_image 取图失败 → 只给链接，不伪造占位图。
 * ★凭据/cookie 只进请求体，不落 localStorage / URL / console。
 */

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { yun139Api } from '@fmby/v2-shared/contracts/manage/yun139';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '@/pages/manage/longtail-shared/components';

const POLL_INTERVAL_MS = 3000;
/** 终态：不再轮询。 */
const TERMINAL_STATUSES = new Set(['confirmed', 'expired']);

export function Yun139QrLoginSection() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: () => yun139Api.qrLogin(),
    onSuccess: (res) => {
      setError(null);
      setNotice(null);
      setSessionId(res.sessionId);
      setQrUrl(res.qrUrl);
      setQrImage(res.qrImage);
      setStatus(null);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: (sid: string) => yun139Api.qrStatus(sid),
    onSuccess: (res) => setStatus(res.status),
    onError: (err) => setError(getErrorMessage(err)),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      yun139Api.createCredentialProfile({
        displayName: displayName.trim() || undefined,
        qrSessionId: sessionId ?? undefined,
      }),
    onSuccess: (profile) => {
      setError(null);
      setNotice(`凭据档案已创建：${profile.displayName}（${profile.id}）`);
      setSessionId(null);
      setQrImage(null);
      setQrUrl(null);
      setStatus(null);
      setDisplayName('');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  useEffect(() => {
    if (!sessionId || (status && TERMINAL_STATUSES.has(status))) {
      return;
    }
    const timer = setInterval(() => statusMutation.mutate(sessionId), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, status]);

  const confirmed = status === 'confirmed';

  return (
    <ManageSectionCard
      title="扫码绑定"
      description="发起扫码 → 用 139 客户端确认 → 轮询到 confirmed 后创建凭据档案。"
    >
      {error ? <InlineBanner variant="error" title="操作失败" description={error} /> : null}
      {notice ? <InlineBanner variant="success" title={notice} /> : null}

      <div className={styles.fieldGroup}>
        <div className={styles.buttonRow}>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={loginMutation.isPending}
            onClick={() => loginMutation.mutate()}
          >
            {loginMutation.isPending ? '正在获取二维码…' : '发起扫码登录'}
          </button>
        </div>

        {sessionId ? (
          <>
            <label className={styles.label}>
              会话 ID
              <input className={styles.input} readOnly value={sessionId} />
            </label>
            <label className={styles.label}>
              扫码状态
              <input className={styles.input} readOnly value={status ?? '等待首次轮询…'} />
            </label>
            {qrImage ? (
              <img src={qrImage} alt="139 登录二维码" className={styles.readonlyField} />
            ) : qrUrl ? (
              <div className={styles.fieldHint}>
                二维码图不可用（后端取图失败），请用链接扫码：
                <span className={styles.mono}> {qrUrl}</span>
              </div>
            ) : null}

            <label className={styles.label}>
              档案显示名（可选）
              <input
                className={styles.input}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="例如：主账号 139"
              />
            </label>
            <div className={styles.buttonRow}>
              <button
                className={styles.primaryButton}
                type="button"
                disabled={!confirmed || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? '创建中…' : '用该会话创建凭据档案'}
              </button>
            </div>
            {!confirmed ? (
              <div className={styles.fieldHint}>
                扫码状态需为 confirmed 才能创建档案（当前：{status ?? '未知'}）。
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </ManageSectionCard>
  );
}

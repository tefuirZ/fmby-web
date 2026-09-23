/**
 * W5-C：微软挂载的**专用重绑流**（复用既有 UI 体系：抽屉内区块）。
 *
 * 后端依据（不自造端点/字段）：
 * - 关联键：挂载 `config_json.drive_id` → `microsoft_graph_accounts.expires_at`
 *   （`crates/fmby-v2-server/tests/mount_contract_e2e.rs:1317`）
 * - 重绑动作：复用既有 `POST /api/manage/microsoft/auth/start` + `/complete`
 *   （`crates/fmby-v2-http/src/routes/manage_microsoft.rs:244/254`）
 *
 * 入口只在：provider 为微软系 **且** 取得到 drive_id 时出现；
 * 否则回落 W5-B 的通用配置表单（由宿主决定），本区块不渲染。
 *
 * ★成功失效范围：`useInvalidateCredentialState` 一次刷
 *   mounts.list + mounts.detail + mounts.health（少刷会自相矛盾）。
 * ★不回显任何密钥/密封引用：只呈现状态与动作。
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { microsoftApi } from '@fmby/v2-shared/contracts/manage/microsoft';
import type { ManageMountDetailRecord } from '@fmby/v2-shared/contracts/manage';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { readMountDriveId } from '../../../credentialPresentation';
import { useInvalidateCredentialState } from '../../../hooks/useInvalidateCredentialState';
import { ManageSectionCard } from '../../../../components';
import styles from '../../../../ManagePages.module.css';


interface MicrosoftRebindSectionProps {
  currentDetail: ManageMountDetailRecord;
}

export function MicrosoftRebindSection({ currentDetail }: MicrosoftRebindSectionProps) {
  const driveId = readMountDriveId(currentDetail.configJson);
  const invalidateCredentialState = useInvalidateCredentialState();
  const mountId = currentDetail.mount.id;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const startMutation = useMutation({
    mutationFn: () =>
      microsoftApi.startAuth({
        providerType: 'global',
        tenantId: '',
        // ★关联键：把挂载的 drive_id 带进去，重绑才作用在**这个**挂载上
        driveId: driveId ?? '',
        serviceKind: 'onedrive',
      }),
    onSuccess: (res) => {
      setError(null);
      setNotice(null);
      setSessionId(res.authorizationId);
      setAuthorizeUrl(res.authorizeUrl);
      setStatus(null);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const completeMutation = useMutation({
    mutationFn: () => microsoftApi.completeAuth({ authorizationId: sessionId ?? '', callbackUrl: callbackUrl.trim() }),
    onSuccess: (res) => {
      setError(null);
      setNotice(`微软账号已重新绑定（状态 ${res.status}）。`);
      setSessionId(null);
      setAuthorizeUrl(null);
      setCallbackUrl('');
      // ★三处一起失效，避免「状态变了但观察面仍提示过期」的自相矛盾
      invalidateCredentialState(mountId);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  // 无 drive_id → 不渲染（回落通用表单）
  if (driveId === null) {
    return null;
  }

  return (
    <ManageSectionCard
      title="微软账号重新绑定"
      description={`按挂载关联的 drive（${driveId}）重新走一次授权，完成后凭据状态与观察面会一并刷新。`}
    >
      {error ? <InlineBanner variant="error" title="重新绑定失败" description={error} /> : null}
      {notice ? <InlineBanner variant="success" title={notice} /> : null}

      <div className={styles.fieldGroup}>
        <div className={styles.buttonRow}>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={startMutation.isPending}
            onClick={() => startMutation.mutate()}
          >
            {startMutation.isPending ? '正在获取授权链接…' : '发起重新授权'}
          </button>
        </div>

        {sessionId ? (
          <>
            <label className={styles.label}>
              授权链接（请在新标签页打开）
              <input className={styles.input} readOnly value={authorizeUrl ?? ''} />
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
                disabled={completeMutation.isPending || callbackUrl.trim().length === 0}
                onClick={() => completeMutation.mutate()}
              >
                {completeMutation.isPending ? '提交中…' : '完成重新绑定'}
              </button>
            </div>
            {status ? <div className={styles.fieldHint}>当前状态：{status}</div> : null}
          </>
        ) : null}
      </div>
    </ManageSectionCard>
  );
}

// Pan115 创建模式凭据卡：扫码 / 手填 cookie 两种 tab + cookieApp 选择器。
// 创建抽屉里 mount 还未生成 mount_id，因此扫码完成 / cookie 填写完毕只把 pending 状态报告给父组件，
// 待 createMountMutation 成功拿到 mount_id 后再统一调 activate。
import { useEffect, useState } from 'react';
import { pan115Api } from '@fmby/v2-shared/contracts/manage/pan115';
import type { Pan115QrcodeStatus } from '@fmby/v2-shared/contracts/manage/pan115';
import { ManageSectionCard } from '../../../../components';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { DetailModal } from '@fmby/v2-shared/ui';
import { usePan115QrLogin } from '@fmby/v2-shared/hooks/usePan115QrLogin';
import { PAN115_COOKIE_APP_OPTIONS, PAN115_DEFAULT_COOKIE_APP } from '@fmby/v2-shared/utils/pan115-cookie-app';
import styles from '../../../../ManagePages.module.css';

export type Pan115CreatePendingActivation =
  | { mode: 'qr'; sessionId: string; cookieApp: string }
  | { mode: 'cookie'; cookieHeader: string };

interface Pan115CreateCredentialsSectionProps {
  pending: Pan115CreatePendingActivation | null;
  onPendingChange: (next: Pan115CreatePendingActivation | null) => void;
  isSaving: boolean;
}

const STATUS_LABELS: Record<Pan115QrcodeStatus, string> = {
  waiting: '等待扫码',
  scanned: '已扫码，待确认',
  signed: '确认成功',
  expired: '二维码已过期',
  canceled: '用户取消',
  aborted: '登录中断',
  unknown: '未知状态',
};

export function Pan115CreateCredentialsSection({
  pending,
  onPendingChange,
  isSaving,
}: Pan115CreateCredentialsSectionProps) {
  const [tab, setTab] = useState<'qr' | 'cookie'>('qr');
  const [cookieApp, setCookieApp] = useState<string>(PAN115_DEFAULT_COOKIE_APP);
  const [cookieDraft, setCookieDraft] = useState('');

  const {
    qrOpen,
    qrSession,
    qrStatus,
    qrError,
    activating,
    startPending,
    openQrDialog,
    closeQrDialog,
  } = usePan115QrLogin<Pan115QrcodeStatus>({
    initialStatus: 'waiting',
    signedStatus: 'signed',
    terminalStatuses: ['expired', 'canceled', 'aborted'],
    startQrLogin: () => pan115Api.startQrLogin({}),
    pollQrStatus: (sessionId) => pan115Api.pollQrStatus(sessionId),
    // 创建模式没有 mount_id，无法真正激活。这里把 sessionId + cookieApp 报告给父组件，
    // 由父组件在 createMountMutation 成功后用拿到的 mount_id 调用 activate。
    activate: async (sessionId) => {
      onPendingChange({ mode: 'qr', sessionId, cookieApp });
    },
  });

  // cookie tab 同步：用户输入即上报
  useEffect(() => {
    if (tab !== 'cookie') return;
    const trimmed = cookieDraft.trim();
    if (!trimmed) {
      if (pending && pending.mode === 'cookie') onPendingChange(null);
      return;
    }
    onPendingChange({ mode: 'cookie', cookieHeader: trimmed });
    // 不把 onPendingChange / pending 当依赖，避免循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cookieDraft, tab]);

  const switchTab = (next: 'qr' | 'cookie') => {
    setTab(next);
    onPendingChange(null);
  };

  const pendingSummary = (() => {
    if (!pending) return null;
    if (pending.mode === 'qr') return `已扫码（待保存后激活，cookieApp=${pending.cookieApp}）`;
    return `已填入 cookie（${pending.cookieHeader.length} 字符，待保存后激活）`;
  })();

  return (
    <ManageSectionCard
      title="115 网盘凭据绑定"
      description="扫码或手填 cookie 二选一；保存数据源后会立即用所选凭据激活账号。如失败可在创建后进入详情抽屉重试。"
    >
      <div className={styles.rowActions} style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={tab === 'qr' ? styles.primaryButton : styles.smallButton}
          disabled={isSaving}
          onClick={() => switchTab('qr')}
        >
          扫码登录
        </button>
        <button
          type="button"
          className={tab === 'cookie' ? styles.primaryButton : styles.smallButton}
          disabled={isSaving}
          onClick={() => switchTab('cookie')}
        >
          手填 Cookie
        </button>
      </div>

      <label className={styles.fieldLabel} style={{ display: 'block', marginBottom: 12 }}>
        客户端类型 (cookie_app)
        <select
          className={styles.input}
          value={cookieApp}
          disabled={isSaving || tab === 'cookie'}
          onChange={(e) => setCookieApp(e.target.value)}
        >
          {PAN115_COOKIE_APP_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span className={styles.fieldHelpText}>
          扫码时使用，避免挤占你日常使用的 115 客户端登录态。手填 cookie 模式忽略此项。
        </span>
      </label>

      {tab === 'qr' ? (
        <div>
          <p className={styles.mutedText}>
            点击"扫码登录"弹出二维码，用 115 App 扫码确认后即可关闭弹窗，等待保存数据源。
          </p>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={isSaving || startPending}
            onClick={openQrDialog}
          >
            {startPending ? '生成二维码…' : pending && pending.mode === 'qr' ? '重新扫码' : '扫码登录'}
          </button>
        </div>
      ) : (
        <div>
          <label className={styles.fieldLabel} style={{ display: 'block' }}>
            完整 cookie header
            <textarea
              className={styles.textarea}
              rows={4}
              placeholder="UID=...; CID=...; SEID=...; KID=..."
              value={cookieDraft}
              disabled={isSaving}
              onChange={(e) => setCookieDraft(e.target.value)}
            />
            <span className={styles.fieldHelpText}>
              从浏览器 115.com 已登录页面 DevTools → Application → Cookies 复制完整 cookie 字符串。
            </span>
          </label>
        </div>
      )}

      {pendingSummary ? (
        <InlineBanner variant="success" title="凭据已就绪" description={pendingSummary} />
      ) : (
        <InlineBanner
          variant="info"
          title="尚未提供凭据"
          description="数据源会先创建，但若没有完成扫码或填写 cookie，需要在详情抽屉里重新激活。"
        />
      )}

      <DetailModal
        open={qrOpen}
        eyebrow="扫码登录"
        title="115 网盘扫码绑定"
        description="请使用 115 移动端 App 扫描下方二维码并在手机上确认。完成后弹窗会自动关闭，待你保存数据源。"
        onOpenChange={(next) => { if (!next) closeQrDialog(); }}
      >
        {qrError ? (
          <InlineBanner variant="error" title="扫码流程出错" description={qrError} />
        ) : null}
        {qrSession ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <img
              src={qrSession.qrImage ?? qrSession.qrUrl}
              alt="115 扫码登录二维码"
              referrerPolicy="no-referrer"
              style={{ width: 220, height: 220, background: '#fff', padding: 8, borderRadius: 8 }}
            />
            <p className={styles.mutedText}>状态：{STATUS_LABELS[qrStatus]}</p>
            {activating ? <p className={styles.mutedText}>记录登录会话…</p> : null}
            {(qrStatus === 'expired' || qrStatus === 'canceled' || qrStatus === 'aborted') ? (
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
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <p className={styles.mutedText}>
              {startPending ? '正在请求二维码…' : '准备扫码会话…'}
            </p>
            <button
              className={styles.smallButton}
              type="button"
              disabled={startPending}
              onClick={openQrDialog}
            >
              重新生成二维码
            </button>
          </div>
        )}
      </DetailModal>
    </ManageSectionCard>
  );
}
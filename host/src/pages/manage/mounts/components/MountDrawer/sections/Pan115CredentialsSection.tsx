import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ManageMountDetailRecord } from '@fmby/v2-shared/contracts/manage';
import { pan115Api } from '@fmby/v2-shared/contracts/manage/pan115';
import type { Pan115BrowseEntry, Pan115HealthReport, Pan115QrcodeStatus } from '@fmby/v2-shared/contracts/manage/pan115';
import { ManageSectionCard } from '../../../../components';
import { PAN115_CREDENTIAL_HINT } from '../../../formUtils';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { DetailModal } from '@fmby/v2-shared/ui';
import { ConfirmDialog } from '@fmby/v2-shared/ui';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { PAN115_COOKIE_APP_OPTIONS, PAN115_DEFAULT_COOKIE_APP } from '@fmby/v2-shared/utils/pan115-cookie-app';
import { queryKeys } from '@fmby/v2-shared/query';
import { usePan115QrLogin } from '@fmby/v2-shared/hooks/usePan115QrLogin';
import { isApiError } from '@fmby/v2-shared/types';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { formatDateTime } from '@fmby/v2-shared/time';
import styles from '../../../../ManagePages.module.css';

interface Pan115CredentialsSectionProps {
  currentDetail: ManageMountDetailRecord;
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

/**
 * 未绑定判定：后端 error_code 为稳定 **小写** snake_case（`not_found`）。
 *
 * 此前按大写 'NOT_FOUND' 判定永不命中，导致"未绑定"被当成"读取失败"，
 * 未绑定来源拿不到扫码绑定引导（P2-09 修复）。
 */
function isNotFound(err: unknown): boolean {
  return isApiError(err) && err.code === 'not_found';
}

/** 凭据缺失/失效（后端 credential_invalid）→ 引导重新绑定，而非泛化报错。 */
function isCredentialError(err: unknown): boolean {
  return isApiError(err) && err.code === 'credential_invalid';
}

export function Pan115CredentialsSection({ currentDetail }: Pan115CredentialsSectionProps) {
  const queryClient = useQueryClient();
  const mountId = currentDetail.mount.id;
  const accountQueryKey = queryKeys.manage.pan115.account(mountId);

  const accountQuery = useQuery({
    queryKey: accountQueryKey,
    queryFn: async () => {
      try {
        return await pan115Api.getAccount(mountId);
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    staleTime: 10_000,
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
  } = usePan115QrLogin<Pan115QrcodeStatus>({
    initialStatus: 'waiting',
    signedStatus: 'signed',
    terminalStatuses: ['expired', 'canceled', 'aborted'],
    startQrLogin: () => pan115Api.startQrLogin({}),
    pollQrStatus: (sessionId) => pan115Api.pollQrStatus(sessionId),
    activate: (sessionId) => pan115Api.activate({ sessionId, mountId, cookieApp }),
    onActivated: () => queryClient.invalidateQueries({ queryKey: accountQueryKey }),
  });

  const refreshMutation = useMutation({
    mutationFn: () => pan115Api.refreshOpenToken(mountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountQueryKey });
    },
  });

  const [healthReport, setHealthReport] = useState<Pan115HealthReport | null>(null);
  const healthMutation = useMutation({
    mutationFn: () => pan115Api.healthCheck(mountId),
    onSuccess: (data) => {
      setHealthReport(data);
      queryClient.invalidateQueries({ queryKey: accountQueryKey });
    },
    onError: (err) => {
      // 凭据缺失/失效不泛化报错，直接给可执行的重新绑定引导。
      setHealthReport({
        ok: false,
        reason: isCredentialError(err) ? PAN115_CREDENTIAL_HINT : getErrorMessage(err),
      });
    },
  });

  const [confirmUnbind, setConfirmUnbind] = useState(false);
  const unbindMutation = useMutation({
    mutationFn: () => pan115Api.unbind(mountId),
    onSuccess: () => {
      setConfirmUnbind(false);
      setHealthReport(null);
      queryClient.invalidateQueries({ queryKey: accountQueryKey });
    },
  });

  const [browseOpen, setBrowseOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState<string>('/');
  const [browseEntries, setBrowseEntries] = useState<Pan115BrowseEntry[]>([]);
  const browseMutation = useMutation({
    mutationFn: (path: string) => pan115Api.browseDirectory(mountId, path),
    onSuccess: (data) => {
      setBrowsePath(data.currentPath);
      setBrowseEntries(data.entries);
    },
  });
  const openBrowseDialog = () => {
    setBrowseOpen(true);
    setBrowseEntries([]);
    setBrowsePath('/');
    browseMutation.mutate('/');
  };
  const closeBrowseDialog = () => {
    setBrowseOpen(false);
    setBrowseEntries([]);
    browseMutation.reset();
  };
  const goUp = () => {
    if (browsePath === '/' || browsePath === '') return;
    const parts = browsePath.split('/').filter(Boolean);
    parts.pop();
    const next = parts.length === 0 ? '/' : '/' + parts.join('/');
    browseMutation.mutate(next);
  };

  const account = accountQuery.data ?? null;
  const isBound = !!account && account.hasCookie;
  const loading = accountQuery.isPending;

  return (
    <ManageSectionCard
      title="115 网盘凭据"
      description="通过扫码登录绑定 115 账号；扫码完成后会同时拿到 Cookie 与 Open Token，供目录扫描和播放链路使用。"
      actions={
        <div className={styles.rowActions}>
          {!isBound ? (
            <>
              <select
                value={cookieApp}
                onChange={(e) => setCookieApp(e.target.value)}
                disabled={startPending}
                title="选择扫码使用的 cookie 槽位（不同槽位不互相挤掉别的客户端）"
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
                {startPending ? '生成二维码…' : '扫码绑定'}
              </button>
            </>
          ) : (
            <>
              <button
                className={styles.smallButton}
                type="button"
                disabled={refreshMutation.isPending}
                onClick={() => refreshMutation.mutate()}
              >
                {refreshMutation.isPending ? '刷新中…' : '刷新 Open Token'}
              </button>
              <button
                className={styles.smallButton}
                type="button"
                disabled={healthMutation.isPending}
                onClick={() => healthMutation.mutate()}
              >
                {healthMutation.isPending ? '检测中…' : '健康检测'}
              </button>
              <button
                className={styles.smallButton}
                type="button"
                disabled={unbindMutation.isPending}
                onClick={() => setConfirmUnbind(true)}
              >
                {unbindMutation.isPending ? '解绑中…' : '解绑账号'}
              </button>
              <button
                className={styles.smallButton}
                type="button"
                onClick={openBrowseDialog}
                title="按 root_path 打开目录浏览器（绑定后可用）"
              >
                浏览目录
              </button>
              <button
                className={styles.smallButton}
                type="button"
                disabled={startPending}
                onClick={openQrDialog}
                title="重新扫码会覆盖当前 Cookie"
              >
                重新扫码
              </button>
            </>
          )}
        </div>
      }
    >
      {loading ? (
        <p className={styles.mutedText}>正在读取账号状态…</p>
      ) : accountQuery.isError ? (
        <InlineBanner variant="error" title="账号状态读取失败" description={getErrorMessage(accountQuery.error)} />
      ) : !isBound ? (
        <p className={styles.mutedText}>当前来源还未绑定 115 账号。点击右上角“扫码绑定”按钮，使用 115 客户端扫码即可完成。</p>
      ) : account ? (
        <div className={styles.fieldRow}>
          <div className={styles.stackText}>
            <span className={styles.mutedText}>账号 UID</span>
            {/* uid 不可得 = 已绑定但解析不到（后端 Option 为 null），fail-safe 展示非报错。 */}
            <span>{account.uid ?? '已绑定（uid 不可得）'}</span>
          </div>
          <div className={styles.stackText}>
            <span className={styles.mutedText}>账号状态</span>
            <StatusBadge label={account.status} variant={account.status.toLowerCase() === 'active' ? 'success' : 'warning'} />
          </div>
          <div className={styles.stackText}>
            <span className={styles.mutedText}>Open Token</span>
            <span>{account.hasOpenToken ? '已下发' : '未下发'}</span>
          </div>
          <div className={styles.stackText}>
            <span className={styles.mutedText}>最近活跃</span>
            <span>{account.lastActiveAt ? formatDateTime(account.lastActiveAt) : '—'}</span>
          </div>
          <div className={styles.stackText}>
            <span className={styles.mutedText}>更新时间</span>
            <span>{formatDateTime(account.updatedAt)}</span>
          </div>
        </div>
      ) : null}

      {refreshMutation.isError ? (
        <InlineBanner variant="error" title="刷新 Open Token 失败" description={getErrorMessage(refreshMutation.error)} />
      ) : null}
      {refreshMutation.isSuccess ? (
        <InlineBanner variant="success" title="Open Token 已刷新" description="下次目录扫描会使用新的访问令牌。" />
      ) : null}
      {healthReport ? (
        <InlineBanner
          variant={healthReport.ok ? 'success' : 'error'}
          title={healthReport.ok ? 'Cookie 健康' : 'Cookie 异常'}
          description={healthReport.reason ?? (healthReport.ok ? '当前 Cookie 可用。' : '请尝试重新扫码绑定。')}
        />
      ) : null}
      {unbindMutation.isError ? (
        <InlineBanner variant="error" title="解绑失败" description={getErrorMessage(unbindMutation.error)} />
      ) : null}

      <DetailModal
        open={qrOpen}
        eyebrow="扫码登录"
        title="115 网盘扫码绑定"
        description="请使用 115 移动端 App 扫描下方二维码并在手机上确认。"
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
              style={{ width: 220, height: 220, background: '#fff', padding: 8, borderRadius: 8 }}
            />
            <p className={styles.mutedText}>状态：{STATUS_LABELS[qrStatus]}</p>
            {activating ? <p className={styles.mutedText}>正在激活账号…</p> : null}
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
        ) : startPending ? (
          <p className={styles.mutedText}>正在请求二维码…</p>
        ) : null}
      </DetailModal>

      <DetailModal
        open={browseOpen}
        eyebrow="目录浏览"
        title="115 网盘目录浏览"
        description={`当前路径：${browsePath}（点击文件夹进入；走已绑定凭据的 accounts browse 端点，大目录为全量返回）`}
        onOpenChange={(next) => { if (!next) closeBrowseDialog(); }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflow: 'auto' }}>
          <div className={styles.rowActions}>
            <button
              className={styles.smallButton}
              type="button"
              disabled={browsePath === '/' || browseMutation.isPending}
              onClick={goUp}
            >
              ⬆ 上一级
            </button>
            <button
              className={styles.smallButton}
              type="button"
              disabled={browseMutation.isPending}
              onClick={() => browseMutation.mutate(browsePath)}
            >
              🔄 刷新
            </button>
          </div>
          {browseMutation.isPending ? (
            <p className={styles.mutedText}>正在加载目录…</p>
          ) : browseMutation.isError ? (
            <InlineBanner variant="error" title="目录加载失败" description={getErrorMessage(browseMutation.error)} />
          ) : browseEntries.length === 0 ? (
            <p className={styles.mutedText}>当前目录为空。</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {browseEntries.map((entry) => (
                <li key={entry.path}>
                  <button
                    type="button"
                    className={styles.smallButton}
                    style={{ width: '100%', textAlign: 'left' }}
                    disabled={!entry.isDir || browseMutation.isPending}
                    onClick={() => entry.isDir && browseMutation.mutate(entry.path)}
                  >
                    {entry.isDir ? '📁' : '📄'} {entry.name}
                    {entry.size !== null && !entry.isDir ? ` · ${entry.size} bytes` : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DetailModal>

      <ConfirmDialog
        open={confirmUnbind}
        title="解绑 115 账号"
        description={`确定要解绑当前来源（${currentDetail.mount.name}）的 115 账号吗？解绑后所有依赖该来源的扫描和播放都会停止工作，需要重新扫码绑定。`}
        confirmLabel="确认解绑"
        cancelLabel="取消"
        pending={unbindMutation.isPending}
        onOpenChange={(next) => { if (!next) setConfirmUnbind(false); }}
        onConfirm={() => unbindMutation.mutate()}
      />
    </ManageSectionCard>
  );
}

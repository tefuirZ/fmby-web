import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  licenseApi,
  licensePollStatuses,
  licenseRuntimeStates,
  licenseRuntimeTones,
} from '@fmby/v2-shared/contracts/manage/license';
import type { LicenseStatusRecord } from '@fmby/v2-shared/contracts/manage/license';
import {
  FeedbackState,
  InlineBanner,
  SensitiveActionDialog,
  StatusBadge,
  useToast,
} from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { isApiError } from '@fmby/v2-shared/types';
import { queryKeys } from '@fmby/v2-shared/query';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';
import styles from './longtail-shared/ManageShared.module.css';

/** 时间字段为 epoch 毫秒；空/非法统一返回 '—'。 */
function formatEpochMs(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return '—';
  }
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

/**
 * 授权与订阅管理页。
 *
 * 后端端点由 D 卡按本页契约实现；在本卡交付时后端尚不存在，因此页面以
 * fail-closed 引导态呈现（API 404/无法连通）而非崩溃——契约层在此冻结，
 * 页面据此先行落地。UI 仅为毛坯，后续按预期打磨。
 */
export function ManageLicensePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activationToken, setActivationToken] = useState('');
  const [activationOpen, setActivationOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: queryKeys.manage.license.status(),
    queryFn: async () => {
      try {
        return await licenseApi.getStatus();
      } catch (err) {
        // 后端未装配（端点不存在）时，fail-closed 呈现引导态而非让页面崩溃。
        if (isApiError(err) && err.code === 'NOT_FOUND') return null;
        throw err;
      }
    },
    staleTime: 15_000,
  });

  const refreshStatus = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.manage.license.status() });
  };

  const startMutation = useMutation({
    mutationFn: () => licenseApi.startDeviceFlow(),
    onSuccess: (res) => {
      applyActionResult(res.status);
      toast.success({ title: '设备流已发起', description: '请在授权页面确认后回来轮询结果。' });
    },
    onError: (err) => {
      setActionError(getErrorMessage(err));
    },
  });

  const pollMutation = useMutation({
    mutationFn: () => licenseApi.pollDeviceFlow(),
    onSuccess: (res) => {
      applyActionResult(res.status);
      const label = licensePollStatuses[res.pollStatus] ?? res.pollStatus;
      toast[res.pollStatus === 'authorized' ? 'success' : 'info']({
        title: '设备流轮询结果',
        description: label,
      });
    },
    onError: (err) => {
      setActionError(getErrorMessage(err));
    },
  });

  const activateMutation = useMutation({
    mutationFn: () => licenseApi.activateWithToken({ activationToken }),
    onSuccess: (res) => {
      applyActionResult(res.status);
      setActivationOpen(false);
      setActivationToken('');
      toast.success({ title: '激活凭据已换取授权', description: '授权状态已刷新。' });
    },
    onError: (err) => {
      setActionError(getErrorMessage(err));
    },
  });

  const heartbeatMutation = useMutation({
    mutationFn: () => licenseApi.heartbeat(),
    onSuccess: (res) => {
      applyActionResult(res.status);
      toast.success({ title: '手动心跳已完成', description: '授权租约已续期。' });
    },
    onError: (err) => {
      setActionError(getErrorMessage(err));
    },
  });

  /** 写操作返回的 status 与查询结果合并展示，并让查询失效以同步缓存。 */
  const applyActionResult = (status: LicenseStatusRecord) => {
    queryClient.setQueryData(queryKeys.manage.license.status(), status);
    refreshStatus();
  };

  // 设备流自动轮询：仅在存在 deviceFlow 且授权未进入 active 时推进；
  // 一旦 active，后续状态靠查询失效刷新，避免无限自轮询。
  const busy = startMutation.isPending || pollMutation.isPending || activateMutation.isPending || heartbeatMutation.isPending;
  const timers = useRef<number[]>([]);
  useEffect(() => {
    if (
      busy ||
      statusQuery.isPending ||
      statusQuery.isError ||
      !statusQuery.data?.deviceFlow ||
      statusQuery.data.runtimeState === 'active'
    ) {
      return;
    }
    const deviceFlow = statusQuery.data.deviceFlow;
    const pollIntervalMs = Math.max(3, deviceFlow.pollIntervalSecs ?? 5) * 1000;
    const timer = window.setTimeout(() => {
      pollMutation.mutate();
    }, pollIntervalMs);
    timers.current.push(timer);
    return () => {
      for (const t of timers.current) window.clearTimeout(t);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusQuery.data, busy, statusQuery.isPending, statusQuery.isError]);

  if (statusQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在读取授权状态"
        description="正在获取实例激活、租约和授权服务信息。"
      />
    );
  }

  if (statusQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="授权状态读取失败"
        description={getErrorMessage(statusQuery.error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={() => statusQuery.refetch()}>
            重试
          </button>
        }
      />
    );
  }

  const status = statusQuery.data;

  // 后端尚未装配（或返回空）→ fail-closed 引导态。
  if (!status) {
    return (
      <div className={styles.page}>
        <ManagePageHeader
          title="授权与订阅"
          description="查看实例授权状态、租约与心跳，发起设备流或一次性凭据激活。"
        />
        <ManageSectionCard title="授权服务未装配" description="后端授权端点尚未提供，本页以只读引导态呈现。">
          <InlineBanner
            variant="info"
            title="等待后端装配"
            description="授权与订阅端点尚未就绪。后端按本页冻结的契约实现后，这里会展示实例激活、租约与心跳信息。"
          />
          <button className={styles.secondaryButton} type="button" onClick={() => statusQuery.refetch()}>
            重新检测
          </button>
        </ManageSectionCard>
      </div>
    );
  }

  const runtimeLabel = licenseRuntimeStates[status.runtimeState] ?? status.runtimeState;
  const runtimeTone = licenseRuntimeTones[status.runtimeState] ?? 'neutral';

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="授权与订阅"
        description="查看实例授权状态、租约与心跳，发起设备流或一次性凭据激活。"
        actions={
          <button className={styles.secondaryButton} type="button" onClick={refreshStatus}>
            刷新状态
          </button>
        }
      />

      {actionError ? (
        <InlineBanner variant="error" title="授权操作失败" description={actionError} />
      ) : null}

      <ManageSectionCard title="授权状态" description="实例激活、业务访问与租约信息。">
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>
              <StatusBadge label={runtimeLabel} variant={runtimeTone} />
            </div>
            <div className={styles.metricLabel}>运行态</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>
              <StatusBadge
                label={status.businessAccessAllowed ? '允许' : '阻断'}
                variant={status.businessAccessAllowed ? 'success' : 'danger'}
              />
            </div>
            <div className={styles.metricLabel}>业务访问</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>
              <StatusBadge
                label={status.realtimeEnabled ? (status.realtimeStatus ?? '未知') : '未启用'}
                variant={status.realtimeEnabled ? 'info' : 'neutral'}
              />
            </div>
            <div className={styles.metricLabel}>实时连接</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>{status.summary.plan.label}</div>
            <div className={styles.metricLabel}>当前套餐</div>
          </div>
        </div>

        <div className={styles.fieldRow} style={{ marginTop: 16 }}>
          <div className={styles.stackText}>
            <span className={styles.mutedText}>授权服务</span>
            <span>{status.serverBaseUrl}</span>
          </div>
          <div className={styles.stackText}>
            <span className={styles.mutedText}>产品 / 租约</span>
            <span>
              {status.productCode ?? '未记录'} · {status.leaseId ? status.leaseId.slice(0, 8) : '未记录'}
            </span>
          </div>
          <div className={styles.stackText}>
            <span className={styles.mutedText}>生效 / 过期</span>
            <span>
              {formatEpochMs(status.notBefore)} — {formatEpochMs(status.expiresAt)}
            </span>
          </div>
          <div className={styles.stackText}>
            <span className={styles.mutedText}>下次心跳</span>
            <span>{formatEpochMs(status.nextHeartbeatAt)}</span>
          </div>
        </div>

        <div className={styles.rowActions} style={{ marginTop: 16 }}>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={busy}
            onClick={() => heartbeatMutation.mutate()}
          >
            手动心跳
          </button>
        </div>
      </ManageSectionCard>

      <ManageSectionCard title="设备流激活" description="打开授权页面、确认用户码后轮询结果。">
        {status.deviceFlow ? (
          <div className={styles.stackText}>
            <div className={styles.fieldRow}>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>用户码</span>
                <span>{status.deviceFlow.userCode}</span>
              </div>
              <div className={styles.stackText}>
                <span className={styles.mutedText}>过期时间</span>
                <span>{formatEpochMs(status.deviceFlow.expiresAt)}</span>
              </div>
            </div>
            <div className={styles.stackText}>
              <span className={styles.mutedText}>授权地址</span>
              <span>{status.deviceFlow.verificationUriComplete ?? status.deviceFlow.verificationUri}</span>
            </div>
            <div className={styles.rowActions}>
              <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => pollMutation.mutate()}>
                轮询一次
              </button>
              <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => startMutation.mutate()}>
                重新生成
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.emptyInlineState}>
            <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => startMutation.mutate()}>
              发起设备流
            </button>
            <p className={styles.mutedText} style={{ marginTop: 8 }}>
              生成授权地址后，在授权页面确认用户码即可完成激活。
            </p>
          </div>
        )}
      </ManageSectionCard>

      <ManageSectionCard title="兑换码激活" description="粘贴授权门户返回的一次性凭据以换取授权租约。">
        <div className={styles.fieldRow}>
          <button className={styles.secondaryButton} type="button" onClick={() => setActivationOpen(true)}>
            输入激活凭据
          </button>
        </div>
      </ManageSectionCard>

      <SensitiveActionDialog
        open={activationOpen}
        actionKey="activate-license-token"
        title="激活授权凭据"
        description="将一次性激活凭据提交到授权服务以换取新的授权租约。"
        impact={['该操作会更新当前实例的授权凭据。']}
        errorMessage={activateMutation.isError ? getErrorMessage(activateMutation.error) : undefined}
        confirmLabel="确认激活"
        pending={activateMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !activateMutation.isPending) {
            setActivationOpen(false);
          }
        }}
        onConfirm={() => activateMutation.mutate()}
      >
        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            一次性激活凭据
            <input
              className={styles.input}
              type="password"
              autoComplete="off"
              value={activationToken}
              onChange={(e) => setActivationToken(e.target.value)}
              placeholder="粘贴授权门户生成的一次性凭据"
            />
          </label>
        </div>
      </SensitiveActionDialog>
    </div>
  );
}

export default ManageLicensePage;

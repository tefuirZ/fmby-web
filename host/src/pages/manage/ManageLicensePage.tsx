/**
 * 授权与订阅管理页（W5-G 卡②：照 V1 `pages/manage/license/ManageLicensePage.tsx` 对位）。
 *
 * 消费 5 条真实后端端点（GET status / POST device-flow / device-flow/poll /
 * activation-token / heartbeat），不再走「后端尚未提供」的陈旧兜底面板。
 * 组件拆分为 LicenseStatusOverview / DeviceFlowCard / ActivationTokenCard /
 * LeaseDetailsCard / EntitlementsCard，交互模型照 V1。
 */

import { useState } from 'react';
import { BadgeCheck, KeyRound, ReceiptText } from 'lucide-react';
import type { LicensePollStatus } from '@fmby/v2-shared/contracts/manage/license';
import { FeedbackState, InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';
import styles from './longtail-shared/ManageShared.module.css';
import {
  ActivationTokenCard,
  DeviceFlowCard,
  EntitlementsCard,
  LeaseDetailsCard,
  LicenseStatusOverview,
} from './license/components';
import { useLicenseStatusQuery } from './license/hooks/useLicenseQueries';
import { useLicenseMutations } from './license/hooks/useLicenseMutations';
import { useLicenseDeviceFlowPolling } from './license/hooks/useLicenseDeviceFlowPolling';
import type { ManageLicenseActivationTokenForm } from './license/schemas';

export function ManageLicensePage() {
  const statusQuery = useLicenseStatusQuery();
  const [autoPolling, setAutoPolling] = useState(true);
  const [lastPollStatus, setLastPollStatus] = useState<LicensePollStatus | null>(null);
  const [activationSuccessSerial, setActivationSuccessSerial] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    startDeviceFlowMutation,
    pollDeviceFlowMutation,
    activateWithTokenMutation,
    heartbeatMutation,
  } = useLicenseMutations({ onDeviceFlowPoll: setLastPollStatus });

  useLicenseDeviceFlowPolling({
    status: statusQuery.data,
    enabled: autoPolling,
    pollMutation: pollDeviceFlowMutation,
  });

  if (statusQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载授权状态"
        description="正在读取本机实例身份、SignedLease 和最近心跳记录。"
      />
    );
  }

  if (statusQuery.isError || !statusQuery.data) {
    return (
      <FeedbackState
        variant="error"
        title="授权状态加载失败"
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

  function activateWithToken(value: ManageLicenseActivationTokenForm) {
    setSuccessMessage(null);
    activateWithTokenMutation.mutate(value, {
      onSuccess: () => {
        setActivationSuccessSerial(Date.now());
        setSuccessMessage('activation token 已换取新的 SignedLease。');
      },
    });
  }

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="授权与订阅"
        description="集中处理 FMBY 客户端实例激活、Device Flow 轮询、SignedLease 状态、能力与限制观测。"
        meta={
          <>
            <span className={styles.metaText}>实例：{status.instanceId ?? '尚未生成'}</span>
            <span className={styles.metaText}>Lease：{status.leaseId ?? '未签发'}</span>
          </>
        }
        actions={
          <button className={styles.secondaryButton} type="button" onClick={() => statusQuery.refetch()}>
            刷新状态
          </button>
        }
      />

      {successMessage ? (
        <InlineBanner
          variant="success"
          title={successMessage}
          description="页面已使用服务端返回的授权状态更新本地视图。"
        />
      ) : null}

      <ManageSectionCard title="授权状态" description="实例激活、业务访问、租约与实时控制通道。">
        <LicenseStatusOverview
          status={status}
          heartbeatPending={heartbeatMutation.isPending}
          heartbeatError={heartbeatMutation.error}
          onHeartbeat={() => {
            setSuccessMessage(null);
            heartbeatMutation.mutate(undefined, {
              onSuccess: () => setSuccessMessage('手动心跳已完成。'),
            });
          }}
        />
      </ManageSectionCard>

      <div className={styles.twoColumn}>
        <ManageSectionCard
          title="Device Flow"
          description="面向交互式管理员授权。发起后可自动轮询，也可手动轮询一次。"
          actions={<BadgeCheck size={18} />}
        >
          <DeviceFlowCard
            status={status}
            lastPollStatus={lastPollStatus}
            autoPolling={autoPolling}
            startPending={startDeviceFlowMutation.isPending}
            pollPending={pollDeviceFlowMutation.isPending}
            startError={startDeviceFlowMutation.error}
            pollError={pollDeviceFlowMutation.error}
            onAutoPollingChange={setAutoPolling}
            onStart={() => {
              setSuccessMessage(null);
              startDeviceFlowMutation.mutate(undefined, {
                onSuccess: () => setSuccessMessage('Device Flow 已发起。'),
              });
            }}
            onPoll={() => {
              setSuccessMessage(null);
              pollDeviceFlowMutation.mutate(undefined, {
                onSuccess: (result) => {
                  if (result.pollStatus === 'authorized') {
                    setSuccessMessage('Device Flow 已完成授权。');
                  }
                },
              });
            }}
          />
        </ManageSectionCard>

        <ManageSectionCard
          title="Activation Token"
          description="面向复制粘贴、自动部署或门户兑换后的直接激活路径。"
          actions={<KeyRound size={18} />}
        >
          <ActivationTokenCard
            pending={activateWithTokenMutation.isPending}
            error={activateWithTokenMutation.error}
            successSerial={activationSuccessSerial}
            onSubmit={activateWithToken}
          />
        </ManageSectionCard>
      </div>

      <ManageSectionCard
        title="SignedLease 摘要"
        description="这里只展示客户端已验证并持久化的签名 lease 关键字段，不展示服务端套餐或售卖语义。"
        actions={<ReceiptText size={18} />}
      >
        <LeaseDetailsCard status={status} />
      </ManageSectionCard>

      <ManageSectionCard
        title="能力、限制与策略"
        description="授权页主视图改展示服务端 summary 的套餐、用户额度和能力摘要；原始 entitlement 保留在状态里供诊断。"
      >
        <EntitlementsCard status={status} />
      </ManageSectionCard>
    </div>
  );
}

export default ManageLicensePage;

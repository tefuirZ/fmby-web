import { useEffect } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type {
  LicensePollResponseRecord,
  LicenseStatusRecord,
} from '@fmby/v2-shared/contracts/manage/license';

interface UseLicenseDeviceFlowPollingOptions {
  status?: LicenseStatusRecord;
  enabled: boolean;
  pollMutation: UseMutationResult<LicensePollResponseRecord, Error, void>;
}

/** 设备流自动轮询（照 V1）：仅在存在 deviceFlow 且未进入 active/grace 时按建议间隔推进。 */
export function useLicenseDeviceFlowPolling({
  status,
  enabled,
  pollMutation,
}: UseLicenseDeviceFlowPollingOptions) {
  useEffect(() => {
    if (!enabled || !status || !shouldPoll(status) || pollMutation.isPending) {
      return;
    }
    const timer = window.setTimeout(() => {
      pollMutation.mutate();
    }, getPollDelayMs(status));
    return () => window.clearTimeout(timer);
  }, [
    enabled,
    pollMutation,
    pollMutation.isPending,
    status?.deviceFlow?.deviceCode,
    status?.deviceFlow?.expiresAt,
    status?.deviceFlow?.pollIntervalSecs,
    status?.runtimeState,
  ]);
}

function shouldPoll(status: LicenseStatusRecord) {
  if (!status.deviceFlow) return false;
  if (status.runtimeState === 'active' || status.runtimeState === 'grace') {
    return false;
  }
  if (!status.deviceFlow.expiresAt) return true;
  // 非展示用途：仅用 epoch 判断 Device Flow 是否还需要继续轮询。
  return status.deviceFlow.expiresAt > Date.now();
}

function getPollDelayMs(status: LicenseStatusRecord) {
  const seconds = status.deviceFlow?.pollIntervalSecs ?? 5;
  return Math.min(Math.max(seconds, 2), 120) * 1000;
}

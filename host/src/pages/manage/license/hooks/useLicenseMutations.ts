import { useMutation, useQueryClient } from '@tanstack/react-query';
import { licenseApi } from '@fmby/v2-shared/contracts/manage/license';
import type {
  LicensePollStatus,
  LicenseStatusRecord,
} from '@fmby/v2-shared/contracts/manage/license';
import { queryKeys } from '@fmby/v2-shared/query';

interface UseLicenseMutationsOptions {
  onStatusUpdated?: (status: LicenseStatusRecord) => void;
  onDeviceFlowPoll?: (pollStatus: LicensePollStatus) => void;
}

/** 四个写操作（照 V1 `useLicenseMutations`）：成功即把返回 status 写回缓存。 */
export function useLicenseMutations({
  onStatusUpdated,
  onDeviceFlowPoll,
}: UseLicenseMutationsOptions = {}) {
  const queryClient = useQueryClient();

  function setStatus(status: LicenseStatusRecord) {
    queryClient.setQueryData(queryKeys.manage.license.status(), status);
    onStatusUpdated?.(status);
  }

  const startDeviceFlowMutation = useMutation({
    mutationFn: () => licenseApi.startDeviceFlow(),
    onSuccess: (result) => {
      setStatus(result.status);
      onDeviceFlowPoll?.('pending');
    },
  });

  const pollDeviceFlowMutation = useMutation({
    mutationFn: () => licenseApi.pollDeviceFlow(),
    onSuccess: (result) => {
      setStatus(result.status);
      onDeviceFlowPoll?.(result.pollStatus);
    },
  });

  const activateWithTokenMutation = useMutation({
    mutationFn: licenseApi.activateWithToken,
    onSuccess: (result) => {
      setStatus(result.status);
      onDeviceFlowPoll?.('authorized');
    },
  });

  const heartbeatMutation = useMutation({
    mutationFn: () => licenseApi.heartbeat(),
    onSuccess: (result) => {
      setStatus(result.status);
    },
  });

  return {
    startDeviceFlowMutation,
    pollDeviceFlowMutation,
    activateWithTokenMutation,
    heartbeatMutation,
  };
}

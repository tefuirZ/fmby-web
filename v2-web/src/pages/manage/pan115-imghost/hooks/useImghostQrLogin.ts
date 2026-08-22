import { useQueryClient } from '@tanstack/react-query';
import { pan115ImghostApi } from '@/domains/manage/pan115Imghost';
import type { Pan115ImghostQrcodeStatus } from '@/domains/manage/pan115Imghost';
import { queryKeys } from '@/shared/query-keys';
import { usePan115QrLogin } from '@/shared/hooks/usePan115QrLogin';
import type { UsePan115QrLoginResult } from '@/shared/hooks/usePan115QrLogin';

export type UseImghostQrLoginResult = UsePan115QrLoginResult<Pan115ImghostQrcodeStatus>;

export interface UseImghostQrLoginOptions {
  cookieApp?: string;
}

export function useImghostQrLogin(options: UseImghostQrLoginOptions = {}): UseImghostQrLoginResult {
  const queryClient = useQueryClient();

  return usePan115QrLogin<Pan115ImghostQrcodeStatus>({
    initialStatus: 'waiting',
    signedStatus: 'signed',
    terminalStatuses: ['expired', 'canceled', 'aborted'],
    startQrLogin: () => pan115ImghostApi.startQrLogin({}),
    pollQrStatus: (sessionId) => pan115ImghostApi.pollQrStatus(sessionId),
    activate: (sessionId) => pan115ImghostApi.activate({
      sessionId,
      cookieApp: options.cookieApp,
    }),
    onActivated: () => queryClient.invalidateQueries({
      queryKey: queryKeys.manage.pan115Imghost.credentials(),
    }),
  });
}

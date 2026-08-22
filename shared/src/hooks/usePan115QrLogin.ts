import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { isApiError } from '@fmby/v2-shared/types';
import { getErrorMessage } from '@fmby/v2-shared/errors';

export interface Pan115QrSession {
  sessionId: string;
  uid: string;
  qrUrl: string;
  qrImage?: string;
}

export interface UsePan115QrLoginOptions<TStatus extends string> {
  initialStatus: TStatus;
  signedStatus: TStatus;
  terminalStatuses: readonly TStatus[];
  startQrLogin: () => Promise<Pan115QrSession>;
  pollQrStatus: (sessionId: string) => Promise<{ status: TStatus }>;
  activate: (sessionId: string) => Promise<unknown>;
  onActivated?: () => Promise<unknown> | unknown;
  pollIntervalMs?: number;
  retryDelayMs?: number;
  maxPollErrorRetries?: number;
}

export interface UsePan115QrLoginResult<TStatus extends string> {
  qrOpen: boolean;
  qrSession: Pan115QrSession | null;
  qrStatus: TStatus;
  qrError: string | null;
  activating: boolean;
  startPending: boolean;
  openQrDialog: () => void;
  closeQrDialog: () => void;
}

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_RETRY_DELAY_MS = 2000;
const DEFAULT_MAX_POLL_ERROR_RETRIES = 3;

export function usePan115QrLogin<TStatus extends string>(
  options: UsePan115QrLoginOptions<TStatus>,
): UsePan115QrLoginResult<TStatus> {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [qrOpen, setQrOpen] = useState(false);
  const [qrSession, setQrSession] = useState<Pan115QrSession | null>(null);
  const [qrStatus, setQrStatus] = useState<TStatus>(options.initialStatus);
  const [qrError, setQrError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const pollTimerRef = useRef<number | null>(null);
  const cancelRef = useRef<{ aborted: boolean } | null>(null);
  const runIdRef = useRef(0);
  const startRequestIdRef = useRef(0);
  const activeStartRequestIdRef = useRef(0);
  const mountedRef = useRef(true);

  const isCurrentRun = (runId: number, tag: { aborted: boolean }) =>
    mountedRef.current && runIdRef.current === runId && !tag.aborted;

  const stopPolling = () => {
    runIdRef.current += 1;
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (cancelRef.current) {
      cancelRef.current.aborted = true;
      cancelRef.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, []);

  const closeQrDialog = () => {
    stopPolling();
    setQrOpen(false);
    setQrSession(null);
    setQrStatus(optionsRef.current.initialStatus);
    setQrError(null);
    setActivating(false);
  };

  const startQrLoginMutation = useMutation({
    mutationFn: async (requestId: number) => ({
      requestId,
      session: await optionsRef.current.startQrLogin(),
    }),
    onSuccess: (data) => {
      if (
        !mountedRef.current ||
        data.requestId !== activeStartRequestIdRef.current
      ) {
        return;
      }
      stopPolling();
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      setQrSession(data.session);
      setQrStatus(optionsRef.current.initialStatus);
      setQrError(null);
      setActivating(false);
      setQrOpen(true);

      const tag = { aborted: false };
      cancelRef.current = tag;
      let pollErrorRetries = 0;

      const tick = async () => {
        if (!isCurrentRun(runId, tag)) return;

        try {
          const resp = await optionsRef.current.pollQrStatus(data.session.sessionId);
          if (!isCurrentRun(runId, tag)) return;

          setQrStatus(resp.status);
          setQrError(null);
          pollErrorRetries = 0;

          if (resp.status === optionsRef.current.signedStatus) {
            if (pollTimerRef.current !== null) {
              window.clearTimeout(pollTimerRef.current);
              pollTimerRef.current = null;
            }
            setActivating(true);
            try {
              await optionsRef.current.activate(data.session.sessionId);
              await optionsRef.current.onActivated?.();
              if (!isCurrentRun(runId, tag)) return;
              closeQrDialog();
            } catch (err) {
              if (!isCurrentRun(runId, tag)) return;
              setActivating(false);
              setQrError(getErrorMessage(err));
            }
            return;
          }

          if (optionsRef.current.terminalStatuses.includes(resp.status)) {
            stopPolling();
            return;
          }

          pollTimerRef.current = window.setTimeout(
            tick,
            optionsRef.current.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
          );
        } catch (err) {
          if (!isCurrentRun(runId, tag)) return;
          setQrError(getErrorMessage(err));
          if (!isRetryablePollError(err)) {
            stopPolling();
            setQrStatus(optionsRef.current.initialStatus);
            return;
          }
          pollErrorRetries += 1;
          if (
            pollErrorRetries >
            (optionsRef.current.maxPollErrorRetries ?? DEFAULT_MAX_POLL_ERROR_RETRIES)
          ) {
            stopPolling();
            setQrStatus(optionsRef.current.initialStatus);
            return;
          }
          pollTimerRef.current = window.setTimeout(
            tick,
            optionsRef.current.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
          );
        }
      };

      pollTimerRef.current = window.setTimeout(tick, 0);
    },
    onError: (err, requestId) => {
      if (
        !mountedRef.current ||
        requestId !== activeStartRequestIdRef.current
      ) {
        return;
      }
      stopPolling();
      setQrSession(null);
      setQrStatus(optionsRef.current.initialStatus);
      setQrError(getErrorMessage(err));
      setQrOpen(true);
    },
  });

  return {
    qrOpen,
    qrSession,
    qrStatus,
    qrError,
    activating,
    startPending: startQrLoginMutation.isPending,
    openQrDialog: () => {
      stopPolling();
      setQrSession(null);
      setQrStatus(optionsRef.current.initialStatus);
      setQrError(null);
      setActivating(false);
      setQrOpen(true);
      const requestId = startRequestIdRef.current + 1;
      startRequestIdRef.current = requestId;
      activeStartRequestIdRef.current = requestId;
      startQrLoginMutation.mutate(requestId);
    },
    closeQrDialog,
  };
}

function isRetryablePollError(error: unknown): boolean {
  if (isApiError(error)) return error.retryable === true;
  if (error instanceof TypeError) return true;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return false;
}

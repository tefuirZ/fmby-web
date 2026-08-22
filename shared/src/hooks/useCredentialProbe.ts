import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from './useDebounce';
import { httpClient } from '@fmby/v2-shared/api/client';
import { isApiError } from '@fmby/v2-shared/types';

export type CredentialProbeStatus = 'idle' | 'probing' | 'success' | 'error';

export interface CredentialProbeResult {
  status: CredentialProbeStatus;
  message?: string;
}

interface CredentialProbeConfig {
  enabled?: boolean;
  providerType: string;
  endpoint: string;
  authMode: string;
  username: string;
  password: string;
  token: string;
}

/**
 * 凭证自动探测 hook
 *
 * 监听连接配置变化，防抖 500ms 后自动调用后端 validate API。
 * 仅在必要字段都填写后才触发探测。
 */
export function useCredentialProbe(config: CredentialProbeConfig): CredentialProbeResult {
  const [result, setResult] = useState<CredentialProbeResult>({ status: 'idle' });
  const lastSettledFingerprintRef = useRef<string | null>(null);

  const configFingerprint = useMemo(() => createProbeFingerprint(config), [
    config.enabled,
    config.providerType,
    config.endpoint,
    config.authMode,
    config.username,
    config.password,
    config.token,
  ]);

  const debouncedFingerprint = useDebounce(configFingerprint, 500);

  useEffect(() => {
    if (config.enabled === false) {
      setResult({ status: 'idle' });
      lastSettledFingerprintRef.current = null;
      return;
    }

    // 只对远端来源生效
    const isRemote = config.providerType === 'alist' || config.providerType === 'openlist';
    if (!isRemote) {
      setResult({ status: 'idle' });
      lastSettledFingerprintRef.current = null;
      return;
    }

    // 检查 endpoint 是否为合法 URL
    let isValidUrl = false;
    try {
      const url = new URL(config.endpoint.trim());
      isValidUrl = url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      // not valid
    }

    if (!isValidUrl) {
      setResult({ status: 'idle' });
      lastSettledFingerprintRef.current = null;
      return;
    }

    const hasPartialUsernamePassword =
      (config.username.trim() !== '' && config.password.trim() === '') ||
      (config.username.trim() === '' && config.password.trim() !== '');
    if (hasPartialUsernamePassword) {
      setResult({ status: 'idle' });
      lastSettledFingerprintRef.current = null;
      return;
    }

    if (lastSettledFingerprintRef.current === debouncedFingerprint) {
      return;
    }

    // 开始探测
    let cancelled = false;
    const controller = new AbortController();
    setResult({ status: 'probing' });

    const configJson: Record<string, unknown> = {
      endpoint: config.endpoint.trim(),
    };

    if (config.authMode === 'token' && config.token.trim() !== '') {
      configJson.token = config.token.trim();
    } else if (config.username.trim() !== '' && config.password.trim() !== '') {
      configJson.username = config.username.trim();
      configJson.password = config.password.trim();
    }

    httpClient
      .post<unknown>('/api/manage/mounts/browse-directories', {
        body: {
          provider_type: config.providerType,
          config_json: configJson,
          path: '/',
        },
        signal: controller.signal,
      })
      .then(() => {
        if (!cancelled) {
          lastSettledFingerprintRef.current = debouncedFingerprint;
          setResult({ status: 'success', message: '连接成功' });
        }
      })
      .catch((error: unknown) => {
        if (cancelled || isAbortError(error)) return;
        lastSettledFingerprintRef.current = debouncedFingerprint;

        if (isApiError(error)) {
          const code = error.code ?? '';
          if (code.includes('AUTH') || code.includes('401') || code.includes('403')) {
            setResult({ status: 'error', message: '凭证无效' });
          } else {
            setResult({ status: 'error', message: error.message || '连接失败' });
          }
        } else if (error instanceof Error) {
          setResult({ status: 'error', message: error.message });
        } else {
          setResult({ status: 'error', message: '连接失败' });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFingerprint]);

  return result;
}

function createProbeFingerprint(config: CredentialProbeConfig): string {
  const payload = [
    config.providerType.trim(),
    config.endpoint.trim(),
    config.authMode.trim(),
    config.username.trim(),
    config.password,
    config.token,
  ].join('\u0001');

  let hash = 0;
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash * 31 + payload.charCodeAt(i)) >>> 0;
  }
  return String(hash);
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

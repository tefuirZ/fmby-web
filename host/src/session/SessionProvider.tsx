import {
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { authApi } from '@fmby/v2-shared/contracts/auth';
import { SessionContext } from '@/session/context';
import {
  type User,
  type Capability,
  type SessionState,
  type SessionStatus,
} from '@fmby/v2-shared/types';
import {
  isSessionInvalidationError,
  subscribeAuthFailure,
} from '@fmby/v2-shared/errors/authFailure';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { logger } from '@fmby/v2-shared/utils/logger';

interface SessionProviderProps {
  children: ReactNode;
}

const RESTORE_RETRY_BASE_MS = 1_500;
const RESTORE_RETRY_MAX_MS = 10_000;

function computeRestoreRetryDelay(attempt: number) {
  return Math.min(
    RESTORE_RETRY_BASE_MS * Math.pow(2, Math.max(0, attempt - 1)),
    RESTORE_RETRY_MAX_MS,
  );
}

/**
 * 会话状态管理 Provider
 *
 * 启动时会尝试通过 Cookie 恢复当前会话；
 * 登录成功后更新内存态；
 * 登出时调用后端接口并清理本地状态。
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const restoreAttemptRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const [restoreVersion, setRestoreVersion] = useState(0);

  const clearScheduledRetry = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const scheduleRestoreRetry = useCallback(
    (attempt: number) => {
      clearScheduledRetry();
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        setRestoreVersion((value) => value + 1);
      }, computeRestoreRetryDelay(attempt));
    },
    [clearScheduledRetry],
  );

  const applySession = useCallback((nextUser: User) => {
    clearScheduledRetry();
    restoreAttemptRef.current = 0;
    setRestoreError(null);
    setUser(nextUser);
    setStatus('authenticated');
  }, [clearScheduledRetry]);

  const clearSession = useCallback(() => {
    clearScheduledRetry();
    restoreAttemptRef.current = 0;
    setRestoreError(null);
    setUser(null);
    setStatus('unauthenticated');
  }, [clearScheduledRetry]);

  const hasCapability = useCallback(
    (cap: Capability): boolean => {
      if (!user) return false;
      return user.capabilities.includes(cap);
    },
    [user],
  );

  const login = useCallback((loginUser: User) => {
    applySession(loginUser);
  }, [applySession]);

  const retryRestore = useCallback(() => {
    clearScheduledRetry();
    setStatus((current) =>
      current === 'authenticated' ? current : 'loading',
    );
    setRestoreVersion((value) => value + 1);
  }, [clearScheduledRetry]);

  const logout = useCallback(() => {
    void authApi
      .logout()
      .catch((error) => {
        if (!isSessionInvalidationError(error)) {
          // 本地会话无论如何都会在 finally 里清掉，这里只在开发态留个线索。
          logger.error('登出失败', error);
        }
      })
      .finally(() => {
        clearSession();
      });
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const session = await authApi.getSession();
        if (!cancelled) {
          applySession(session);
        }
      } catch (error) {
        if (cancelled) return;

        if (isSessionInvalidationError(error)) {
          clearSession();
          return;
        }

        restoreAttemptRef.current += 1;
        // 失败原因已经通过 restoreError 呈现给用户，控制台输出只服务于开发调试。
        logger.error('恢复会话失败，准备重试', error);
        setRestoreError(getErrorMessage(error));
        setStatus('recovering');
        scheduleRestoreRetry(restoreAttemptRef.current);
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession, restoreVersion, scheduleRestoreRetry]);

  useEffect(() => {
    return () => {
      clearScheduledRetry();
    };
  }, [clearScheduledRetry]);

  useEffect(() => {
    return subscribeAuthFailure(() => {
      clearSession();
    });
  }, [clearSession]);

  const value: SessionState = {
    status,
    user,
    restoreError,
    hasCapability,
    login,
    logout,
    retryRestore,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * 获取当前会话状态
 * @throws 如果在 SessionProvider 外使用会报错
 */
export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession 必须在 SessionProvider 内部使用');
  }
  return ctx;
}

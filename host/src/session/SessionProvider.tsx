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
import { hasCapabilityIn } from '@fmby/v2-shared/contracts/auth';
import {
  isSessionInvalidationError,
  subscribeAuthFailure,
} from '@fmby/v2-shared/errors/authFailure';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { isNotFound } from '@fmby/v2-shared/errors';
import { isInstallModeInProgress } from '@/pages/install/installStatus';
import { logger } from '@fmby/v2-shared/utils/logger';

interface SessionProviderProps {
  children: ReactNode;
}

const RESTORE_RETRY_BASE_MS = 1_500;
const RESTORE_RETRY_MAX_MS = 10_000;

/**
 * 当前是否安装模式进行中（INSTALL-FIRST-ROUND-UX B）。
 *
 * 安装模式进程不挂 `/auth/me` ⇒ 该端点 404 是**预期**，不是网络波动。
 * 拉不到 install/status（已安装实例 404 / 网络错）⇒ 返回 false（交回正常会话逻辑）。
 */
async function isInstallModeActive(): Promise<boolean> {
  try {
    return isInstallModeInProgress(await authApi.getInstallStatus());
  } catch {
    return false;
  }
}

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

  // #289：能力判定走 shared 唯一事实源（角色**全等枚举**，废除 `includes('admin')`
  // 子串放行 —— 后者会让 admin_readonly / super-admin 等相似名角色误命中越权视图）。
  const hasCapability = useCallback(
    (cap: Capability): boolean => hasCapabilityIn(user, cap),
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

        // INSTALL-FIRST-ROUND-UX B：安装模式进程不挂 /auth/me ⇒ 404 是预期，非网络波动。
        // 命中 404 且 /api/install/status 报安装中 ⇒ 静默清会话（不设 restoreError、不排重试），
        // 交给 InstallModeGuard 重定向 /install；否则此处会陷入 404 重试风暴 + 误导的
        // 「网络波动，正在重试恢复会话」横幅。横幅只在下方真网络错误 / 5xx 路径出现。
        if (isNotFound(error) && (await isInstallModeActive())) {
          if (!cancelled) clearSession();
          return;
        }

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

/**
 * 会话类型定义
 */

import type { User, Capability } from './user';

/** 会话状态枚举 */
export type SessionStatus =
  | 'loading'
  | 'recovering'
  | 'authenticated'
  | 'unauthenticated';

/** 会话上下文值 */
export interface SessionState {
  /** 当前会话状态 */
  status: SessionStatus;
  /** 当前登录用户（未登录时为 null） */
  user: User | null;
  /** 恢复会话失败时的最近错误 */
  restoreError: string | null;
  /** 当前用户是否具备指定能力 */
  hasCapability: (cap: Capability) => boolean;
  /** 登录成功后更新会话状态 */
  login: (user: User) => void;
  /** 登出 */
  logout: () => void;
  /** 手动重试恢复会话 */
  retryRestore: () => void;
}

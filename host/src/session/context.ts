import { createContext } from 'react';
import type { SessionState } from '@/shared/types';

/**
 * 将 SessionContext 提取到稳定模块，避免开发时 HMR 造成
 * Provider / Consumer 引用到不同的上下文实例。
 */
export const SessionContext = createContext<SessionState | null>(null);

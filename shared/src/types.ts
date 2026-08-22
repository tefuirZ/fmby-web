/**
 * 兼容 barrel：旧 `@/shared/types` 导出面
 *
 * v2 三层拆分后实体归位：
 * - User / Session* → contracts/auth（会话 DTO 合同）
 * - ApiError → errors
 * - UI 类型 → ui/types
 * 页面应优先从对应子路径导入；本文件仅为迁移期兼容保留。
 */

export type { User, UserRole, Capability } from './contracts/auth/user';
export type { SessionState, SessionStatus } from './contracts/auth/session';
export type { ApiError } from './errors/error';
export { isApiError } from './errors/error';
export type { BannerState } from './ui/types';

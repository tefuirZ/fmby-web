/**
 * host 会话域（docs/09：登录、会话属宿主壳）
 *
 * - SessionProvider：探测 /api/auth/me，维护会话状态，订阅 auth 失效事件
 * - useSession：页面/守卫读取会话与 capabilities
 */

export { SessionProvider, useSession } from './SessionProvider';
export { SessionContext } from './context';

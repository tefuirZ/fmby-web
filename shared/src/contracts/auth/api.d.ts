/**
 * 认证域 API 服务
 *
 * 封装认证相关的 HTTP 请求：
 * - 登录
 * - 初始化设置（创建管理员）
 * - 检查初始化状态
 */
import type { User } from '@fmby/v2-shared/types';
export interface LoginRequest {
    username: string;
    password: string;
}
export interface RegisterRequest {
    code: string;
    username: string;
    password: string;
    display_name?: string;
}
export interface SetupRequest {
    username: string;
    password: string;
    display_name?: string;
}
export interface AuthResponse {
    user: User;
}
export type SessionResponse = User;
export interface SetupStatusResponse {
    needs_setup: boolean;
    registration_enabled: boolean;
    registration_requires_code: boolean;
}
export interface LogoutResponse {
    ok: boolean;
}
export interface RegisterResponse {
    status: 'authenticated' | 'pending_approval';
    message: string;
    user?: User | null;
}
export declare const authApi: {
    /** 用户登录 */
    login(data: LoginRequest): Promise<AuthResponse>;
    /** 使用注册码注册 */
    register(data: RegisterRequest): Promise<RegisterResponse>;
    /** 初始化设置 — 创建管理员账户 */
    setup(data: SetupRequest): Promise<AuthResponse>;
    /** 获取当前会话 */
    getSession(): Promise<User>;
    /** 获取初始化状态 */
    getSetupStatus(): Promise<SetupStatusResponse>;
    /** 登出当前会话 */
    logout(): Promise<LogoutResponse>;
};
//# sourceMappingURL=api.d.ts.map
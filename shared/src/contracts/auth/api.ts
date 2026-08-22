/**
 * 认证域 API 服务
 *
 * 封装认证相关的 HTTP 请求：
 * - 登录
 * - 初始化设置（创建管理员）
 * - 检查初始化状态
 */

import { httpClient } from '@fmby/v2-shared/api/client';
import type { User } from '@fmby/v2-shared/types';

/* ---- 请求类型 ---- */

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

/* ---- 响应类型 ---- */

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

/* ---- API 方法 ---- */

export const authApi = {
  /** 用户登录 */
  login(data: LoginRequest) {
    return httpClient.post<AuthResponse>('/api/auth/login', { body: data });
  },

  /** 使用注册码注册 */
  register(data: RegisterRequest) {
    return httpClient.post<RegisterResponse>('/api/auth/register', { body: data });
  },

  /** 初始化设置 — 创建管理员账户 */
  setup(data: SetupRequest) {
    return httpClient.post<AuthResponse>('/api/auth/setup', { body: data });
  },

  /** 获取当前会话 */
  getSession() {
    return httpClient.get<SessionResponse>('/api/session');
  },

  /** 获取初始化状态 */
  getSetupStatus() {
    return httpClient.get<SetupStatusResponse>('/api/auth/entry/status');
  },

  /** 登出当前会话 */
  logout() {
    return httpClient.delete<LogoutResponse>('/api/auth/logout');
  },
};

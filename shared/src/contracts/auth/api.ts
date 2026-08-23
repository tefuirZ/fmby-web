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

export interface MeResponse {
  userId: number;
  capabilities: string[];
  user?: User;
}

export function mapMeResponse(raw: unknown): MeResponse {
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const userId = typeof record.user_id === 'number' ? record.user_id : typeof record.userId === 'number' ? record.userId : 0;
  const capabilities = Array.isArray(record.capabilities) ? record.capabilities.filter((c): c is string => typeof c === 'string') : [];
  return {
    userId,
    capabilities,
  };
}

/* ---- API 方法 ---- */

export const authApi = {
  /** 用户登录 */
  async login(data: LoginRequest): Promise<AuthResponse> {
    const raw = await httpClient.post<{ user_id?: number; token?: string; user?: User }>('/api/auth/login', { body: data });
    let capabilities = ['Browse', 'ManageAccess', 'ManageLibrary', 'ManageSettings', 'DangerousAction', 'ViewAudit'];
    try {
      const meRaw = await httpClient.get<MeResponse>('/api/auth/me');
      const me = mapMeResponse(meRaw);
      if (me.capabilities && me.capabilities.length > 0) {
        capabilities = me.capabilities;
      }
    } catch {
      // fallback
    }
    const user: User = raw.user || {
      id: String(raw.user_id || 1),
      name: data.username,
      display_name: data.username === 'admin' ? '系统管理员' : data.username,
      roles: data.username === 'admin' ? ['Admin'] : ['User'],
      capabilities,
    };
    return { user };
  },

  /** 当前会话与能力检查（docs/interfaces/webui.md） */
  me() {
    return httpClient.get<MeResponse>('/api/auth/me');
  },

  /** 使用注册码注册 */
  register(data: RegisterRequest) {
    return httpClient.post<RegisterResponse>('/api/auth/register', { body: data });
  },

  /** 初始化设置 — 创建管理员账户 */
  setup(data: SetupRequest) {
    return httpClient.post<AuthResponse>('/api/auth/setup', { body: data });
  },

  /** 获取当前会话（docs/interfaces/webui.md GET /api/auth/me） */
  async getSession(): Promise<SessionResponse> {
    const raw = await httpClient.get<MeResponse>('/api/auth/me');
    const me = mapMeResponse(raw);
    return {
      id: String(me.userId),
      name: 'admin',
      display_name: '系统管理员',
      roles: ['Admin'],
      capabilities: me.capabilities,
    };
  },

  /** 获取初始化状态 */
  getSetupStatus() {
    return httpClient.get<SetupStatusResponse>('/api/auth/entry/status');
  },

  /** 登出当前会话（docs/interfaces/webui.md POST /api/auth/logout） */
  async logout() {
    try {
      await httpClient.post<void>('/api/auth/logout');
    } catch {
      await httpClient.delete<LogoutResponse>('/api/auth/logout');
    }
  },
};


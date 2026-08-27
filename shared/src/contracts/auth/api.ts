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

export type InstallDatabaseKind = 'sqlite' | 'postgresql';

export interface InstallStatusResponse {
  state?: string;
  needs_install?: boolean;
  database_configured?: boolean;
  can_probe?: boolean;
}

export interface DatabaseProbeRequest {
  kind: InstallDatabaseKind;
  path?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  url?: string;
}

export interface DatabaseProbeResponse {
  kind?: string;
  reachable?: boolean;
  ok?: boolean;
  message?: string;
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

/**
 * 会话用户名本地缓存。
 *
 * 后端契约限制：/api/auth/login 与 /api/auth/me 均只返回 user_id + capabilities
 * （见 fmby-v2-http routes/auth.rs 的 LoginResponse / MeResponse），不提供用户名。
 * 页面刷新后通过 Cookie 恢复会话时，用户名只能来自登录时本地缓存；
 * 拿不到时宁可为空，也不得回退到 'admin'/'系统管理员' 之类的硬编码默认身份。
 */
const SESSION_USERNAME_STORAGE_KEY = 'fmby:v2:session-username';

let cachedSessionUsername: string | null = null;

function persistSessionUsername(username: string): void {
  cachedSessionUsername = username;
  try {
    sessionStorage.setItem(SESSION_USERNAME_STORAGE_KEY, username);
  } catch {
    // sessionStorage 不可用（隐私模式/禁用）时仅保留内存缓存
  }
}

function readSessionUsername(): string | null {
  if (cachedSessionUsername === null) {
    try {
      cachedSessionUsername = sessionStorage.getItem(SESSION_USERNAME_STORAGE_KEY);
    } catch {
      cachedSessionUsername = null;
    }
  }
  return cachedSessionUsername;
}

function clearSessionUsername(): void {
  cachedSessionUsername = null;
  try {
    sessionStorage.removeItem(SESSION_USERNAME_STORAGE_KEY);
  } catch {
    // 清理失败不影响安全语义：内存缓存已置空
  }
}

export const authApi = {
  /** 用户登录 */
  async login(data: LoginRequest): Promise<AuthResponse> {
    const raw = await httpClient.post<{ user_id?: number; token?: string; user?: User }>('/api/auth/login', { body: data });
    // 登录成功后缓存用户名，供后续会话恢复（getSession）使用
    persistSessionUsername(data.username);
    let capabilities: string[] = [];
    try {
      const meRaw = await httpClient.get<MeResponse>('/api/auth/me');
      capabilities = mapMeResponse(meRaw).capabilities;
    } catch {
      // A failed capability lookup must fail closed; never infer admin access from the username.
    }
    const user: User = raw.user || {
      id: String(raw.user_id || 1),
      name: data.username,
      display_name: data.username,
      // 后端登录契约不返回 roles；禁止从用户名推断 Admin，统一空列表 fail-closed，
      // 权限判断只信任 capabilities。
      roles: [],
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
    const username = readSessionUsername();
    return {
      id: String(me.userId),
      // 用户名来自登录时的本地缓存；后端契约不提供时宁可为空，也不伪造默认身份。
      name: username ?? '',
      display_name: username ?? undefined,
      // 后端契约不返回 roles；空列表 fail-closed，权限判断只信任 capabilities。
      roles: [],
      capabilities: me.capabilities,
    };
  },

  /** 获取初始化状态 */
  getSetupStatus() {
    return httpClient.get<SetupStatusResponse>('/api/auth/entry/status');
  },

  getInstallStatus() {
    return httpClient.get<InstallStatusResponse>('/api/install/status');
  },

  probeDatabase(data: DatabaseProbeRequest) {
    return httpClient.post<DatabaseProbeResponse>('/api/install/probe/database', { body: data });
  },

  /** 登出当前会话（docs/interfaces/webui.md POST /api/auth/logout） */
  async logout() {
    try {
      await httpClient.post<void>('/api/auth/logout');
    } catch {
      await httpClient.delete<LogoutResponse>('/api/auth/logout');
    } finally {
      clearSessionUsername();
    }
  },
};


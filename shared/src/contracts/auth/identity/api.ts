/**
 * 三方身份登录 API（消费后端 identity 登录链四端点）。
 *
 * 端点（main 现状，`docs/interfaces/webui.md`）：
 * - `GET  /api/auth/identity/providers`                       公开可用性列表（免会话）
 * - `POST /api/auth/identity/{provider}/login/start`          发起（免会话）
 * - `POST /api/auth/identity/{provider}/login/complete`       完成（免会话；成功建会话）
 * - `POST /api/auth/identity/{provider}/login/status`         轮询（免会话；**仅 Telegram**）
 * - `GET  /api/auth/identity/{provider}/callback`             收 OAuth 回调参数（免会话）
 *
 * CSRF：写方法由 `httpClient` 自动回显 `fmby_csrf` cookie → `x-csrf-token`（登录链
 * 端点免会话，登录后 cookie 才存在；本模块**不**自行处理该工件）。
 *
 * 诚实纪律：后端 503（发信面/通道未接线）等失败**原样上抛**为 `ApiError`，
 * 绝不吞掉后返回空结果假装成功。
 */

import { httpClient } from '@fmby/v2-shared/api/client';
import type { User } from '@fmby/v2-shared/types';
import { mapMeResponse } from '../api';
import {
  loginReadyProviders,
  mapIdentityCallbackCapture,
  mapIdentityComplete,
  mapIdentityLoginStart,
  mapProviderList,
  mapTelegramLoginStatus,
} from './mappers';
import type { RawIdentityLoginComplete } from './raw-types';
import type {
  IdentityCallbackCapture,
  IdentityLoginCompleteResult,
  IdentityLoginStart,
  IdentityProviderAvailability,
  IdentityProviderType,
  TelegramLoginStatus,
} from './types';

/** 组装 `/auth/me` 的 User（与 `/auth/login` 同法；用户名不可得时留空，不伪造）。 */
async function assembleUser(userId: number, usernameHint?: string): Promise<User> {
  let capabilities: string[] = [];
  try {
    const me = mapMeResponse(await httpClient.get<unknown>('/api/auth/me'));
    capabilities = me.capabilities;
  } catch {
    // 能力查询失败 fail-closed：绝不由用户名推断权限（与 authApi.login 同纪律）。
  }
  return {
    id: String(userId),
    name: usernameHint ?? '',
    display_name: usernameHint,
    roles: [],
    capabilities,
  };
}

/** 提交 `complete`；成功则经 `/auth/me` 组装用户，MFA 分支不建会话。 */
export async function completeIdentityLogin(
  provider: IdentityProviderType,
  input: { challengeId: string; code?: string; verificationCode?: string },
): Promise<IdentityLoginCompleteResult> {
  const raw = await httpClient.post<unknown>(
    `/api/auth/identity/${provider}/login/complete`,
    {
      body: {
        challenge_id: input.challengeId,
        code: input.code,
        verification_code: input.verificationCode,
      },
    },
  );
  const outcome = mapIdentityComplete(raw as RawIdentityLoginComplete);
  if (outcome.status === 'mfa_required') {
    return {
      status: 'mfa_required',
      challengeId: outcome.challengeId,
      expiresAtMs: outcome.expiresAtMs,
    };
  }
  // 成功分支：user_id 由后端 `LoginResponse` 给出；缺失时经 `/auth/me` 取权威值。
  let userId = outcome.userId;
  if (userId === undefined) {
    try {
      userId = mapMeResponse(await httpClient.get<unknown>('/api/auth/me')).userId;
    } catch {
      // 取不到则保持 undefined，由 assembleUser 以 0 表达未知（不伪造具体身份）。
    }
  }
  return { status: 'authenticated', user: await assembleUser(userId ?? 0) };
}

/** 三方身份登录 API 集合。 */
export const identityLoginApi = {
  /** 公开 provider 可用性列表（免会话）。 */
  async providers(): Promise<IdentityProviderAvailability[]> {
    return mapProviderList(await httpClient.get<unknown>('/api/auth/identity/providers'));
  },

  /** 仅登录就绪（enabled && configured && loginEnabled）的 provider。 */
  async loginReadyProviders(): Promise<IdentityProviderAvailability[]> {
    return loginReadyProviders(await this.providers());
  },

  /** 发起登录（Google 返回 `authorizeUrl`；Telegram 返回深链；Email 返码）。 */
  async start(
    provider: IdentityProviderType,
    input: { email?: string; redirectUri?: string } = {},
  ): Promise<IdentityLoginStart> {
    const raw = await httpClient.post<unknown>(
      `/api/auth/identity/${provider}/login/start`,
      { body: { email: input.email, redirect_uri: input.redirectUri } },
    );
    const mapped = mapIdentityLoginStart(raw as never);
    if (!mapped) {
      // 形状不可用：如实报错，不构造半成品流状态。
      throw new Error('三方登录发起响应缺少 provider / challenge_id。');
    }
    return mapped;
  },

  /** 完成登录（成功建会话；MFA 启用则返 `mfa_required`，不建会话）。 */
  complete: completeIdentityLogin,

  /** Telegram 登录状态轮询（**仅 Telegram**，其他 provider 后端 400）。 */
  async telegramStatus(input: {
    challengeId: string;
    completionToken: string;
  }): Promise<TelegramLoginStatus> {
    const raw = await httpClient.post<unknown>(
      '/api/auth/identity/telegram/login/status',
      {
        body: {
          challenge_id: input.challengeId,
          completion_token: input.completionToken,
        },
      },
    );
    return mapTelegramLoginStatus(raw as never);
  },

  /** 收 OAuth 回调参数（**不消费 challenge、不建会话**）。 */
  async captureCallback(
    provider: IdentityProviderType,
    params: { challengeId?: string; code?: string; state?: string },
  ): Promise<IdentityCallbackCapture> {
    const raw = await httpClient.get<unknown>(`/api/auth/identity/${provider}/callback`, {
      params: {
        challenge_id: params.challengeId?.trim() || undefined,
        code: params.code?.trim() || undefined,
        state: params.state?.trim() || undefined,
      },
    });
    const mapped = mapIdentityCallbackCapture(raw as never);
    if (!mapped) {
      throw new Error('三方登录回调响应缺少 provider。');
    }
    return mapped;
  },
};

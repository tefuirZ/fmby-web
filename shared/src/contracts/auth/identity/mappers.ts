/**
 * 三方身份登录 raw → domain 映射（纯函数，无副作用；HTTP 编排见 `./api`）。
 *
 * 纪律：缺字段/casing 漂移一律**宽容降级**（不抛异常、不编造身份）；真正需要
 * HTTP 侧补全的（`authenticated` 的 User 组装）由 `api.ts` 经 `/auth/me` 完成。
 */

import { asRecord, readArray, readBoolean, readNumber, readString } from '@fmby/v2-shared/api/mapping';
import type {
  IdentityCallbackCapture,
  IdentityLoginStart,
  IdentityProviderAvailability,
  IdentityProviderType,
  TelegramLoginStatus,
} from './types';
import type {
  RawIdentityCallbackCapture,
  RawIdentityLoginStart,
  RawIdentityLoginComplete,
  RawTelegramLoginStatus,
} from './raw-types';

const KNOWN_PROVIDERS: readonly IdentityProviderType[] = [
  'google',
  'telegram',
  'email',
  'github',
  'oidc',
];

/** 未知 provider 值 → `undefined`（绝不猜测成一个有效 provider）。 */
export function normalizeProviderType(value: unknown): IdentityProviderType | undefined {
  const text = readString(value)?.toLowerCase();
  return KNOWN_PROVIDERS.find((provider) => provider === text);
}

/**
 * `login/complete` 的判定结果（HTTP 编排中间态）。
 *
 * `authenticated` 只带 `userId`：后端的成功响应是 `LoginResponse`（仅
 * `user_id` + cookie），用户名/能力须另经 `/auth/me` 组装（与 `/auth/login` 同法）
 * ——本层不伪造任何身份字段。
 */
export type IdentityCompleteOutcome =
  | { status: 'authenticated'; userId?: number }
  | { status: 'mfa_required'; challengeId: string; expiresAtMs: number };

/** `login/complete` 响应 → 判定结果。 */
export function mapIdentityComplete(raw: RawIdentityLoginComplete): IdentityCompleteOutcome {
  const record = asRecord(raw);  const status = readString(record.status)?.toLowerCase();
  if (status === 'mfa_required') {
    return {
      status: 'mfa_required',
      challengeId: readString(record.challenge_id, record.challengeId) ?? '',
      // 非有限值回落 0（epoch 起点）：UI 侧只作展示，不据此做安全判定。
      expiresAtMs: readNumber(record.expires_at, record.expiresAt) ?? 0,
    };
  }
  // 缺 status 视为成功分支（后端成功态才有会话 cookie）；userId 可缺省，
  // 由 `/auth/me` 权威补齐。
  return { status: 'authenticated', userId: readNumber(record.user_id, record.userId) };
}

/** `GET /api/auth/identity/providers` 单个 item。 */
export function mapProviderAvailability(raw: unknown): IdentityProviderAvailability | null {
  const record = asRecord(raw);
  const provider = normalizeProviderType(record.provider);
  if (!provider) {
    return null;
  }
  const enabled = readBoolean(record.enabled) ?? false;
  // 与后端 `provider_capabilities` 对齐：缺省以 enabled 兜底（V1 mapper 同口径），
  // 但显式 false 优先（不把「明确关闭」误读成开启）。
  const loginEnabled =
    readBoolean(record.login_enabled, record.loginEnabled) ?? enabled;
  const bindingEnabled =
    readBoolean(record.binding_enabled, record.bindingEnabled) ?? enabled;
  const passwordResetEnabled =
    readBoolean(record.password_reset_enabled, record.passwordResetEnabled) ?? false;
  return {
    provider,
    displayName: readString(record.display_name, record.displayName) ?? provider,
    enabled,
    loginEnabled,
    bindingEnabled,
    passwordResetEnabled,
    configured: readBoolean(record.configured) ?? false,
  };
}

/** provider 列表响应 → item 数组（宽容缺失段）。 */
export function mapProviderList(raw: unknown): IdentityProviderAvailability[] {
  const record = asRecord(raw);
  const items = readArray(
    Array.isArray(record.items) ? record.items : record.providers,
    mapProviderAvailability,
  );
  return items;
}

/** `login/start` 响应。 */
export function mapIdentityLoginStart(raw: RawIdentityLoginStart): IdentityLoginStart | null {
  const record = asRecord(raw);
  const provider = normalizeProviderType(record.provider);
  const challengeId = readString(record.challenge_id, record.challengeId);
  // 缺 provider/challenge_id 的响应不可用（无法继续流）——如实返回 null。
  if (!provider || !challengeId) {
    return null;
  }
  return {
    provider,
    challengeId,
    action: readString(record.action) ?? '',
    authorizeUrl: readString(record.authorize_url, record.authorizeUrl),
    deliveryStatus: readString(record.delivery_status, record.deliveryStatus),
    completionToken: readString(record.completion_token, record.completionToken),
    message: readString(record.message),
    expiresAt: readString(record.expires_at, record.expiresAt) ?? '',
  };
}

/** Telegram `login/status` 响应。 */
export function mapTelegramLoginStatus(raw: RawTelegramLoginStatus): TelegramLoginStatus {
  const record = asRecord(raw);
  return {
    verified: readBoolean(record.verified) ?? false,
    expiresAt: readString(record.expires_at, record.expiresAt) ?? '',
  };
}

/** OAuth 回调捕获响应。 */
export function mapIdentityCallbackCapture(
  raw: RawIdentityCallbackCapture,
): IdentityCallbackCapture | null {
  const record = asRecord(raw);
  const provider = normalizeProviderType(record.provider);
  if (!provider) {
    return null;
  }
  return {
    provider,
    challengeId: readString(record.challenge_id, record.challengeId) ?? '',
    receivedCode: readBoolean(record.received_code, record.receivedCode) ?? false,
    message: readString(record.message) ?? '',
  };
}

/**
 * 登录入口候选：`enabled && configured && loginEnabled`（V1
 * `getIdentityLoginDiscoveryProviders` 的等价过滤；Email 亦纳入——后端
 * Email `start` 未装配发信面时返 503，前端**如实呈现不可用**，见 `api.ts`）。
 */
export function loginReadyProviders(
  providers: readonly IdentityProviderAvailability[],
): IdentityProviderAvailability[] {
  return providers.filter(
    (provider) => provider.enabled && provider.configured && provider.loginEnabled,
  );
}

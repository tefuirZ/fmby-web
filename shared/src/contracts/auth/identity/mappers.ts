/**
 * 三方身份登录 raw → domain 映射（纯函数，无副作用；HTTP 编排见 `./api`）。
 *
 * 纪律：缺字段/casing 漂移一律**宽容降级**（不抛异常、不编造身份）；真正需要
 * HTTP 侧补全的（`authenticated` 的 User 组装）由 `api.ts` 经 `/auth/me` 完成。
 */

import { asRecord, readArray, readBoolean, readNumber, readString } from '@fmby/v2-shared/api/mapping';
import type {
  AccountIdentityBinding,
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
  // 绑定能力 **fail-closed**：后端公开视图逐字段下发 `binding_enabled`，缺失即
  // 无法确认可绑定 → 一律 false（绝不回落 enabled 把「未知」当「可绑定」）。
  const bindingEnabled = readBoolean(record.binding_enabled, record.bindingEnabled) ?? false;
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

/**
 * 绑定入口候选：`enabled && bindingEnabled`（fail-closed）。
 *
 * 与 `loginReadyProviders` 不同，**不**额外要求 `configured`：后端 `binding_enabled`
 * 已表达 `allow_bind`（Telegram 走 enabled+configured 隐式开放），`configured` 与否
 * 由后端 `start_binding` 裁决并如实报错，前端不擅自隐藏后端声明可绑的 provider。
 */
export function bindingReadyProviders(
  providers: readonly IdentityProviderAvailability[],
): IdentityProviderAvailability[] {
  return providers.filter((provider) => provider.enabled && provider.bindingEnabled);
}

/**
 * `GET /api/account/identity-bindings` 单个 item / `complete` 的 `binding` 段。
 *
 * 缺 id 或未知 provider 的条目**不可用**（无法稳定 keying / 无有效 provider），
 * 如实返回 `null` 由列表丢弃——绝不猜测成有效绑定。
 */
export function mapAccountIdentityBinding(raw: unknown): AccountIdentityBinding | null {
  const record = asRecord(raw);
  const provider = normalizeProviderType(record.provider);
  const id = readString(record.id);
  if (!provider || !id) {
    return null;
  }
  return {
    id,
    provider,
    providerSubject: readString(record.provider_subject, record.providerSubject) ?? '',
    providerEmail: readString(record.provider_email, record.providerEmail) ?? null,
    providerUsername: readString(record.provider_username, record.providerUsername) ?? null,
    providerDisplayName:
      readString(record.provider_display_name, record.providerDisplayName) ?? null,
    verifiedAt: readString(record.verified_at, record.verifiedAt) ?? '',
    lastUsedAt: readString(record.last_used_at, record.lastUsedAt) ?? null,
  };
}

/** `GET /api/account/identity-bindings` 响应（容忍 `{items}` / 裸数组；坏项丢弃）。 */
export function mapAccountIdentityBindings(raw: unknown): AccountIdentityBinding[] {
  const source = Array.isArray(raw) ? raw : asRecord(raw).items;
  return readArray(source, mapAccountIdentityBinding);
}

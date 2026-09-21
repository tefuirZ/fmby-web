/**
 * 邮件通道配置 API（EMAIL-CHANNEL / WEB-EMAIL-UI ① ②）。
 *
 * 端点：
 * - GET  /api/settings/server/email   → 配置回显（密码永不回明文）
 * - PUT  /api/settings/server/email   → 保存（password 留空 = 不改）
 * - POST /api/settings/server/email/test → 发送测试邮件（真发，fail-closed）
 *
 * 错误语义 fail-closed：后端 400/403/500 由 httpClient 统一抛 ApiError，
 * 页面不吞、不伪造「已发送」。
 */

import { httpClient } from '@fmby/v2-shared/api/client';

export type EmailSecurity = 'starttls' | 'tls' | 'plain';
export type EmailResetDelivery = 'code' | 'link' | 'password';

interface RawEmailChannelSettings {
  configured: boolean;
  secret_fields_configured: string[];
  host: string;
  port: number;
  /** Rust `String`（非 Option）→ wire 恒为字符串，空串=未填。 */
  security: string;
  username: string;
  from_address: string;
  reset_delivery: string;
  code_len: number;
  /** Rust `Option<i64>` → 未设时为 null。 */
  code_ttl_minutes: number | null;
  link_ttl_minutes: number | null;
  html_template: string;
}

interface RawEmailTestResponse {
  sent: boolean;
  to: string;
}

/** GET 回显（camelCase 视图层）。密码字段不在其中。
 * 注：后端 `username`/`html_template` 是 Rust `String`（空串=未填，非 null）。
 */
export interface EmailChannelSettings {
  configured: boolean;
  secretFieldsConfigured: string[];
  host: string;
  port: number;
  security: EmailSecurity;
  username: string;
  fromAddress: string;
  resetDelivery: EmailResetDelivery;
  codeLen: number;
  codeTtlMinutes: number;
  linkTtlMinutes: number;
  htmlTemplate: string;
}

/** 页面草稿：password 为只写字段，默认空（留空 = 不改）。 */
export interface EmailChannelDraft {
  host: string;
  port: number;
  security: EmailSecurity;
  username: string;
  password: string;
  fromAddress: string;
  resetDelivery: EmailResetDelivery;
  codeLen: number;
  codeTtlMinutes: number;
  linkTtlMinutes: number;
  htmlTemplate: string;
}

export interface EmailTestResponse {
  sent: boolean;
  to: string;
}

function mapEmailChannel(raw: RawEmailChannelSettings): EmailChannelSettings {
  return {
    configured: raw.configured,
    secretFieldsConfigured: Array.isArray(raw.secret_fields_configured)
      ? raw.secret_fields_configured
      : [],
    host: raw.host,
    port: raw.port,
    // security/reset_delivery 是 Rust String：非法值后端 400，前端容错归一到合法枚举
    security: normalizeSecurity(raw.security),
    username: raw.username,
    fromAddress: raw.from_address,
    resetDelivery: normalizeDelivery(raw.reset_delivery),
    codeLen: raw.code_len,
    codeTtlMinutes: raw.code_ttl_minutes ?? DEFAULT_CODE_TTL_MINUTES,
    linkTtlMinutes: raw.link_ttl_minutes ?? DEFAULT_LINK_TTL_MINUTES,
    htmlTemplate: raw.html_template,
  };
}

/** 契约默认值（EMAIL-WEB-UI ① 表）。 */
const DEFAULT_PORT = 587;
const DEFAULT_SECURITY: EmailSecurity = 'starttls';
const DEFAULT_DELIVERY: EmailResetDelivery = 'code';
const DEFAULT_CODE_LEN = 6;
const DEFAULT_CODE_TTL_MINUTES = 10;
const DEFAULT_LINK_TTL_MINUTES = 15;

/** Rust 侧 security/reset_delivery 是 String（非枚举）：非法值归一到契约默认。 */
function normalizeSecurity(value: string): EmailSecurity {
  return value === 'tls' || value === 'plain' || value === 'starttls' ? value : DEFAULT_SECURITY;
}

function normalizeDelivery(value: string): EmailResetDelivery {
  return value === 'link' || value === 'password' || value === 'code' ? value : DEFAULT_DELIVERY;
}

/** GET 回显 → 页面草稿（填默认值；password 只写重置为空，留空=不改）。 */
export function mapEmailChannelToDraft(settings: EmailChannelSettings): EmailChannelDraft {
  return {
    host: settings.host ?? '',
    port: settings.port ?? DEFAULT_PORT,
    security: settings.security ?? DEFAULT_SECURITY,
    username: settings.username ?? '',
    // 密码只写：GET 不回明文，草稿留空表示不改
    password: '',
    fromAddress: settings.fromAddress ?? '',
    resetDelivery: settings.resetDelivery ?? DEFAULT_DELIVERY,
    codeLen: settings.codeLen ?? DEFAULT_CODE_LEN,
    codeTtlMinutes: settings.codeTtlMinutes ?? DEFAULT_CODE_TTL_MINUTES,
    linkTtlMinutes: settings.linkTtlMinutes ?? DEFAULT_LINK_TTL_MINUTES,
    htmlTemplate: settings.htmlTemplate ?? '',
  };
}

/**
 * 草稿 → PUT body。wire 字段名全 snake_case（后端 `UpdateEmailChannelSettingsRequest`
 * 裸派生 serde，字段全 `Option`）。
 * - password 留空则**省略**（Option 缺省 = 不改密，后端语义）；
 * - username / html_template 是 Rust `String`（非 Option）→ 空串归一为 `null`
 *   会反序列化失败，故原样发空串。
 */
export function buildEmailChannelPutBody(
  draft: EmailChannelDraft,
): Record<string, unknown> {
  return {
    host: draft.host,
    port: draft.port,
    security: draft.security,
    username: draft.username,
    from_address: draft.fromAddress,
    reset_delivery: draft.resetDelivery,
    code_len: draft.codeLen,
    code_ttl_minutes: draft.codeTtlMinutes,
    link_ttl_minutes: draft.linkTtlMinutes,
    html_template: draft.htmlTemplate,
    // 只写：留空 = 不改（省略字段，而非发空串）
    ...(draft.password !== '' ? { password: draft.password } : {}),
  };
}

export const emailChannelApi = {
  async getEmailChannel(): Promise<EmailChannelSettings> {
    const raw = await httpClient.get<RawEmailChannelSettings>('/api/settings/server/email');
    return mapEmailChannel(raw);
  },

  async putEmailChannel(draft: EmailChannelDraft): Promise<EmailChannelSettings> {
    const raw = await httpClient.put<RawEmailChannelSettings>(
      '/api/settings/server/email',
      { body: buildEmailChannelPutBody(draft) },
    );
    return mapEmailChannel(raw);
  },

  /** ② 发送测试邮件：缺省自寄发件地址（to 不传）。 */
  async testEmail(to?: string): Promise<EmailTestResponse> {
    const raw = await httpClient.post<RawEmailTestResponse>(
      '/api/settings/server/email/test',
      { body: to && to.trim() !== '' ? { to: to.trim() } : {} },
    );
    return { sent: raw.sent, to: raw.to };
  },
};

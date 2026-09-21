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
  security: EmailSecurity;
  username: string | null;
  from_address: string;
  reset_delivery: EmailResetDelivery;
  code_len: number;
  code_ttl_minutes: number;
  link_ttl_minutes: number;
  html_template: string | null;
}

interface RawEmailTestResponse {
  sent: boolean;
  to: string;
}

/** GET 回显（camelCase）。密码字段不在其中。 */
export interface EmailChannelSettings {
  configured: boolean;
  secretFieldsConfigured: string[];
  host: string;
  port: number;
  security: EmailSecurity;
  username: string | null;
  fromAddress: string;
  resetDelivery: EmailResetDelivery;
  codeLen: number;
  codeTtlMinutes: number;
  linkTtlMinutes: number;
  htmlTemplate: string | null;
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
    security: raw.security,
    username: raw.username,
    fromAddress: raw.from_address,
    resetDelivery: raw.reset_delivery,
    codeLen: raw.code_len,
    codeTtlMinutes: raw.code_ttl_minutes,
    linkTtlMinutes: raw.link_ttl_minutes,
    htmlTemplate: raw.html_template,
  };
}

/** GET 回显 → 页面草稿（填默认值；password 只写重置为空，留空=不改）。 */
export function mapEmailChannelToDraft(settings: EmailChannelSettings): EmailChannelDraft {
  return {
    host: settings.host ?? '',
    port: settings.port ?? 587,
    security: settings.security ?? 'starttls',
    username: settings.username ?? '',
    password: '',
    fromAddress: settings.fromAddress ?? '',
    resetDelivery: settings.resetDelivery ?? 'code',
    codeLen: settings.codeLen ?? 6,
    codeTtlMinutes: settings.codeTtlMinutes ?? 10,
    linkTtlMinutes: settings.linkTtlMinutes ?? 15,
    htmlTemplate: settings.htmlTemplate ?? '',
  };
}

/**
 * 草稿 → PUT body（snake_case）。
 * password 留空则省略字段（不改密）；username/html_template 空串归一为 null。
 */
export function buildEmailChannelPutBody(
  draft: EmailChannelDraft,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    host: draft.host,
    port: draft.port,
    security: draft.security,
    username: draft.username === '' ? null : draft.username,
    from_address: draft.fromAddress,
    reset_delivery: draft.resetDelivery,
    code_len: draft.codeLen,
    code_ttl_minutes: draft.codeTtlMinutes,
    link_ttl_minutes: draft.linkTtlMinutes,
    html_template: draft.htmlTemplate === '' ? null : draft.htmlTemplate,
  };
  if (draft.password !== '') {
    body.password = draft.password;
  }
  return body;
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

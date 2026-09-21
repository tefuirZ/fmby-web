/**
 * 密码重置链接路由解析（EMAIL-CHANNEL / WEB-EMAIL-UI ④）。
 *
 * 契约：重置页路由**固定** `/login#password-reset?ticket=...`，**不得做成可配置路由**。
 * 因此这里硬编码 hash 前缀；登录页据 hash 渲染重置表单（同 `/login` 路由，无新路由）。
 */

/** 固定 hash 前缀（契约冻结，不得改为可配置）。 */
export const PASSWORD_RESET_HASH = '#password-reset';

/**
 * 从 location.hash 解析重置 ticket。
 * 形如 `#password-reset?ticket=abc` → `'abc'`；前缀不符或缺 ticket → `null`。
 */
export function parsePasswordResetHash(hash: string): string | null {
  if (!hash.startsWith(PASSWORD_RESET_HASH)) {
    return null;
  }
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) {
    return null;
  }
  const params = new URLSearchParams(hash.slice(queryIndex + 1));
  const ticket = params.get('ticket');
  return ticket && ticket.trim() !== '' ? ticket : null;
}

/** 生成 A 形态 start 的 session_id（后端若回 challenge 则优先用 challenge）。 */
export function createResetSessionId(): string {
  const cryptoObj = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  return `pwr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 授权页共享格式化与安全辅助（V2 形态：时间字段为 epoch 毫秒）。
 *
 * V1 的 `formatDateTime` 吃 ISO 字符串；V2 契约时间统一 epoch ms，故此处提供
 * epoch 版格式化，语义（空/非法 → '—'，zh-CN 时区）与 V1 对齐。
 */

/** epoch ms → 中文日期时间；空/非法/非正 → '—'。 */
export function formatEpochMs(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return '—';
  }
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

/** epoch ms → 相对时间描述（照 V1 formatRelativeTime 语义）；空 → '—'。 */
export function formatEpochRelative(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return '—';
  }
  const deltaMs = value - Date.now();
  const formatter = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' });
  const units: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
    { unit: 'day', ms: 24 * 60 * 60 * 1000 },
    { unit: 'hour', ms: 60 * 60 * 1000 },
    { unit: 'minute', ms: 60 * 1000 },
  ];
  for (const entry of units) {
    if (Math.abs(deltaMs) >= entry.ms || entry.unit === 'minute') {
      return formatter.format(Math.round(deltaMs / entry.ms), entry.unit);
    }
  }
  return '刚刚';
}

/** 复制到剪贴板：安全上下文用异步 API，否则回退临时 textarea（照 V1 clipboard 兜底）。 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

/** 仅放行 http/https 外链，防 `javascript:` 等危险 href（照 V1 safeExternalHref 语义）。 */
export function safeExternalHref(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** 短 ID 展示（前 8 位）；空 → '—'。 */
export function shortId(value: string | null | undefined): string {
  if (!value) return '—';
  return value.slice(0, 8);
}

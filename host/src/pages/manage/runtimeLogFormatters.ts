// runtime 日志呈现：纯值格式化函数（format*/normalize*/cleanup）。
// 从 runtimeLogPresentation.ts 拆出（FE-COMPONENT-SPLIT-B2）；无 JSX、无业务逻辑分支。

import { HTTP_STATUS_LABELS } from './runtimeLogLabels';

export function cleanupFieldValue(value: string) {
  if (!value) {
    return undefined;
  }

  let normalized = value.replace(/\s+$/u, '').replace(/^,\s*/u, '').trim();
  if (normalized === '' || normalized === 'None' || normalized === 'unknown') {
    return undefined;
  }

  const someMatch = normalized.match(/^Some\((.+)\)$/u);
  if (someMatch) {
    normalized = someMatch[1].trim();
  }

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized === '' ? undefined : normalized;
}

function formatByteCount(value: string) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return value;
  }
  return `${numericValue} 字节`;
}

export function shortenValue(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function formatDurationTicks(value: string) {
  const ticks = Number(value);
  if (!Number.isFinite(ticks) || ticks <= 0) {
    return value;
  }

  const totalSeconds = Math.floor(ticks / 10_000_000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours} 小时`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} 分`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} 秒`);
  }

  return parts.join(' ');
}

export function formatFieldValue(key: string, value: string) {
  switch (key) {
    case 'elapsed_ms':
      return `${value} 毫秒`;
    case 'duration_ticks':
      return formatDurationTicks(value);
    case 'status':
      return formatHttpStatus(value);
    case 'method':
      return value.toUpperCase();
    case 'request_size':
      return formatByteCount(value);
    case 'ip':
      return value === 'unknown' ? '未记录' : value;
    case 'source_status':
      return formatSourceStatus(value);
    case 'provider_type':
      return formatProviderType(value);
    case 'token_carrier':
      return formatTokenCarrier(value);
    case 'resolve_reason':
      return formatResolveReason(value);
    case 'direct_play_candidate':
      return formatBoolean(value);
    default:
      return formatCommonValue(value);
  }
}

export function normalizeUnknown(value?: string) {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  if (normalized === '' || normalized === 'unknown' || normalized === 'None') {
    return undefined;
  }
  return normalized;
}

function formatHttpStatus(value: string) {
  const code = Number.parseInt(value, 10);
  if (!Number.isFinite(code)) {
    return value;
  }

  const label = HTTP_STATUS_LABELS[code];
  return label ? `${code} ${label}` : `${code}`;
}

export function prettifyKey(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.toUpperCase())
    .join(' ');
}

function formatTokenCarrier(value: string) {
  switch (value.trim().toLowerCase()) {
    case 'query':
      return '查询参数';
    case 'header':
      return '请求头';
    case 'cookie':
      return 'Cookie';
    default:
      return value;
  }
}

function formatResolveReason(value: string) {
  switch (value.trim().toLowerCase()) {
    case 'detail_prefetch':
      return '详情预热';
    case 'playback_context':
      return '播放上下文';
    case 'stream_request':
      return '流请求';
    case 'session_create':
      return '会话创建';
    default:
      return value;
  }
}

function formatProviderType(value: string) {
  switch (value.trim().toLowerCase()) {
    case 'local':
      return '本地目录';
    case 'alist':
      return 'AList';
    case 'openlist':
      return 'OpenList';
    case 'webdav':
      return 'WebDAV';
    case 's3-compatible':
      return 'S3 兼容存储';
    default:
      return value;
  }
}

function formatBoolean(value: string) {
  switch (value.trim().toLowerCase()) {
    case 'true':
      return '是';
    case 'false':
      return '否';
    default:
      return value;
  }
}

function formatSourceStatus(value: string) {
  switch (value.trim().toLowerCase()) {
    case 'playable':
      return '可播放';
    case 'pendingvalidation':
      return '待验证';
    case 'unreachable':
      return '不可达';
    case 'unsupported':
      return '不支持';
    case 'authexpired':
      return '凭据过期';
    default:
      return value;
  }
}

function formatCommonValue(value: string) {
  if (/^(true|false)$/iu.test(value)) {
    return formatBoolean(value);
  }
  return value;
}

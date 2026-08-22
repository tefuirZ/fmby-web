import type { RuntimeLogRecord } from '@/domains/manage';

const TARGET_LABELS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^http_access$/i, label: '网页请求' },
  { pattern: /^compat_access$/i, label: '兼容客户端请求' },
  { pattern: /^fmby_server$/i, label: '服务进程' },
  { pattern: /playback::service::context/i, label: '播放上下文' },
  { pattern: /playback::service::targets/i, label: '播放目标解析' },
  { pattern: /playback::service::prefetch/i, label: '播放预热' },
  { pattern: /metadata::worker/i, label: '技术参数探测工人' },
  { pattern: /manage::runtime_logs/i, label: '运行日志解析' },
  { pattern: /routes::playback_core/i, label: '兼容播放路由' },
];

const EVENT_LABELS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^compat user item detail request$/i, label: '兼容详情请求' },
  { pattern: /^compat playback info request$/i, label: '兼容播放信息请求' },
  { pattern: /^compat resolve_playable_item_id$/i, label: '解析可播放媒体项' },
  { pattern: /^compat PlaybackInfo decision ok$/i, label: '兼容播放决策成功' },
  { pattern: /^compat PlaybackInfo decision failed$/i, label: '兼容播放决策失败' },
  { pattern: /^compat PlaybackInfo built stream url$/i, label: '已生成兼容播放地址' },
  { pattern: /^compat item stream request$/i, label: '兼容流请求' },
  { pattern: /^compat stream -> redirect$/i, label: '兼容流重定向到远端' },
  { pattern: /^playback build_context: item found$/i, label: '已找到媒体项' },
  { pattern: /^playback build_context: available source$/i, label: '发现可用来源' },
  { pattern: /^playback build_context: selected source$/i, label: '已选中来源' },
  { pattern: /^playback source select: no playable source available$/i, label: '没有可用播放源' },
  { pattern: /^playback resolve_provider_target start$/i, label: '开始解析播放目标' },
  { pattern: /^playback resolve_provider_target: remote cache hit$/i, label: '远端缓存命中' },
  { pattern: /^playback resolve_provider_target: remote cache miss$/i, label: '远端缓存未命中' },
  { pattern: /^playback resolve_provider_target: upstream resolved$/i, label: '远端解析完成' },
  { pattern: /^playback resolve_provider_target: redirect url$/i, label: '已获得跳转地址' },
  { pattern: /^playback remote redirect prewarm ok$/i, label: '远端跳转预热成功' },
  { pattern: /^playback detail prewarm finished$/i, label: '详情预热完成' },
  { pattern: /^请求完成$/i, label: '请求完成' },
  { pattern: /^请求失败$/i, label: '请求失败' },
];

const FIELD_LABELS: Record<string, string> = {
  method: '请求方式',
  path: '请求路径',
  status: '状态码',
  elapsed_ms: '耗时',
  client: '客户端',
  ip: 'IP 地址',
  request_size: '请求体大小',
  content_type: '内容类型',
  request_id: '请求 ID',
  user_id: '用户 ID',
  username: '用户名',
  display_name: '显示名称',
  item_id: '媒体项 ID',
  effective_item_id: '生效媒体项 ID',
  source_id: '来源 ID',
  media_source_id: '媒体来源 ID',
  preferred_source_id: '首选来源 ID',
  session_id: '会话 ID',
  mount_id: '挂载点 ID',
  library_id: '媒体库 ID',
  task_id: '任务 ID',
  reason: '原因',
  error: '错误详情',
  source_status: '来源状态',
  provider_type: '来源类型',
  file_path: '文件路径',
  redirect_url: '跳转地址',
  final_url: '最终地址',
  query: '查询参数',
  token_carrier: '令牌来源',
  token_hash_prefix: '令牌指纹',
  media_type: '媒体类型',
  title: '标题',
  container: '封装格式',
  range: 'Range 请求头',
  base_url: '基础地址',
  compat_stream_url: '兼容流地址',
  stream_url: '流地址',
  direct_url: '直连地址',
  external_direct_url: '外部直连地址',
  direct_play_candidate: '可直连播放',
  resolve_reason: '解析原因',
  cached_until: '缓存有效期',
  resolved_at: '解析时间',
  expires_at: '过期时间',
  duration_ticks: '时长',
  sources_count: '来源数量',
  user_agent_hash: '客户端指纹',
};

const PRIMARY_FIELD_ORDER = [
  'status',
  'elapsed_ms',
  'method',
  'path',
  'client',
  'ip',
  'request_id',
  'username',
  'display_name',
  'user_id',
  'item_id',
  'effective_item_id',
  'source_id',
  'media_source_id',
  'preferred_source_id',
  'source_status',
  'provider_type',
  'file_path',
  'reason',
  'error',
  'request_size',
  'content_type',
];

export interface RuntimeLogFieldView {
  key: string;
  label: string;
  value: string;
}

export interface RuntimeLogView {
  record: RuntimeLogRecord;
  headline: string;
  eventLabel: string;
  targetLabel: string;
  resultLabel: string;
  actorLabel: string;
  requestLabel: string;
  primaryFields: RuntimeLogFieldView[];
  extraFields: RuntimeLogFieldView[];
}

export function buildRuntimeLogView(record: RuntimeLogRecord): RuntimeLogView {
  const eventLabel = normalizeEventLabel(extractLeadingText(record.message) || record.message);
  const fieldMap = extractStructuredFields(record.rawLine);
  const requestId = record.requestId ?? fieldMap.get('request_id');
  const method = fieldMap.get('method');
  const path = fieldMap.get('path');
  const status = normalizeUnknown(fieldMap.get('status'));
  const elapsedMs = normalizeUnknown(fieldMap.get('elapsed_ms'));
  const client = normalizeUnknown(fieldMap.get('client'));
  const ipAddress = normalizeUnknown(fieldMap.get('ip'));
  const username = normalizeUnknown(fieldMap.get('username'));
  const displayName = normalizeUnknown(fieldMap.get('display_name'));
  const userId = normalizeUnknown(fieldMap.get('user_id'));

  if (requestId) {
    fieldMap.set('request_id', requestId);
  }

  const primaryFields = PRIMARY_FIELD_ORDER.flatMap((key) => {
    const value = normalizeUnknown(fieldMap.get(key));
    return value
      ? [
          {
            key,
            label: FIELD_LABELS[key] ?? key,
            value: formatFieldValue(key, value),
          },
        ]
      : [];
  });

  const extraFields = Array.from(fieldMap.entries())
    .filter(([key, value]) => !PRIMARY_FIELD_ORDER.includes(key) && normalizeUnknown(value))
    .map(([key, value]) => ({
      key,
      label: FIELD_LABELS[key] ?? prettifyKey(key),
      value: formatFieldValue(key, value),
    }));

  return {
    record,
    headline: buildHeadline(eventLabel, method, path),
    eventLabel,
    targetLabel: formatRuntimeTargetLabel(record.target),
    resultLabel: buildResultLabel(fieldMap, status, elapsedMs),
    actorLabel: buildActorLabel(client, ipAddress),
    requestLabel: buildRequestLabel(displayName, username, userId),
    primaryFields,
    extraFields,
  };
}

export function extractStructuredFields(rawLine: string) {
  const matches = Array.from(
    rawLine.matchAll(/(?:^|\s)([a-zA-Z_][a-zA-Z0-9_]*)=/g),
  );
  const fields = new Map<string, string>();

  matches.forEach((match, index) => {
    const key = match[1];
    const valueStart = (match.index ?? 0) + match[0].length;
    const valueEnd = index + 1 < matches.length ? matches[index + 1].index ?? rawLine.length : rawLine.length;
    const value = cleanupFieldValue(rawLine.slice(valueStart, valueEnd).trim());
    if (value) {
      fields.set(key, value);
    }
  });

  return fields;
}

function cleanupFieldValue(value: string) {
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

function extractLeadingText(message: string) {
  const match = message.match(/(?:^|\s)([a-zA-Z_][a-zA-Z0-9_]*)=/u);
  if (!match || match.index === undefined) {
    return message.trim();
  }
  return message.slice(0, match.index).trim();
}

function normalizeEventLabel(value: string) {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  if (!normalized) {
    return '日志事件';
  }

  const matched = EVENT_LABELS.find((entry) => entry.pattern.test(normalized));
  return matched?.label ?? normalized;
}

function buildHeadline(eventLabel: string, method?: string, path?: string) {
  if (method || path) {
    return [method?.toUpperCase(), path].filter(Boolean).join(' ') || eventLabel;
  }
  return eventLabel;
}

function buildResultLabel(fieldMap: Map<string, string>, status?: string, elapsedMs?: string) {
  const parts = [];
  if (status) {
    parts.push(formatFieldValue('status', status));
  } else {
    const sourceStatus = normalizeUnknown(fieldMap.get('source_status'));
    if (sourceStatus) {
      parts.push(formatFieldValue('source_status', sourceStatus));
    }
  }
  if (elapsedMs) {
    parts.push(`${elapsedMs} 毫秒`);
  }

  const error = normalizeUnknown(fieldMap.get('error'));
  if (parts.length === 0 && error) {
    return shortenValue(error, 36);
  }

  const reason = normalizeUnknown(fieldMap.get('reason'));
  if (parts.length === 0 && reason) {
    return formatFieldValue('reason', reason);
  }

  return parts.join(' · ') || '已记录';
}

function buildActorLabel(client?: string, ipAddress?: string) {
  const parts = [client, ipAddress].filter(Boolean);
  return parts.join(' · ') || '未记录';
}

function buildRequestLabel(displayName?: string, username?: string, userId?: string) {
  const parts = [displayName, username, userId].filter(Boolean);
  return parts.join(' · ') || '未记录';
}

export function formatRuntimeTargetLabel(target?: string) {
  if (!target) {
    return '运行日志';
  }

  const matched = TARGET_LABELS.find((entry) => entry.pattern.test(target));
  if (matched) {
    return matched.label;
  }

  return target
    .split('::')
    .filter(Boolean)
    .slice(-2)
    .join(' / ');
}

function formatFieldValue(key: string, value: string) {
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

function normalizeUnknown(value?: string) {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  if (normalized === '' || normalized === 'unknown' || normalized === 'None') {
    return undefined;
  }
  return normalized;
}

function prettifyKey(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.toUpperCase())
    .join(' ');
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

function formatCommonValue(value: string) {
  if (/^(true|false)$/iu.test(value)) {
    return formatBoolean(value);
  }
  return value;
}

function formatByteCount(value: string) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return value;
  }
  return `${numericValue} 字节`;
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

function formatHttpStatus(value: string) {
  const code = Number.parseInt(value, 10);
  if (!Number.isFinite(code)) {
    return value;
  }

  const label = HTTP_STATUS_LABELS[code];
  return label ? `${code} ${label}` : `${code}`;
}

function shortenValue(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

const HTTP_STATUS_LABELS: Record<number, string> = {
  200: '成功',
  201: '已创建',
  202: '已接收',
  204: '无返回内容',
  206: '部分内容',
  301: '永久跳转',
  302: '临时跳转',
  304: '未修改',
  400: '请求错误',
  401: '未授权',
  403: '禁止访问',
  404: '未找到',
  409: '冲突',
  410: '已删除',
  412: '前置条件失败',
  416: '范围无效',
  422: '请求无法处理',
  429: '请求过多',
  500: '服务内部错误',
  502: '网关错误',
  503: '服务不可用',
  504: '网关超时',
};

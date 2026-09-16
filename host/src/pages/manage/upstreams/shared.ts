/** 上游源管理页共享常量与表单工具（V1F-02-A + S2/S3/S4b）。 */

import type {
  UpstreamSourceRecord,
  UpstreamSourceWriteInput,
} from '@fmby/v2-shared/contracts/manage/upstreams';

export const SOURCE_TYPE_OPTIONS = [
  { value: 'Emby', label: 'Emby' },
  { value: 'AppleCms', label: 'Apple CMS' },
  { value: 'WebDav', label: 'WebDAV' },
];

export const AUTH_METHOD_OPTIONS = [
  { value: 'None', label: '无认证' },
  { value: 'UsernamePassword', label: '用户名密码' },
  { value: 'ApiKey', label: 'API Key' },
];

export const STATUS_LABELS: Record<string, string> = {
  healthy: '健康',
  unhealthy: '异常',
  disabled: '已停用',
  unknown: '未知',
};

/** 映射动作（预览项 action / 覆盖 action 均用此枚举口径）。 */
export const MAPPING_ACTION_LABELS: Record<string, string> = {
  bind_existing: '绑定已有库',
  create_library: '新建库',
  skip: '跳过',
  conflict: '冲突',
};

export const LIBRARY_TYPE_OPTIONS = [
  { value: 'Movie', label: 'Movie（电影）' },
  { value: 'Series', label: 'Series（剧集）' },
  { value: 'Mixed', label: 'Mixed（混合）' },
];

export interface SourceFormState {
  name: string;
  sourceType: string;
  baseUrl: string;
  authMethod: string;
  username: string;
  password: string;
  apiKey: string;
  userAgent: string;
  referer: string;
  enabled: boolean;
}

export function createInitialFormState(): SourceFormState {
  return {
    name: '',
    sourceType: 'Emby',
    baseUrl: '',
    authMethod: 'UsernamePassword',
    username: '',
    password: '',
    apiKey: '',
    userAgent: '',
    referer: '',
    enabled: true,
  };
}

export function buildFormStateFromRecord(record: UpstreamSourceRecord): SourceFormState {
  return {
    name: record.name,
    sourceType: record.sourceType,
    baseUrl: record.baseUrl,
    authMethod: record.authMethod,
    username: record.username ?? '',
    password: '',
    apiKey: '',
    userAgent: record.userAgent ?? '',
    referer: record.referer ?? '',
    enabled: record.status !== 'disabled',
  };
}

export function toWriteInput(s: SourceFormState, isEdit: boolean): UpstreamSourceWriteInput {
  return {
    name: s.name.trim(),
    sourceType: s.sourceType,
    baseUrl: s.baseUrl.trim(),
    authMethod: s.authMethod,
    username: s.username.trim() || undefined,
    password: s.password || undefined,
    apiKey: s.apiKey || undefined,
    userAgent: s.userAgent.trim() || undefined,
    referer: s.referer.trim() || undefined,
    retainSecret: isEdit && !s.password && !s.apiKey,
    enabled: s.enabled,
  };
}

export function formatEpochMs(epochMs: number | null): string {
  if (epochMs == null || !Number.isFinite(epochMs) || epochMs <= 0) {
    return '—';
  }
  return new Date(epochMs).toLocaleString('zh-CN', { hour12: false });
}

/** 逗号分隔文本 → 去空数组（关键词/ID 列表输入）。 */
export function parseListInput(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

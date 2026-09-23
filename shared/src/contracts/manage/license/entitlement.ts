/**
 * 权益条目元数据与取值辅助（照 V1 `contracts/manage/license-entitlement.ts` 逐项对齐）。
 *
 * entitlement key 形如 `feature.storage.pan115.provider` / `limit.users.max` /
 * `policy.lease.ttl_secs`；本模块提供：
 * - 分类（feature / limit / policy / other）；
 * - 可读标签 + 说明（服务端只回 key，文案在客户端元数据表）；
 * - limit 类的用量读取（key → 当前值）与用量标签；
 * - 原始值归一化与类型判定（bool / integer / string / unknown）。
 */

import type {
  LicenseEntitlementCategory,
  LicenseEntitlementValueType,
  LicenseUsageRecord,
} from './types';

export interface LicenseEntitlementMeta {
  label: string;
  description?: string;
}

const LICENSE_ENTITLEMENT_META: Record<string, LicenseEntitlementMeta> = {
  'feature.compat.emby': {
    label: 'Emby/Jellyfin 兼容层',
    description: '控制第三方兼容 API 和 websocket 入口。',
  },
  'feature.pan115.provider': {
    label: '115 普通网盘',
    description: '控制 115 普通挂载、扫码凭据、索引、扫描和播放链路。',
  },
  'feature.storage.pan115.provider': {
    label: '115 普通网盘',
    description: '控制 115 普通挂载、扫码凭据、索引、扫描和播放链路。',
  },
  'feature.pan115.share': {
    label: '115 分享挂载',
    description: '控制 115 分享挂载、分享下载凭据、扫描和播放链路。',
  },
  'feature.storage.pan115.share': {
    label: '115 分享挂载',
    description: '控制 115 分享挂载、分享下载凭据、扫描和播放链路。',
  },
  'feature.pan115.imghost': {
    label: '115 图床治理',
    description: '控制图床凭据、镜像 worker 和刮削资产注入。',
  },
  'feature.storage.pan115.imghost': {
    label: '115 图床治理',
    description: '控制图床凭据、镜像 worker 和刮削资产注入。',
  },
  'feature.storage.microsoft.provider': {
    label: 'Microsoft 数据源',
    description: '控制 Microsoft / 世纪互联挂载与播放链路。',
  },
  'feature.storage.microsoft.account_pool': {
    label: 'Microsoft 账号池',
    description: '控制账号池导入、轮换和健康治理。',
  },
  'feature.storage.alist.provider': {
    label: 'AList 数据源',
    description: '控制 AList 挂载、目录浏览、扫描和播放。',
  },
  'feature.storage.openlist.provider': {
    label: 'OpenList 数据源',
    description: '控制 OpenList 挂载、目录浏览、扫描和播放。',
  },
  'feature.upstream.emby': {
    label: 'Emby 上游网关',
    description: '控制 Emby 上游创建、探活、同步和 bridge 投影。',
  },
  'feature.upstream.apple_cms': {
    label: 'AppleCMS 上游网关',
    description: '控制分类发现、绑定、同步和 bridge 投影。',
  },
  'feature.open_api': {
    label: '第三方开放 API',
    description: '控制 /api/open/v1 与开发者 Token。',
  },
  'feature.metadata.advanced_scrape': {
    label: '高级命名刮削治理',
    description: '控制批量刮削修复、高级重放和治理入口。',
  },
  'feature.probe.remote': {
    label: '远端技术探测',
    description: '控制远端 probe worker 与手动探测入口。',
  },
  'limit.activation_instances.max': {
    label: '激活实例上限',
    description: '服务端执行，当前客户端只展示。',
  },
  'limit.users.max': { label: '用户上限' },
  'limit.admins.max': { label: '管理员上限' },
  'limit.libraries.max': { label: '媒体库上限' },
  'limit.storage_mounts.max': { label: '媒体来源上限' },
  'limit.storage_mounts.pan115.max': { label: '115 普通挂载上限' },
  'limit.storage_mounts.pan115_share.max': { label: '115 分享挂载上限' },
  'limit.storage_mounts.microsoft.max': { label: 'Microsoft 挂载上限' },
  'limit.microsoft_accounts.max': { label: 'Microsoft 账号上限' },
  'limit.upstream_sources.max': { label: '上游源上限' },
  'limit.upstream_sources.emby.max': { label: 'Emby 上游源上限' },
  'limit.upstream_sources.apple_cms.max': { label: 'AppleCMS 上游源上限' },
  'limit.concurrent_streams.max': { label: '全局并发播放上限' },
  'limit.open_api_tokens.max': { label: '开发者 API Token 上限' },
  'policy.lease.ttl_secs': {
    label: 'Lease 有效期建议',
    description: '服务端签发策略；客户端不据此延长授权。',
  },
  'policy.lease.grace_ttl_secs': {
    label: '宽限期长度建议',
    description: '服务端签发策略；最终以 grace_expires_at 为准。',
  },
  'policy.heartbeat.interval_secs': {
    label: '推荐心跳间隔',
    description: '客户端续租调度建议。',
  },
};

const LIMIT_USAGE_LABELS: Record<string, string> = {
  'limit.users.max': '当前用户',
  'limit.admins.max': '当前管理员',
  'limit.libraries.max': '当前媒体库',
  'limit.storage_mounts.max': '当前媒体来源',
  'limit.storage_mounts.pan115.max': '当前 115 普通挂载',
  'limit.storage_mounts.pan115_share.max': '当前 115 分享挂载',
  'limit.storage_mounts.microsoft.max': '当前 Microsoft 挂载',
  'limit.microsoft_accounts.max': '当前 Microsoft 账号',
  'limit.upstream_sources.max': '当前上游源',
  'limit.upstream_sources.emby.max': '当前 Emby 上游源',
  'limit.upstream_sources.apple_cms.max': '当前 AppleCMS 上游源',
  'limit.concurrent_streams.max': '当前活跃播放',
  'limit.open_api_tokens.max': '当前开发者 Token',
};

const LIMIT_USAGE_READERS: Record<string, (usage: LicenseUsageRecord) => number> = {
  'limit.users.max': (u) => u.userCount,
  'limit.admins.max': (u) => u.adminCount,
  'limit.libraries.max': (u) => u.libraryCount,
  'limit.storage_mounts.max': (u) => u.storageMountCount,
  'limit.storage_mounts.pan115.max': (u) => u.pan115MountCount,
  'limit.storage_mounts.pan115_share.max': (u) => u.pan115ShareMountCount,
  'limit.storage_mounts.microsoft.max': (u) => u.microsoftMountCount,
  'limit.microsoft_accounts.max': (u) => u.microsoftAccountCount,
  'limit.upstream_sources.max': (u) => u.upstreamSourceCount,
  'limit.upstream_sources.emby.max': (u) => u.upstreamEmbyCount,
  'limit.upstream_sources.apple_cms.max': (u) => u.upstreamAppleCmsCount,
  'limit.concurrent_streams.max': (u) => u.activePlaybackSessionCount,
  'limit.open_api_tokens.max': (u) => u.openApiTokenCount,
};

export function getLicenseEntitlementCategory(key: string): LicenseEntitlementCategory {
  if (key.startsWith('feature.')) return 'feature';
  if (key.startsWith('limit.')) return 'limit';
  if (key.startsWith('policy.')) return 'policy';
  return 'other';
}

export function getLicenseEntitlementMeta(key: string): LicenseEntitlementMeta | undefined {
  return LICENSE_ENTITLEMENT_META[key];
}

export function getLicenseLimitUsageLabel(key: string): string | undefined {
  return LIMIT_USAGE_LABELS[key];
}

export function readLicenseLimitUsage(
  key: string,
  usage: LicenseUsageRecord,
): number | undefined {
  return LIMIT_USAGE_READERS[key]?.(usage);
}

/** 归一化：{ value } 或 { bool/integer/string } 包装还原为原始标量。 */
export function normalizeLicenseEntitlementValue(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if ('value' in record) return record.value;
  for (const key of ['bool', 'Bool', 'integer', 'Integer', 'string', 'String']) {
    if (key in record) return record[key];
  }
  return value;
}

export function getLicenseEntitlementValueType(value: unknown): LicenseEntitlementValueType {
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number' && Number.isInteger(value)) return 'integer';
  if (typeof value === 'string') return 'string';
  return 'unknown';
}

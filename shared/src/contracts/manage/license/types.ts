/**
 * license 管理面契约类型（P6-02-C：前端契约先冻结，D 卡按此实现后端）。
 *
 * 后端端点（fmby-v2-http，serde snake_case → raw DTO 由 ./api.ts 映射）：
 * - GET  /api/manage/license/status
 * - POST /api/manage/license/device-flow          发起设备流授权
 * - POST /api/manage/license/device-flow/poll     轮询设备流授权结果
 * - POST /api/manage/license/activation-token     用一次性激活凭据换取授权租约
 * - POST /api/manage/license/heartbeat            手动续租/心跳
 *
 * 时间字段统一为 epoch 毫秒（number | null），对齐 v2 后端 serde 时间戳表达；
 * 该选择在 handoff 契约冻结清单中与 v1 ISO 字符串字段逐项对照登记。
 */

/** 授权运行态六态徽标（授权状态卡主状态）。 */
export type LicenseRuntimeState =
  | 'unactivated'
  | 'pending'
  | 'active'
  | 'grace'
  | 'expired'
  | 'invalid';

/** 授权 realtime 链路状态（可空）。 */
export type LicenseRealtimeStatus =
  | 'disabled'
  | 'idle'
  | 'ready'
  | 'connected'
  | 'error'
  | 'blocked';

/** 设备流轮询结果。 */
export type LicensePollStatus =
  | 'pending'
  | 'authorized'
  | 'expired'
  | 'denied';

/** 设备流授权入口（start 返回值，status.deviceFlow 透出）。 */
export interface LicenseDeviceFlowRecord {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  /** 完整授权链接（含用户码）；可能为 null，回退用 verificationUri。 */
  verificationUriComplete: string | null;
  /** 过期时间（epoch ms）。 */
  expiresAt: number | null;
  /** 建议轮询间隔（秒）。 */
  pollIntervalSecs: number | null;
}

/** 权益条目（status.entitlements 数组元素）。 */
export interface LicenseEntitlementRecord {
  /** entitlement key，如 `feature.storage.pan115.provider`。 */
  key: string;
  /** 后端/本地元数据给出的可读标签；无则回退为 key。 */
  label: string;
  description: string | null;
  /** feature / limit / policy / other 四类。 */
  category: LicenseEntitlementCategory;
  /** 归一化后的原始值（bool/integer/string/其它）。 */
  value: unknown;
  valueType: LicenseEntitlementValueType;
  boolValue: boolean | null;
  integerValue: number | null;
  stringValue: string | null;
  displayValue: string;
  /** 以下四字段仅 limit 类存在（映射器填充）。 */
  limitValue: number | null;
  usageValue: number | null;
  /** 用量标签（如「当前用户」）；照 V1 `getLicenseLimitUsageLabel`。 */
  usageLabel: string | null;
  unlimited: boolean;
  exhausted: boolean;
}

export type LicenseEntitlementCategory = 'feature' | 'limit' | 'policy' | 'other';

export type LicenseEntitlementValueType = 'bool' | 'integer' | 'string' | 'unknown';

/** 用量指标（status.usage，占用额度类极限的当前值）。 */
export interface LicenseUsageRecord {
  userCount: number;
  adminCount: number;
  libraryCount: number;
  storageMountCount: number;
  pan115MountCount: number;
  pan115ShareMountCount: number;
  microsoftMountCount: number;
  microsoftAccountCount: number;
  upstreamSourceCount: number;
  upstreamEmbyCount: number;
  upstreamAppleCmsCount: number;
  activePlaybackSessionCount: number;
  openApiTokenCount: number;
}

/** 套餐摘要（status.summary）。 */
export interface LicenseSummaryRecord {
  plan: LicensePlanSummaryRecord;
  userLimit: LicenseUserLimitRecord;
  enabledFeatures: string[];
  capabilityGroups: LicenseCapabilityGroupRecord[];
  visibility: LicenseVisibilityRecord;
}

export interface LicensePlanSummaryRecord {
  code: string;
  label: string;
  tier: string;
  isTrial: boolean;
  source: string;
}

export interface LicenseUserLimitRecord {
  limit: number | null;
  unlimited: boolean;
  current: number;
  exceeded: boolean;
}

export interface LicenseCapabilityGroupRecord {
  key: string;
  label: string;
  items: LicenseCapabilityRecord[];
}

export interface LicenseCapabilityRecord {
  key: string;
  label: string;
  enabled: boolean;
  freeBaseline: boolean;
  minimumPlan: string | null;
}

export interface LicenseVisibilityRecord {
  pan115Provider: boolean;
  pan115Share: boolean;
  pan115Imghost: boolean;
  microsoftProvider: boolean;
  microsoftAccountPool: boolean;
  upstreamEmby: boolean;
  upstreamAppleCms: boolean;
  registrationCodes: boolean;
  registrationWindow: boolean;
  userExpiration: boolean;
  identityTelegram: boolean;
  identityGoogle: boolean;
  posterImghost: boolean;
  internalImghost: boolean;
}

/** 授权状态主 DTO（GET /status 与各写操作响应内的 status 载体）。 */
export interface LicenseStatusRecord {
  runtimeState: LicenseRuntimeState;
  businessAccessAllowed: boolean;
  serverBaseUrl: string;
  realtimeEnabled: boolean;
  realtimeStatus: LicenseRealtimeStatus | null;
  protocolVersion: number;
  instanceId: string | null;
  instancePublicKey: string | null;
  activationId: string | null;
  licenseId: string | null;
  leaseId: string | null;
  productCode: string | null;
  issuedAt: number | null;
  notBefore: number | null;
  expiresAt: number | null;
  graceExpiresAt: number | null;
  nextHeartbeatAt: number | null;
  lastHeartbeatAt: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastErrorAt: number | null;
  lastRealtimeConnectedAt: number | null;
  lastRealtimeEventId: string | null;
  lastRealtimeEventKind: string | null;
  lastRealtimeEventAt: number | null;
  lastRealtimeError: string | null;
  lastRealtimeErrorAt: number | null;
  realtimeBlockedReason: string | null;
  realtimeBlockedAt: number | null;
  deviceFlow: LicenseDeviceFlowRecord | null;
  summary: LicenseSummaryRecord;
  entitlements: LicenseEntitlementRecord[];
  usage: LicenseUsageRecord;
}

/** 写操作（device-flow / activation-token / heartbeat）响应载体。 */
export interface LicenseActionResponseRecord {
  status: LicenseStatusRecord;
}

/** 设备流轮询响应载体。 */
export interface LicensePollResponseRecord {
  status: LicenseStatusRecord;
  pollStatus: LicensePollStatus;
}

/** activation-token 输入。 */
export interface LicenseActivationTokenInput {
  activationToken: string;
}

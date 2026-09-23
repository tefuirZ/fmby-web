import { httpClient } from "@fmby/v2-shared/api/client";
import {
  getLicenseEntitlementCategory,
  getLicenseEntitlementMeta,
  getLicenseEntitlementValueType,
  getLicenseLimitUsageLabel,
  normalizeLicenseEntitlementValue,
  readLicenseLimitUsage,
} from "./entitlement";
import { parseLicensePollStatus, parseLicenseRealtimeStatus, parseLicenseRuntimeState } from "./status";
import type {
  LicenseActionResponseRecord,
  LicenseActivationTokenInput,
  LicenseCapabilityRecord,
  LicenseCapabilityGroupRecord,
  LicenseDeviceFlowRecord,
  LicenseEntitlementRecord,
  LicensePlanSummaryRecord,
  LicensePollResponseRecord,
  LicenseStatusRecord,
  LicenseSummaryRecord,
  LicenseUsageRecord,
  LicenseUserLimitRecord,
  LicenseVisibilityRecord,
} from "./types";

// ─── Raw DTO（后端 serde snake_case，本模块私有不外泄） ─────────────────────────

type RawEpoch = number | string | null;

interface RawLicenseDeviceFlow {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string | null;
  expires_at: RawEpoch;
  poll_interval_secs: number | null;
}

interface RawLicenseEntitlement {
  key: string;
  value: unknown;
}

interface RawLicenseUsage {
  user_count: number;
  admin_count: number;
  library_count: number;
  storage_mount_count: number;
  pan115_mount_count: number;
  pan115_share_mount_count: number;
  microsoft_mount_count: number;
  microsoft_account_count: number;
  upstream_source_count: number;
  upstream_emby_count: number;
  upstream_apple_cms_count: number;
  active_playback_session_count: number;
  open_api_token_count: number;
}

interface RawLicenseCapability {
  key?: string;
  label?: string;
  enabled?: boolean;
  free_baseline?: boolean;
  minimum_plan?: string | null;
}

interface RawLicenseCapabilityGroup {
  key?: string;
  label?: string;
  items?: RawLicenseCapability[];
}

interface RawLicensePlan {
  code?: string;
  label?: string;
  tier?: string;
  is_trial?: boolean;
  source?: string;
}

interface RawLicenseUserLimit {
  limit?: number | null;
  unlimited?: boolean;
  current?: number;
  exceeded?: boolean;
}

interface RawLicenseSummary {
  plan?: RawLicensePlan;
  user_limit?: RawLicenseUserLimit;
  enabled_features?: string[];
  capability_groups?: RawLicenseCapabilityGroup[];
  visibility?: Record<string, unknown>;
}

interface RawLicenseStatusResponse {
  runtime_state: string;
  business_access_allowed: boolean;
  server_base_url: string;
  realtime_enabled: boolean;
  realtime_status: string | null;
  protocol_version: number;
  instance_id: string | null;
  instance_public_key: string | null;
  activation_id: string | null;
  license_id: string | null;
  lease_id: string | null;
  product_code: string | null;
  issued_at: RawEpoch;
  not_before: RawEpoch;
  expires_at: RawEpoch;
  grace_expires_at: RawEpoch;
  next_heartbeat_at: RawEpoch;
  last_heartbeat_at: RawEpoch;
  last_error_code: string | null;
  last_error_message: string | null;
  last_error_at: RawEpoch;
  last_realtime_connected_at: RawEpoch;
  last_realtime_event_id: string | null;
  last_realtime_event_kind: string | null;
  last_realtime_event_at: RawEpoch;
  last_realtime_error: string | null;
  last_realtime_error_at: RawEpoch;
  realtime_blocked_reason: string | null;
  realtime_blocked_at: RawEpoch;
  device_flow: RawLicenseDeviceFlow | null;
  summary?: RawLicenseSummary | null;
  entitlements: RawLicenseEntitlement[];
  usage: RawLicenseUsage;
}

interface RawLicenseActionResponse {
  status: RawLicenseStatusResponse;
}

interface RawLicensePollResponse {
  status: RawLicenseStatusResponse;
  poll_status: string;
}

// ─── 状态枚举解析器：见 ./status.ts（照 V1 逐项对齐，此处不再重复定义） ─────────────

// ─── 字段读取辅助（对外部可能缺省的原始字段 fail-closed） ────────────────────────

function readString(value: unknown, fallback: string | null = null): string | null {
  if (typeof value !== 'string') return fallback;
  return value;
}

function readBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

/** 统一把后端表达（ISO 字符串或 epoch ms）归一为 epoch ms；空/非法返回 null。 */
function readEpochMs(value: RawEpoch): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function pickFirst(...values: Array<unknown>): Record<string, unknown> {
  for (const value of values) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return {};
}

// ─── 映射器 ────────────────────────────────────────────────────────────────────

function mapDeviceFlow(raw: RawLicenseDeviceFlow): LicenseDeviceFlowRecord {
  return {
    deviceCode: raw.device_code,
    userCode: raw.user_code,
    verificationUri: raw.verification_uri,
    verificationUriComplete: raw.verification_uri_complete,
    expiresAt: readEpochMs(raw.expires_at),
    pollIntervalSecs: raw.poll_interval_secs,
  };
}

function mapUsage(raw: RawLicenseUsage): LicenseUsageRecord {
  return {
    userCount: raw.user_count,
    adminCount: raw.admin_count,
    libraryCount: raw.library_count,
    storageMountCount: raw.storage_mount_count,
    pan115MountCount: raw.pan115_mount_count,
    pan115ShareMountCount: raw.pan115_share_mount_count,
    microsoftMountCount: raw.microsoft_mount_count,
    microsoftAccountCount: raw.microsoft_account_count,
    upstreamSourceCount: raw.upstream_source_count,
    upstreamEmbyCount: raw.upstream_emby_count,
    upstreamAppleCmsCount: raw.upstream_apple_cms_count,
    activePlaybackSessionCount: raw.active_playback_session_count,
    openApiTokenCount: raw.open_api_token_count,
  };
}

function mapCapability(raw: RawLicenseCapability): LicenseCapabilityRecord | null {
  const key = readString(raw.key);
  if (!key) return null;
  return {
    key,
    label: readString(raw.label) ?? key,
    enabled: readBool(raw.enabled),
    freeBaseline: readBool(raw.free_baseline),
    minimumPlan: readString(raw.minimum_plan),
  };
}

function mapCapabilityGroups(raw: RawLicenseCapabilityGroup[] | undefined): LicenseCapabilityGroupRecord[] {
  const groups: LicenseCapabilityGroupRecord[] = [];
  for (const group of raw ?? []) {
    const key = readString(group.key);
    if (!key) continue;
    const items = (group.items ?? [])
      .map(mapCapability)
      .filter((item): item is LicenseCapabilityRecord => item !== null);
    if (items.length === 0) continue;
    groups.push({ key, label: readString(group.label) ?? key, items });
  }
  return groups;
}

function mapVisibility(raw: unknown): LicenseVisibilityRecord {
  const record = pickFirst(raw);
  const read = (camel: string, snake: string): boolean => {
    const v = record[camel] ?? record[snake];
    return typeof v === 'boolean' ? v : false;
  };
  return {
    pan115Provider: read('pan115Provider', 'pan115_provider'),
    pan115Share: read('pan115Share', 'pan115_share'),
    pan115Imghost: read('pan115Imghost', 'pan115_imghost'),
    microsoftProvider: read('microsoftProvider', 'microsoft_provider'),
    microsoftAccountPool: read('microsoftAccountPool', 'microsoft_account_pool'),
    upstreamEmby: read('upstreamEmby', 'upstream_emby'),
    upstreamAppleCms: read('upstreamAppleCms', 'upstream_apple_cms'),
    registrationCodes: read('registrationCodes', 'registration_codes'),
    registrationWindow: read('registrationWindow', 'registration_window'),
    userExpiration: read('userExpiration', 'user_expiration'),
    identityTelegram: read('identityTelegram', 'identity_telegram'),
    identityGoogle: read('identityGoogle', 'identity_google'),
    posterImghost: read('posterImghost', 'poster_imghost'),
    internalImghost: read('internalImghost', 'internal_imghost'),
  };
}

function mapSummary(
  raw: Pick<RawLicenseSummary, 'plan' | 'user_limit' | 'enabled_features' | 'capability_groups' | 'visibility'> | null | undefined,
  currentUserCount: number,
): LicenseSummaryRecord {
  const planRec = raw?.plan ?? {};
  const plan: LicensePlanSummaryRecord = {
    code: readString(planRec.code) ?? 'free',
    label: readString(planRec.label) ?? '免费版',
    tier: readString(planRec.tier) ?? 'free',
    isTrial: readBool(planRec.is_trial),
    source: readString(planRec.source) ?? 'free_baseline',
  };
  const limitRec = raw?.user_limit ?? {};
  const userLimit: LicenseUserLimitRecord = {
    limit: readNumber(limitRec.limit),
    unlimited: readBool(limitRec.unlimited),
    current: readNumber(limitRec.current) ?? currentUserCount,
    exceeded: readBool(limitRec.exceeded),
  };
  return {
    plan,
    userLimit,
    enabledFeatures: raw?.enabled_features ?? [],
    capabilityGroups: mapCapabilityGroups(raw?.capability_groups),
    visibility: mapVisibility(raw?.visibility),
  };
}

/** 展示值（照 V1 `formatEntitlementValue`）。 */
function displayValue(
  value: unknown,
  valueType: ReturnType<typeof getLicenseEntitlementValueType>,
): string {
  switch (valueType) {
    case 'bool':
      return value ? '已启用' : '未启用';
    case 'integer':
      return value === -1 ? '无限制' : String(value);
    case 'string':
      return value ? String(value) : '空字符串';
    default:
      try {
        return JSON.stringify(value) ?? '';
      } catch {
        return String(value);
      }
  }
}

function mapEntitlement(raw: RawLicenseEntitlement, usage: LicenseUsageRecord): LicenseEntitlementRecord {
  const normalized = normalizeLicenseEntitlementValue(raw.value);
  const valueType = getLicenseEntitlementValueType(normalized);
  const category = getLicenseEntitlementCategory(raw.key);
  const meta = getLicenseEntitlementMeta(raw.key);
  const base: LicenseEntitlementRecord = {
    key: raw.key,
    label: meta?.label ?? raw.key,
    description: meta?.description ?? null,
    category,
    value: normalized,
    valueType,
    boolValue: valueType === 'bool' ? (normalized as boolean) : null,
    integerValue: valueType === 'integer' ? (normalized as number) : null,
    stringValue: valueType === 'string' ? (normalized as string) : null,
    displayValue: displayValue(normalized, valueType),
    limitValue: null,
    usageValue: null,
    usageLabel: null,
    unlimited: false,
    exhausted: false,
  };
  if (category !== 'limit') return base;
  const limitValue = base.integerValue;
  const usageValue = readLicenseLimitUsage(raw.key, usage) ?? null;
  return {
    ...base,
    limitValue,
    usageValue,
    usageLabel: getLicenseLimitUsageLabel(raw.key) ?? null,
    unlimited: limitValue === -1,
    exhausted: limitValue != null && limitValue >= 0 && usageValue != null && usageValue >= limitValue,
  };
}

function mapStatus(raw: RawLicenseStatusResponse): LicenseStatusRecord {
  const usage = mapUsage(raw.usage);
  const runtimeState = parseLicenseRuntimeState(raw.runtime_state);
  const realtimeStatus = raw.realtime_status ? parseLicenseRealtimeStatus(raw.realtime_status) : null;
  return {
    runtimeState,
    businessAccessAllowed: raw.business_access_allowed,
    serverBaseUrl: raw.server_base_url,
    realtimeEnabled: raw.realtime_enabled,
    realtimeStatus,
    protocolVersion: raw.protocol_version,
    instanceId: raw.instance_id,
    instancePublicKey: raw.instance_public_key,
    activationId: raw.activation_id,
    licenseId: raw.license_id,
    leaseId: raw.lease_id,
    productCode: raw.product_code,
    issuedAt: readEpochMs(raw.issued_at),
    notBefore: readEpochMs(raw.not_before),
    expiresAt: readEpochMs(raw.expires_at),
    graceExpiresAt: readEpochMs(raw.grace_expires_at),
    nextHeartbeatAt: readEpochMs(raw.next_heartbeat_at),
    lastHeartbeatAt: readEpochMs(raw.last_heartbeat_at),
    lastErrorCode: raw.last_error_code,
    lastErrorMessage: raw.last_error_message,
    lastErrorAt: readEpochMs(raw.last_error_at),
    lastRealtimeConnectedAt: readEpochMs(raw.last_realtime_connected_at),
    lastRealtimeEventId: raw.last_realtime_event_id,
    lastRealtimeEventKind: raw.last_realtime_event_kind,
    lastRealtimeEventAt: readEpochMs(raw.last_realtime_event_at),
    lastRealtimeError: raw.last_realtime_error,
    lastRealtimeErrorAt: readEpochMs(raw.last_realtime_error_at),
    realtimeBlockedReason: raw.realtime_blocked_reason,
    realtimeBlockedAt: readEpochMs(raw.realtime_blocked_at),
    deviceFlow: raw.device_flow ? mapDeviceFlow(raw.device_flow) : null,
    summary: mapSummary(raw.summary, usage.userCount),
    entitlements: raw.entitlements.map((item) => mapEntitlement(item, usage)),
    usage,
  };
}

// ─── API（五核心端点，fail-closed：后端 400/404/500 由 httpClient 统一抛错，前端不吞） ──

const BASE = '/api/manage/license';
const LICENSE_ACTION_TIMEOUT_MS = 60_000;

export const licenseApi = {
  async getStatus(): Promise<LicenseStatusRecord> {
    const raw = await httpClient.get<RawLicenseStatusResponse>(`${BASE}/status`);
    return mapStatus(raw);
  },

  async startDeviceFlow(): Promise<LicenseActionResponseRecord> {
    const raw = await httpClient.post<RawLicenseActionResponse>(`${BASE}/device-flow`, {
      timeout: LICENSE_ACTION_TIMEOUT_MS,
    });
    return { status: mapStatus(raw.status) };
  },

  async pollDeviceFlow(): Promise<LicensePollResponseRecord> {
    const raw = await httpClient.post<RawLicensePollResponse>(`${BASE}/device-flow/poll`, {
      timeout: LICENSE_ACTION_TIMEOUT_MS,
    });
    return { status: mapStatus(raw.status), pollStatus: parseLicensePollStatus(raw.poll_status) };
  },

  async activateWithToken(input: LicenseActivationTokenInput): Promise<LicenseActionResponseRecord> {
    const raw = await httpClient.post<RawLicenseActionResponse>(`${BASE}/activation-token`, {
      body: { activation_token: input.activationToken },
      timeout: LICENSE_ACTION_TIMEOUT_MS,
    });
    return { status: mapStatus(raw.status) };
  },

  async heartbeat(): Promise<LicenseActionResponseRecord> {
    const raw = await httpClient.post<RawLicenseActionResponse>(`${BASE}/heartbeat`, {
      timeout: LICENSE_ACTION_TIMEOUT_MS,
    });
    return { status: mapStatus(raw.status) };
  },
};

/** 供 UI 直接消费的状态表（照 V1 对齐；实现在 ./status.ts）。 */
export {
  licenseRuntimeStateLabels as licenseRuntimeStates,
  licenseRuntimeStateTones as licenseRuntimeTones,
  licensePollStatusLabels as licensePollStatuses,
} from "./status";

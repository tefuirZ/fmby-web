import type {
  ManageActionResult,
  ManageAdvancedResponse,
  ManageUserAccountKind,
  UpdateRegistrationCodeStatusRequest,
  UpdateUserStatusRequest,
} from "../types";
import type {
  RawAuditLogRecord,
  RawManageActionResult,
  RawManageAdvancedResponse,
  RawManagedSessionRecord,
  RawManagedSourcePathGrantRecord,
  RawManagedUserRecord,
  RawRegistrationCodeBatchRecord,
  RawRegistrationCodeRecord,
  RawRoleTemplateRecord,
  RawRuntimeLogRecord,
} from "../raw-types";
import { mapRoleToLabel } from "../labels";
import {
  buildSessionClientFallback,
  buildSessionDeviceFallback,
  parseClientInfo,
} from "../ua-parser";
import {
  buildAuditSummary,
  buildTargetLabel,
  extractTraceId,
  inferAuditResult,
  mapRegistrationCodeStatus,
  mapRoleTemplateStatus,
  mapRole,
  mapSessionStatus,
  mapRuntimeLogLevel,
  mapUserStatus,
} from "./shared";

export function mapUserRecord(raw: RawManagedUserRecord) {
  return {
    id: raw.id,
    username: raw.username,
    displayName: raw.display_name ?? undefined,
    email: raw.email ?? undefined,
    accountKind: mapUserAccountKind(raw.account_kind),
    roles: (raw.roles ?? []).map(mapRole),
    roleLabel:
      raw.roles.length > 0
        ? raw.roles.map(mapRoleToLabel).join("、")
        : "普通用户",
    status: mapUserStatus(raw.status),
    libraryScopes: [],
    sourceGrants: (raw.source_grants ?? []).map(mapSourcePathGrantRecord),
    maxSessions: raw.max_sessions ?? undefined,
    maxConcurrentPlaybacks:
      raw.max_concurrent_playbacks ?? undefined,
    validUntil: raw.valid_until ?? undefined,
    mustChangePassword: raw.must_change_password ?? false,
    lastLoginAt: raw.last_activity_at ?? undefined,
    lastDevice: raw.recent_client_info ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    recentClientInfo: raw.recent_client_info ?? undefined,
  };
}

function mapUserAccountKind(raw?: string | null): ManageUserAccountKind {
  return raw?.trim().toLowerCase() === "service" ? "service" : "human";
}

export function mapRegistrationCode(raw: RawRegistrationCodeRecord) {
  const exhausted =
    raw.max_uses !== null &&
    raw.max_uses !== undefined &&
    raw.used_count >= raw.max_uses;

  return {
    id: raw.id,
    batchId: raw.batch_id,
    code: raw.code,
    roleTemplate: mapRole(raw.role_template),
    roleTemplateLabel: mapRoleToLabel(raw.role_template),
    status: exhausted ? "used-up" : mapRegistrationCodeStatus(raw.status),
    usageCount: raw.used_count,
    usageLimit: raw.max_uses ?? 0,
    maxSessions: raw.max_sessions ?? undefined,
    validDays: raw.valid_days ?? undefined,
    expiresAt: raw.expires_at ?? undefined,
    defaultLibraries: raw.default_library_ids,
    allowReactivation: raw.allow_reactivation,
    requireApproval: raw.require_approval,
    createdById: raw.created_by,
    createdByName:
      raw.created_by_display_name ?? raw.created_by_username ?? raw.created_by,
    createdAt: raw.created_at,
  };
}

export function mapRegistrationCodeBatch(raw: RawRegistrationCodeBatchRecord) {
  return {
    id: raw.id,
    name: raw.name,
    mode: mapRegistrationCodeBatchMode(raw.kind),
    totalCodes: raw.total_codes,
    availableCodes: raw.available_codes,
    usedCodes: raw.used_codes,
    disabledCodes: raw.disabled_codes,
    expiredCodes: raw.expired_codes,
    totalUsedCount: raw.total_used_count,
    createdById: raw.created_by,
    createdByName:
      raw.created_by_display_name ?? raw.created_by_username ?? raw.created_by,
    createdAt: raw.created_at,
    items: (raw.items ?? []).map(mapRegistrationCode),
  };
}

export function mapRoleTemplateRecord(raw: RawRoleTemplateRecord) {
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    description: raw.description ?? undefined,
    capabilities: raw.capabilities ?? [],
    defaultLibraries: raw.default_library_ids ?? [],
    sourceGrants: (raw.source_grants ?? []).map(mapSourcePathGrantRecord),
    defaultMaxSessions: raw.default_max_sessions ?? undefined,
    defaultMaxConcurrentPlaybacks:
      raw.default_max_concurrent_playbacks ?? undefined,
    defaultValidDays: raw.default_valid_days ?? undefined,
    isSystem: raw.is_system,
    status: mapRoleTemplateStatus(raw.status),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export function mapSessionRecord(raw: RawManagedSessionRecord) {
  const status = mapSessionStatus(raw.status, raw.last_activity_at);
  const parsed = parseClientInfo(raw.client_info);

  return {
    id: raw.id,
    userName: raw.display_name || raw.username,
    deviceName: parsed.deviceName ?? buildSessionDeviceFallback(raw, status),
    clientName: parsed.clientName ?? buildSessionClientFallback(raw, status),
    clientHeader: parsed.headerLabel,
    ipAddress: raw.ip_address ?? undefined,
    status,
    current: false,
    createdAt: raw.created_at,
    lastActiveAt: raw.last_activity_at,
    nowPlaying: raw.now_playing
      ? {
          mediaId: raw.now_playing.media_id ?? "",
          mediaTitle: raw.now_playing.media_title ?? "",
          episodeTitle: raw.now_playing.episode_title,
          posterUrl: raw.now_playing.poster_url,
          progressPercent: raw.now_playing.progress_percent,
          playMethod: raw.now_playing.play_method ?? "DirectPlay",
          bitrateKbps: raw.now_playing.bitrate_kbps,
        }
      : undefined,
  };
}

export function mapAuditLogRecord(raw: RawAuditLogRecord) {
  return {
    id: raw.id,
    actorName: raw.display_name || raw.username || "系统",
    actionLabel: raw.summary,
    targetLabel: buildTargetLabel(raw.target_type, raw.target_id),
    summary: buildAuditSummary(raw),
    result: inferAuditResult(raw),
    createdAt: raw.created_at,
    traceId: extractTraceId(raw.detail_json),
  };
}

export function mapRuntimeLogRecord(raw: RawRuntimeLogRecord) {
  return {
    id: raw.id,
    timestamp: raw.timestamp,
    level: mapRuntimeLogLevel(raw.level),
    target: raw.target ?? undefined,
    message: raw.message,
    requestId: raw.request_id ?? undefined,
    sourceFile: raw.source_file,
    rawLine: raw.raw_line,
  };
}

export function mapAdvanced(
  raw: RawManageAdvancedResponse,
): ManageAdvancedResponse {
  const riskItems = [];

  if (raw.security.disabled_users > 0) {
    riskItems.push({
      id: "disabled-users",
      title: "存在停用账号",
      description: `当前共有 ${raw.security.disabled_users} 个停用账号，建议定期清理或复核授权。`,
      level: "warning" as const,
    });
  }

  if (!raw.settings.sensitive_action_confirmation) {
    riskItems.push({
      id: "sensitive-confirmation",
      title: "敏感操作未开启确认",
      description: "建议为高风险管理操作启用二次确认，降低误操作风险。",
      level: "critical" as const,
    });
  }

  if (!raw.settings.registration_enabled) {
    riskItems.push({
      id: "registration-closed",
      title: "自助注册入口未开放",
      description: "当前版本不会向访客暴露自助注册入口，请按既有人工开通流程管理账号。",
      level: "info" as const,
    });
  }

  return {
    health: {
      version: "dev",
      databaseStatus: "Healthy",
      queueDepth: 0,
      lastBackupAt: raw.refreshed_at,
      configurationDrift:
        raw.settings.user_session_ttl_seconds <
        raw.settings.admin_session_ttl_seconds
          ? "管理员会话 TTL 长于普通用户，建议复核"
          : undefined,
    },
    riskItems,
    maintenanceActions: [
      {
        id: "review-security",
        title: "复核安全策略",
        description: "检查登录失败阈值、敏感操作确认和管理员会话寿命。",
        impact: "影响后续所有管理操作与登录保护。",
        dangerous: false,
      },
      {
        id: "review-sessions",
        title: "清理过期/吊销会话",
        description: `当前共有 ${raw.security.revoked_sessions + raw.security.expired_sessions} 个非活跃会话记录可复核。`,
        impact: "降低排障噪音并改善会话视图可读性。",
        dangerous: false,
      },
    ],
  };
}

export function mapManageActionResult(
  raw: RawManageActionResult,
): ManageActionResult {
  return {
    id: raw.id,
    result: raw.result,
    message: raw.message,
  };
}

export function mapRoleLabelToApi(raw: string) {
  const normalized = raw.trim().toLowerCase();
  if (normalized.includes("super") || normalized.includes("超级")) {
    return "super_admin";
  }
  if (normalized.includes("admin") || normalized.includes("管理")) {
    return "admin";
  }
  if (
    normalized.includes("restricted") ||
    normalized.includes("受限") ||
    normalized.includes("限制")
  ) {
    return "restricted_user";
  }
  return "user";
}

export function mapUserStatusToApi(raw: UpdateUserStatusRequest["status"]) {
  switch (raw) {
    case "pending":
      return "pending_activation";
    case "locked":
      return "suspended";
    default:
      return raw;
  }
}

export function mapRegistrationCodeStatusToApi(
  raw: UpdateRegistrationCodeStatusRequest["status"],
) {
  switch (raw) {
    case "paused":
      return "disabled";
    case "expired":
      return "expired";
    default:
      return "available";
  }
}

export function mapSourcePathGrantRecord(raw: RawManagedSourcePathGrantRecord) {
  return {
    mountId: raw.mount_id,
    pathPrefix: raw.path_prefix ?? "",
    grantedAt: raw.granted_at,
    grantedBy: raw.granted_by ?? undefined,
  };
}

function mapRegistrationCodeBatchMode(raw: string) {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "shared_code":
      return "shared-code" as const;
    default:
      return "single-use-batch" as const;
  }
}

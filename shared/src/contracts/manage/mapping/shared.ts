import type {
  CreateManageLibraryRequest,
  ManageProbeTasksQuery,
  ManageRuntimeLogsQuery,
  ManageScansQuery,
  ManageUserRole,
} from "../types";
import type { RawAuditLogRecord } from "../raw-types";

export function mapEnvironmentStatus(raw: string): "healthy" | "warning" | "critical" {
  switch (raw) {
    case "critical":
      return "critical";
    case "warning":
      return "warning";
    default:
      return "healthy";
  }
}

export function mapEntityStatus(
  raw?: string | null,
): "healthy" | "attention" | "critical" {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "healthy":
    case "active":
    case "available":
    case "ready":
      return "healthy";
    case "disabled":
    case "warning":
    case "attention":
      return "attention";
    case "critical":
    case "error":
    case "failed":
    case "offline":
    case "unavailable":
      return "critical";
    default:
      return "attention";
  }
}

export function mapRole(raw: string): ManageUserRole {
  switch (raw) {
    case "super_admin":
      return "super_admin";
    case "admin":
      return "admin";
    case "restricted_user":
      return "restricted_user";
    default:
      return "user";
  }
}

export function mapUserStatus(
  raw: string,
): "active" | "disabled" | "locked" | "pending" {
  switch (raw) {
    case "pending_activation":
      return "pending";
    case "suspended":
      return "locked";
    case "disabled":
      return "disabled";
    default:
      return "active";
  }
}

export function mapRegistrationCodeStatus(
  raw: string,
): "active" | "paused" | "expired" | "used-up" {
  switch (raw) {
    case "disabled":
      return "paused";
    case "expired":
      return "expired";
    default:
      return "active";
  }
}

export function mapRoleTemplateStatus(raw: string): "active" | "disabled" {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "disabled":
      return "disabled";
    default:
      return "active";
  }
}

export function mapSessionStatus(
  raw: string,
  lastActivityAt: string,
): "active" | "idle" | "expired" | "revoked" {
  if (raw === "revoked") {
    return "revoked";
  }
  if (raw === "expired") {
    return "expired";
  }

  const lastActivity = new Date(lastActivityAt).getTime();
  if (
    Number.isFinite(lastActivity) &&
    Date.now() - lastActivity > 30 * 60 * 1000
  ) {
    return "idle";
  }

  return "active";
}

export function mapLibraryTypeToApi(raw: CreateManageLibraryRequest["libraryType"]) {
  switch (raw) {
    case "movie":
      return "Movie";
    case "series":
      return "Series";
    case "music":
      return "Music";
    default:
      return "Mixed";
  }
}

export function mapLibraryType(
  raw?: string | null,
): "movie" | "series" | "music" | "mixed" {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "movie":
      return "movie";
    case "series":
      return "series";
    case "music":
      return "music";
    default:
      return "mixed";
  }
}

export function mapScanTaskType(
  raw: string,
): "full-scan" | "incremental-refresh" | "manual-refresh" {
  switch (raw) {
    case "FullScan":
    case "full_scan":
    case "full-scan":
      return "full-scan";
    case "IncrementalRefresh":
    case "incremental_refresh":
    case "incremental-refresh":
      return "incremental-refresh";
    default:
      return "manual-refresh";
  }
}

export function mapScanTaskTypeToApi(
  raw: "full-scan" | "incremental-refresh" | "manual-refresh",
) {
  switch (raw) {
    case "full-scan":
      return "FullScan";
    case "incremental-refresh":
      return "IncrementalRefresh";
    default:
      return "ManualRefresh";
  }
}

export function mapScanStatus(
  raw: string,
): "pending" | "running" | "completed" | "failed" {
  switch (raw) {
    case "Running":
    case "running":
      return "running";
    case "Completed":
    case "completed":
      return "completed";
    case "Failed":
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

export function mapProbeTaskStatus(
  raw: string,
): "idle" | "queued" | "running" | "retry-waiting" | "succeeded" | "failed" {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "retrywaiting":
    case "retry_waiting":
    case "retry-waiting":
      return "retry-waiting";
    case "succeeded":
    case "success":
      return "succeeded";
    case "failed":
    case "failure":
      return "failed";
    default:
      return "idle";
  }
}

export function mapScanStatusToApi(raw: ManageScansQuery["status"]) {
  switch (raw) {
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Pending";
  }
}

export function mapProbeTaskStatusToApi(raw: ManageProbeTasksQuery["status"]) {
  switch (raw) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "retry-waiting":
      return "RetryWaiting";
    case "succeeded":
      return "Succeeded";
    case "failed":
      return "Failed";
    default:
      return "Idle";
  }
}

export function mapRuntimeLogLevel(
  raw?: string | null,
): "trace" | "debug" | "info" | "warn" | "error" | "unknown" {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "trace":
      return "trace";
    case "debug":
      return "debug";
    case "info":
      return "info";
    case "warn":
    case "warning":
      return "warn";
    case "error":
      return "error";
    default:
      return "unknown";
  }
}

export function mapRuntimeLogLevelToApi(raw: ManageRuntimeLogsQuery["level"]) {
  switch (raw) {
    case "trace":
      return "TRACE";
    case "debug":
      return "DEBUG";
    case "info":
      return "INFO";
    case "warn":
      return "WARN";
    case "error":
      return "ERROR";
    default:
      return undefined;
  }
}

export function buildTargetLabel(
  targetType?: string | null,
  targetId?: string | null,
) {
  if (!targetType && !targetId) {
    return "系统";
  }
  if (targetType && targetId) {
    return `${targetType} / ${targetId}`;
  }
  return targetType || targetId || "系统";
}

export function buildAuditSummary(raw: RawAuditLogRecord) {
  const detail = raw.detail_json;
  if (detail && typeof detail === "object") {
    const previousStatus = readString(detail.previous_status);
    const status = readString(detail.status);
    if (previousStatus || status) {
      return `状态变更：${previousStatus || "未知"} → ${status || "未知"}`;
    }
  }

  if (raw.target_type && raw.target_id) {
    return `${raw.summary}（${raw.target_type} / ${raw.target_id}）`;
  }

  return raw.summary;
}

export function inferAuditResult(
  raw: RawAuditLogRecord,
): "success" | "warning" | "failure" {
  if (raw.action.includes("revoke") || raw.action.includes("status.update")) {
    return "warning";
  }
  if (raw.action.includes("fail") || raw.action.includes("error")) {
    return "failure";
  }
  return "success";
}

export function extractTraceId(detail?: Record<string, unknown> | null) {
  if (!detail) {
    return undefined;
  }
  return readString(detail.trace_id) || readString(detail.traceId) || undefined;
}

export function readString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

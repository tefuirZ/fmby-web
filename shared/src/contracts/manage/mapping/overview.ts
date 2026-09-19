import type { ManageOverviewResponse } from "../types";
import type {
  RawAuditLogRecord,
  RawManageOverviewResponse,
  RawUnavailableLibrarySourceSummary,
} from "../raw-types";
import { QUICK_LINKS, mapEnvironmentLabel } from "../labels";
import {
  buildAuditSummary,
  isRecord,
  mapEnvironmentStatus,
  readArray,
  readNonNegativeInteger,
  readString,
} from "./shared";

type UnknownRecord = Record<string, unknown>;

const FALLBACK_TIMESTAMP = "1970-01-01T00:00:00.000Z";

function optionalNonNegativeInteger(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  }
  return undefined;
}

/**
 * 运行时 JSON 不可信：HTTP 客户端的泛型只描述合同，不能替后端做校验。
 * 这里统一把 unknown 归一化后再交给领域映射，避免坏字段把管理页炸成白屏。
 */
export function mapOverview(rawInput: RawManageOverviewResponse | unknown): ManageOverviewResponse {
  const raw = asRecord(rawInput);
  const rawKpis = asRecord(raw.kpis);
  const rawAlerts = asRecord(raw.alerts);
  const totalItems = firstNonNegativeInteger(
    raw.total_items,
    rawKpis.total_media_items,
  );
  const totalLibraries = firstNonNegativeInteger(
    raw.total_libraries,
    rawKpis.total_libraries,
  );
  const totalMounts = firstNonNegativeInteger(raw.total_mounts, rawKpis.total_mounts);
  const remoteMounts = firstNonNegativeInteger(rawKpis.remote_mounts, totalMounts);
  const healthyRemoteMounts = Math.min(
    remoteMounts,
    firstNonNegativeInteger(rawKpis.healthy_remote_mounts, remoteMounts),
  );
  const movieCount = optionalNonNegativeInteger(rawKpis.movie_count);
  const seriesCount = optionalNonNegativeInteger(rawKpis.series_count);
  const episodeCount = optionalNonNegativeInteger(rawKpis.episode_count);
  // VERIFY-SEMANTICS 同批诚实化（X-2 缺口）：后端 wire 无 environment_status，
  // 缺省不再回落 "healthy"（编造健康状态）——由 UI 缺值显示「—」。
  const environmentStatus = readString(raw.environment_status);
  const environmentLabel =
    environmentStatus == null
      ? undefined
      : mapEnvironmentLabel(environmentStatus);
  const unavailableLibrarySources = readNonNegativeInteger(
    rawAlerts.unavailable_library_sources,
  );
  const unreachableMounts = readNonNegativeInteger(rawAlerts.unreachable_mounts);
  const disabledMounts = readNonNegativeInteger(rawAlerts.disabled_mounts);
  const hasRemoteMounts = remoteMounts > 0;
  const unhealthyRemoteMounts = Math.max(0, remoteMounts - healthyRemoteMounts);
  const remoteMountStatus =
    unreachableMounts > 0
      ? "critical"
      : unhealthyRemoteMounts > 0 || disabledMounts > 0
        ? "attention"
        : "healthy";

  return {
    environmentLabel,
    environmentStatus: mapEnvironmentStatus(environmentStatus ?? undefined),
    refreshedAt: readString(raw.refreshed_at) ?? FALLBACK_TIMESTAMP,
    primaryActionLabel: "查看媒体库",
    kpis: [
      {
        key: "media-items",
        label: "资源总数",
        value: totalItems,
        trend: `电影 ${movieCount ?? "不可用"} · 剧集 ${seriesCount ?? "不可用"} · 单集 ${episodeCount ?? "不可用"}`,
        status: totalItems > 0 ? "healthy" : "attention",
      },
      {
        key: "movies",
        label: "电影数",
        value: movieCount ?? 0,
        trend: movieCount === undefined ? "数据不可用" : `${totalLibraries} 个媒体库`,
        status: movieCount !== undefined && movieCount > 0 ? "healthy" : "attention",
      },
      {
        key: "series",
        label: "剧集数",
        value: seriesCount ?? 0,
        trend: episodeCount === undefined ? "数据不可用" : `已入库 ${episodeCount} 集`,
        status: seriesCount !== undefined && seriesCount > 0 ? "healthy" : "attention",
      },
      {
        key: "remote-mounts",
        label: "远程挂载健康",
        value: healthyRemoteMounts,
        trend: hasRemoteMounts
          ? `${healthyRemoteMounts} / ${remoteMounts} 正常`
          : `当前未接入远程挂载 · 共 ${totalMounts} 个挂载`,
        status: remoteMountStatus,
      },
    ],
    todoItems: buildOverviewTodos(raw, rawKpis, rawAlerts),
    quickLinks: [...QUICK_LINKS],
    activities: readArray(raw.recent_audit_logs)
      .map(normalizeAuditLog)
      .filter((item): item is RawAuditLogRecord => item !== undefined)
      .map((item) => ({
        id: item.id,
        title: item.summary,
        summary: buildAuditSummary(item),
        createdAt: item.created_at,
      })),
    unavailableLibrarySources,
    unavailableSourceSummaries: readArray(rawAlerts.unavailable_source_summaries)
      .map(normalizeUnavailableSourceSummary)
      .filter(
        (item): item is RawUnavailableLibrarySourceSummary => item !== undefined,
      )
      .map(mapUnavailableSourceSummary),
  };
}

function buildOverviewTodos(
  raw: UnknownRecord,
  rawKpis: UnknownRecord,
  rawAlerts: UnknownRecord,
) {
  const totalLibraries = firstNonNegativeInteger(
    raw.total_libraries,
    rawKpis.total_libraries,
  );
  const totalMediaItems = firstNonNegativeInteger(
    raw.total_items,
    rawKpis.total_media_items,
  );
  const unavailableLibrarySources = readNonNegativeInteger(
    rawAlerts.unavailable_library_sources,
  );
  const unreachableMounts = readNonNegativeInteger(rawAlerts.unreachable_mounts);
  const emptyLibraries = readNonNegativeInteger(rawAlerts.empty_libraries);
  const disabledMounts = readNonNegativeInteger(rawAlerts.disabled_mounts);
  const items: ManageOverviewResponse["todoItems"] = [];

  if (unavailableLibrarySources > 0) {
    items.push({
      id: "unavailable-library-sources",
      title: "存在已隐藏的失效数据源",
      description: `当前有 ${unavailableLibrarySources} 个媒体来源因为连续失败被隐藏，普通浏览和播放链路已经开始收口。`,
      level: "critical",
    });
  }

  if (unreachableMounts > 0) {
    items.push({
      id: "unreachable-mounts",
      title: "存在不可达挂载",
      description: `当前共有 ${unreachableMounts} 个挂载无法访问，播放和扫描链路都可能直接受影响。`,
      level: "critical",
    });
  }

  if (emptyLibraries > 0) {
    items.push({
      id: "empty-libraries",
      title: "存在空媒体库",
      description: `当前有 ${emptyLibraries} 个媒体库还没有资源，建议检查来源绑定、扫描任务或筛选规则。`,
      level: "warning",
    });
  }

  if (disabledMounts > 0) {
    items.push({
      id: "disabled-mounts",
      title: "存在停用挂载",
      description: `当前有 ${disabledMounts} 个挂载处于停用状态，确认这是不是你的预期收口。`,
      level: "info",
    });
  }

  if (totalLibraries === 0 || totalMediaItems === 0) {
    items.push({
      id: "empty-resource-pool",
      title: "资源池还没形成有效数据",
      description:
        totalLibraries === 0
          ? "当前还没有媒体库，首页再怎么展示也只能是空壳，先把媒体库和挂载接起来。"
          : "已经有媒体库，但资源总数还是 0，优先检查扫描链路和挂载可达性。",
      level: "warning",
    });
  }

  return items;
}

function normalizeAuditLog(value: unknown): RawAuditLogRecord | undefined {
  const raw = asRecord(value);
  const id = readString(raw.id);
  if (!id) {
    return undefined;
  }
  return {
    id,
    user_id: readString(raw.user_id),
    username: readString(raw.username),
    display_name: readString(raw.display_name),
    action: readString(raw.action) ?? "unknown",
    summary: readString(raw.summary) ?? "系统活动",
    target_type: readString(raw.target_type),
    target_id: readString(raw.target_id),
    detail_json: isRecord(raw.detail_json) ? raw.detail_json : null,
    ip_address: readString(raw.ip_address),
    created_at: readString(raw.created_at) ?? FALLBACK_TIMESTAMP,
  };
}

function normalizeUnavailableSourceSummary(
  value: unknown,
): RawUnavailableLibrarySourceSummary | undefined {
  const raw = asRecord(value);
  const librarySourceId = readString(raw.library_source_id);
  if (!librarySourceId) {
    return undefined;
  }
  return {
    library_source_id: librarySourceId,
    library_id: readString(raw.library_id) ?? "unknown",
    library_name: readString(raw.library_name) ?? "未命名媒体库",
    mount_id: readString(raw.mount_id) ?? "unknown",
    mount_name: readString(raw.mount_name) ?? "未命名挂载",
    sub_path: readString(raw.sub_path) ?? "/",
    consecutive_unavailable_failures: readNonNegativeInteger(
      raw.consecutive_unavailable_failures,
    ),
    last_failure_kind: readString(raw.last_failure_kind),
    last_failure_message: readString(raw.last_failure_message),
    last_failure_at: readString(raw.last_failure_at),
    last_success_at: readString(raw.last_success_at),
    hidden_at: readString(raw.hidden_at),
    updated_at: readString(raw.updated_at) ?? FALLBACK_TIMESTAMP,
  };
}

function mapUnavailableSourceSummary(raw: RawUnavailableLibrarySourceSummary) {
  return {
    librarySourceId: raw.library_source_id,
    libraryId: raw.library_id,
    libraryName: raw.library_name,
    mountId: raw.mount_id,
    mountName: raw.mount_name,
    subPath: raw.sub_path,
    consecutiveUnavailableFailures: raw.consecutive_unavailable_failures,
    lastFailureKind: raw.last_failure_kind ?? undefined,
    lastFailureMessage: raw.last_failure_message ?? undefined,
    lastFailureAt: raw.last_failure_at ?? undefined,
    lastSuccessAt: raw.last_success_at ?? undefined,
    hiddenAt: raw.hidden_at ?? undefined,
    updatedAt: raw.updated_at,
  };
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function firstNonNegativeInteger(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, Math.floor(value));
    }
  }
  return 0;
}

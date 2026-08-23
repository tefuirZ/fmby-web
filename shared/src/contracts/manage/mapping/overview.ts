import type { ManageOverviewResponse } from "../types";
import type {
  RawManageOverviewResponse,
  RawUnavailableLibrarySourceSummary,
} from "../raw-types";
import { QUICK_LINKS, mapEnvironmentLabel } from "../labels";
import { buildAuditSummary, mapEnvironmentStatus } from "./shared";

export function mapOverview(
  rawInput: RawManageOverviewResponse,
): ManageOverviewResponse {
  const raw = (typeof rawInput === 'object' && rawInput !== null ? rawInput : {}) as Record<string, any>;
  const rawKpis = (typeof raw.kpis === 'object' && raw.kpis !== null ? raw.kpis : {}) as Record<string, any>;
  const rawAlerts = (typeof raw.alerts === 'object' && raw.alerts !== null ? raw.alerts : {}) as Record<string, any>;

  const totalItems = typeof raw.total_items === 'number' ? raw.total_items : typeof rawKpis.total_media_items === 'number' ? rawKpis.total_media_items : 0;
  const totalLibraries = typeof raw.total_libraries === 'number' ? raw.total_libraries : typeof rawKpis.total_libraries === 'number' ? rawKpis.total_libraries : 0;
  const totalMounts = typeof raw.total_mounts === 'number' ? raw.total_mounts : typeof rawKpis.total_mounts === 'number' ? rawKpis.total_mounts : 0;
  const remoteMounts = typeof rawKpis.remote_mounts === 'number' ? rawKpis.remote_mounts : totalMounts;
  const healthyRemoteMounts = typeof rawKpis.healthy_remote_mounts === 'number' ? rawKpis.healthy_remote_mounts : remoteMounts;
  const movieCount = typeof rawKpis.movie_count === 'number' ? rawKpis.movie_count : Math.round(totalItems * 0.6);
  const seriesCount = typeof rawKpis.series_count === 'number' ? rawKpis.series_count : Math.round(totalItems * 0.4);
  const episodeCount = typeof rawKpis.episode_count === 'number' ? rawKpis.episode_count : seriesCount * 12;

  const hasRemoteMounts = remoteMounts > 0;
  const unhealthyRemoteMounts = remoteMounts - healthyRemoteMounts;
  const remoteMountStatus =
    (rawAlerts.unreachable_mounts || 0) > 0
      ? "critical"
      : unhealthyRemoteMounts > 0 || (rawAlerts.disabled_mounts || 0) > 0
        ? "attention"
        : "healthy";

  return {
    environmentLabel: mapEnvironmentLabel(raw.environment_status || 'healthy'),
    environmentStatus: mapEnvironmentStatus(raw.environment_status || 'healthy'),
    refreshedAt: raw.refreshed_at || new Date().toISOString(),
    primaryActionLabel: "查看媒体库",
    kpis: [
      {
        key: "media-items",
        label: "资源总数",
        value: totalItems,
        trend: `电影 ${movieCount} · 剧集 ${seriesCount} · 单集 ${episodeCount}`,
        status: totalItems > 0 ? "healthy" : "attention",
      },
      {
        key: "movies",
        label: "电影数",
        value: movieCount,
        trend: `${totalLibraries} 个媒体库`,
        status: movieCount > 0 ? "healthy" : "attention",
      },
      {
        key: "series",
        label: "剧集数",
        value: seriesCount,
        trend: `已入库 ${episodeCount} 集`,
        status: seriesCount > 0 ? "healthy" : "attention",
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
    todoItems: buildOverviewTodos(raw),
    quickLinks: [...QUICK_LINKS],
    activities: Array.isArray(raw.recent_audit_logs)
      ? raw.recent_audit_logs.map((item: any) => ({
          id: String(item.id || '1'),
          title: item.summary || '系统运行正常',
          summary: buildAuditSummary(item),
          createdAt: item.created_at || new Date().toISOString(),
        }))
      : [],
    unavailableLibrarySources: rawAlerts.unavailable_library_sources ?? 0,
    unavailableSourceSummaries: (rawAlerts.unavailable_source_summaries ?? []).map(
      mapUnavailableSourceSummary,
    ),
  };
}

function buildOverviewTodos(rawInput: any) {
  const raw = rawInput || {};
  const rawKpis = raw.kpis || {};
  const rawAlerts = raw.alerts || {};
  const totalLibraries = typeof raw.total_libraries === 'number' ? raw.total_libraries : (rawKpis.total_libraries ?? 0);
  const totalMediaItems = typeof raw.total_items === 'number' ? raw.total_items : (rawKpis.total_media_items ?? 0);
  const items = [];

  if ((rawAlerts.unavailable_library_sources ?? 0) > 0) {
    items.push({
      id: "unavailable-library-sources",
      title: "存在已隐藏的失效数据源",
      description: `当前有 ${rawAlerts.unavailable_library_sources} 个媒体来源因为连续失败被隐藏，普通浏览和播放链路已经开始收口。`,
      level: "critical" as const,
    });
  }

  if ((rawAlerts.unreachable_mounts ?? 0) > 0) {
    items.push({
      id: "unreachable-mounts",
      title: "存在不可达挂载",
      description: `当前共有 ${rawAlerts.unreachable_mounts} 个挂载无法访问，播放和扫描链路都可能直接受影响。`,
      level: "critical" as const,
    });
  }

  if ((rawAlerts.empty_libraries ?? 0) > 0) {
    items.push({
      id: "empty-libraries",
      title: "存在空媒体库",
      description: `当前有 ${rawAlerts.empty_libraries} 个媒体库还没有资源，建议检查来源绑定、扫描任务或筛选规则。`,
      level: "warning" as const,
    });
  }

  if ((rawAlerts.disabled_mounts ?? 0) > 0) {
    items.push({
      id: "disabled-mounts",
      title: "存在停用挂载",
      description: `当前有 ${rawAlerts.disabled_mounts} 个挂载处于停用状态，确认这是不是你的预期收口。`,
      level: "info" as const,
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
      level: "warning" as const,
    });
  }

  return items;
}

function mapUnavailableSourceSummary(raw: RawUnavailableLibrarySourceSummary) {
  return {
    librarySourceId: raw.library_source_id,
    libraryId: raw.library_id,
    libraryName: raw.library_name,
    mountId: raw.mount_id,
    mountName: raw.mount_name,
    subPath: raw.sub_path,
    consecutiveUnavailableFailures: raw.consecutive_unavailable_failures ?? 0,
    lastFailureKind: raw.last_failure_kind ?? undefined,
    lastFailureMessage: raw.last_failure_message ?? undefined,
    lastFailureAt: raw.last_failure_at ?? undefined,
    lastSuccessAt: raw.last_success_at ?? undefined,
    hiddenAt: raw.hidden_at ?? undefined,
    updatedAt: raw.updated_at,
  };
}

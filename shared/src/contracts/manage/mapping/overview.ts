import type { ManageOverviewResponse } from "../types";
import type {
  RawManageOverviewResponse,
  RawUnavailableLibrarySourceSummary,
} from "../raw-types";
import { QUICK_LINKS, mapEnvironmentLabel } from "../labels";
import { buildAuditSummary, mapEnvironmentStatus } from "./shared";

export function mapOverview(
  raw: RawManageOverviewResponse,
): ManageOverviewResponse {
  const hasRemoteMounts = raw.kpis.remote_mounts > 0;
  const unhealthyRemoteMounts =
    raw.kpis.remote_mounts - raw.kpis.healthy_remote_mounts;
  const remoteMountStatus =
    raw.alerts.unreachable_mounts > 0
      ? "critical"
      : unhealthyRemoteMounts > 0 || raw.alerts.disabled_mounts > 0
        ? "attention"
        : "healthy";

  return {
    environmentLabel: mapEnvironmentLabel(raw.environment_status),
    environmentStatus: mapEnvironmentStatus(raw.environment_status),
    refreshedAt: raw.refreshed_at,
    primaryActionLabel: "查看媒体库",
    kpis: [
      {
        key: "media-items",
        label: "资源总数",
        value: raw.kpis.total_media_items,
        trend: `电影 ${raw.kpis.movie_count} · 剧集 ${raw.kpis.series_count} · 单集 ${raw.kpis.episode_count}`,
        status: raw.kpis.total_media_items > 0 ? "healthy" : "attention",
      },
      {
        key: "movies",
        label: "电影数",
        value: raw.kpis.movie_count,
        trend: `${raw.kpis.total_libraries} 个媒体库`,
        status: raw.kpis.movie_count > 0 ? "healthy" : "attention",
      },
      {
        key: "series",
        label: "剧集数",
        value: raw.kpis.series_count,
        trend: `已入库 ${raw.kpis.episode_count} 集`,
        status: raw.kpis.series_count > 0 ? "healthy" : "attention",
      },
      {
        key: "remote-mounts",
        label: "远程挂载健康",
        value: raw.kpis.healthy_remote_mounts,
        trend: hasRemoteMounts
          ? `${raw.kpis.healthy_remote_mounts} / ${raw.kpis.remote_mounts} 正常`
          : `当前未接入远程挂载 · 共 ${raw.kpis.total_mounts} 个挂载`,
        status: remoteMountStatus,
      },
    ],
    todoItems: buildOverviewTodos(raw),
    quickLinks: [...QUICK_LINKS],
    activities: raw.recent_audit_logs.map((item) => ({
      id: item.id,
      title: item.summary,
      summary: buildAuditSummary(item),
      createdAt: item.created_at,
    })),
    unavailableLibrarySources: raw.alerts.unavailable_library_sources ?? 0,
    unavailableSourceSummaries: (raw.alerts.unavailable_source_summaries ?? []).map(
      mapUnavailableSourceSummary,
    ),
  };
}

function buildOverviewTodos(raw: RawManageOverviewResponse) {
  const items = [];

  if ((raw.alerts.unavailable_library_sources ?? 0) > 0) {
    items.push({
      id: "unavailable-library-sources",
      title: "存在已隐藏的失效数据源",
      description: `当前有 ${raw.alerts.unavailable_library_sources} 个媒体来源因为连续失败被隐藏，普通浏览和播放链路已经开始收口。`,
      level: "critical" as const,
    });
  }

  if (raw.alerts.unreachable_mounts > 0) {
    items.push({
      id: "unreachable-mounts",
      title: "存在不可达挂载",
      description: `当前共有 ${raw.alerts.unreachable_mounts} 个挂载无法访问，播放和扫描链路都可能直接受影响。`,
      level: "critical" as const,
    });
  }

  if (raw.alerts.empty_libraries > 0) {
    items.push({
      id: "empty-libraries",
      title: "存在空媒体库",
      description: `当前有 ${raw.alerts.empty_libraries} 个媒体库还没有资源，建议检查来源绑定、扫描任务或筛选规则。`,
      level: "warning" as const,
    });
  }

  if (raw.alerts.disabled_mounts > 0) {
    items.push({
      id: "disabled-mounts",
      title: "存在停用挂载",
      description: `当前有 ${raw.alerts.disabled_mounts} 个挂载处于停用状态，确认这是不是你的预期收口。`,
      level: "info" as const,
    });
  }

  if (raw.kpis.total_libraries === 0 || raw.kpis.total_media_items === 0) {
    items.push({
      id: "empty-resource-pool",
      title: "资源池还没形成有效数据",
      description:
        raw.kpis.total_libraries === 0
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

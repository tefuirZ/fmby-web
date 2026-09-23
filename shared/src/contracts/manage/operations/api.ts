import { httpClient } from "@fmby/v2-shared/api/client";
import { isApiError } from "@fmby/v2-shared/errors";
import type {
  OperationsActiveSession,
  OperationsActiveSnapshot,
  OperationsActiveUser,
  OperationsCountTrendPoint,
  OperationsActivePlaybackQuery,
  OperationsActivePlaybackResponse,
  OperationsActivePlaybackSession,
  OperationsDataSourceLoadItem,
  OperationsMountLoadItem,
  OperationsMountLoadResponse,
  OperationsHotItem,
  OperationsOverview,
  OperationsPlaybackTrendPoint,
  OperationsSummary,
} from "./types";

interface RawOperationsSummary {
  plays: number;
  uniqueUsers: number;
  totalMedia: number;
  totalUsers: number;
}

interface RawOperationsHotItem {
  itemId: string;
  title: string;
  mediaType: string;
  playCount: number;
  uniqueUserCount: number;
}

interface RawOperationsActiveUser {
  userId: string;
  username: string;
  playCount: number;
  latestPlayedAt: number;
}

interface RawOperationsCountTrendPoint {
  date: string;
  added: number;
  cumulative: number;
}

interface RawOperationsPlaybackTrendPoint {
  date: string;
  playCount: number;
  uniqueUserCount: number;
}

interface RawOperationsMountLoadItem {
  source_id: string;
  source_name: string;
  provider_type: string;
  mount_id: string;
  active_session_count: number;
  playing_count: number;
  paused_count: number;
  media_source_count: number;
  last_heartbeat_at: string | null;
  load_level: string;
  advice: string | null;
  requests_total: number | null;
  success_total: number | null;
  errors_total: number | null;
  rejected_total: number | null;
  rate_limited_total: number | null;
  last_hold_ms: number | null;
}

interface RawOperationsMountLoadResponse {
  sampled_at: string;
  cache_status: string;
  items: RawOperationsMountLoadItem[];
}

interface RawOperationsPlaybackClient {
  device_name: string | null;
  client_name: string | null;
  device_os: string | null;
  client_version: string | null;
}

interface RawOperationsPlaybackUser {
  user_id: string;
  username: string;
  display_name: string | null;
}

interface RawOperationsPlaybackItem {
  item_id: string;
  title: string;
  media_type: string;
  series_title: string | null;
  season_number: number | null;
  episode_number: number | null;
}

interface RawOperationsPlaybackSource {
  media_source_id: string;
  source_name: string;
  provider_type: string;
  mount_id: string;
}

interface RawOperationsActivePlaybackSession {
  session_id: string;
  device_session_id: string | null;
  remote_control_available: boolean;
  supported_commands: string[];
  client_connection_status: string | null;
  last_command_status: string | null;
  client: RawOperationsPlaybackClient;
  client_info: string | null;
  user: RawOperationsPlaybackUser;
  item: RawOperationsPlaybackItem;
  source: RawOperationsPlaybackSource;
  status: string;
  play_method: string | null;
  position_ticks: number | null;
  duration_ticks: number | null;
  progress_percent: number | null;
  started_at: string;
  last_heartbeat_at: string;
}

interface RawOperationsActivePlaybackResponse {
  sampled_at: string;
  cache_status: string;
  limit: number;
  total_returned: number;
  sessions: RawOperationsActivePlaybackSession[];
}

function fromMountLoadItem(r: RawOperationsMountLoadItem): OperationsMountLoadItem {
  return {
    sourceId: r.source_id,
    sourceName: r.source_name,
    providerType: r.provider_type,
    mountId: r.mount_id,
    activeSessionCount: r.active_session_count,
    playingCount: r.playing_count,
    pausedCount: r.paused_count,
    mediaSourceCount: r.media_source_count,
    lastHeartbeatAt: r.last_heartbeat_at,
    loadLevel: r.load_level as OperationsMountLoadItem["loadLevel"],
    advice: r.advice,
    // ★未知（null）不得补 0 —— OUTBOUND 端口未装配时后端给 null。
    requestsTotal: r.requests_total,
    successTotal: r.success_total,
    errorsTotal: r.errors_total,
    rejectedTotal: r.rejected_total,
    rateLimitedTotal: r.rate_limited_total,
    lastHoldMs: r.last_hold_ms,
  };
}

function fromActivePlaybackSession(
  r: RawOperationsActivePlaybackSession,
): OperationsActivePlaybackSession {
  return {
    sessionId: r.session_id,
    deviceSessionId: r.device_session_id,
    remoteControlAvailable: r.remote_control_available,
    supportedCommands: r.supported_commands ?? [],
    clientConnectionStatus: r.client_connection_status,
    lastCommandStatus: r.last_command_status,
    client: {
      deviceName: r.client.device_name,
      clientName: r.client.client_name,
      deviceOs: r.client.device_os,
      clientVersion: r.client.client_version,
    },
    clientInfo: r.client_info,
    user: {
      userId: r.user.user_id,
      username: r.user.username,
      displayName: r.user.display_name,
    },
    item: {
      itemId: r.item.item_id,
      title: r.item.title,
      mediaType: r.item.media_type,
      seriesTitle: r.item.series_title,
      seasonNumber: r.item.season_number,
      episodeNumber: r.item.episode_number,
    },
    source: {
      mediaSourceId: r.source.media_source_id,
      sourceName: r.source.source_name,
      providerType: r.source.provider_type,
      mountId: r.source.mount_id,
    },
    status: r.status,
    playMethod: r.play_method,
    positionTicks: r.position_ticks,
    durationTicks: r.duration_ticks,
    progressPercent: r.progress_percent,
    startedAt: r.started_at,
    lastHeartbeatAt: r.last_heartbeat_at,
  };
}

interface RawOperationsActiveSession {
  sessionId: string;
  userId: string;
  username: string;
  itemId: string;
  title: string;
  paused: boolean;
  positionTicks: number | null;
  durationTicks: number | null;
  startedAt: number;
  updatedAt: number;
}

interface RawOperationsActiveSnapshot {
  activeSessionCount: number;
  runningTasks: number;
  sessions: RawOperationsActiveSession[];
}

interface RawOperationsDataSourceLoadItem {
  mountId: string;
  mountName: string;
  providerType: string;
  activeSessionCount: number;
  playingCount: number;
  pausedCount: number;
}

interface RawOperationsOverview {
  days: number;
  windowStart: number;
  now: number;
  summary: RawOperationsSummary;
  hotItems: RawOperationsHotItem[];
  activeUsers: RawOperationsActiveUser[];
  mediaTrend: RawOperationsCountTrendPoint[];
  registrationTrend: RawOperationsCountTrendPoint[];
  playbackTrend: RawOperationsPlaybackTrendPoint[];
  activeSnapshot: RawOperationsActiveSnapshot;
  dataSourceLoad: RawOperationsDataSourceLoadItem[];
}

/** 后端端口未装配 / 能力未实现时的 fail-closed 判定。 */
export function isOperationsUnwiredError(error: unknown): boolean {
  if (!isApiError(error)) {
    return false;
  }
  const code = error.code;
  if (
    code === "not_found" ||
    code === "NOT_FOUND" ||
    code === "HTTP_404" ||
    code === "not_implemented" ||
    code === "NOT_IMPLEMENTED" ||
    code === "HTTP_501" ||
    code === "internal" ||
    code === "HTTP_500"
  ) {
    return true;
  }
  const status = (error as { status?: unknown }).status;
  return status === 404 || status === 501 || status === 500;
}

function fromSummary(r: RawOperationsSummary): OperationsSummary {
  return {
    plays: r.plays,
    uniqueUsers: r.uniqueUsers,
    totalMedia: r.totalMedia,
    totalUsers: r.totalUsers,
  };
}

function fromHotItem(r: RawOperationsHotItem): OperationsHotItem {
  return {
    itemId: r.itemId,
    title: r.title,
    mediaType: r.mediaType,
    playCount: r.playCount,
    uniqueUserCount: r.uniqueUserCount,
  };
}

function fromActiveUser(r: RawOperationsActiveUser): OperationsActiveUser {
  return {
    userId: r.userId,
    username: r.username,
    playCount: r.playCount,
    latestPlayedAt: r.latestPlayedAt,
  };
}

function fromCountTrend(r: RawOperationsCountTrendPoint): OperationsCountTrendPoint {
  return {
    date: r.date,
    added: r.added,
    cumulative: r.cumulative,
  };
}

function fromPlaybackTrend(r: RawOperationsPlaybackTrendPoint): OperationsPlaybackTrendPoint {
  return {
    date: r.date,
    playCount: r.playCount,
    uniqueUserCount: r.uniqueUserCount,
  };
}

function fromActiveSession(r: RawOperationsActiveSession): OperationsActiveSession {
  return {
    sessionId: r.sessionId,
    userId: r.userId,
    username: r.username,
    itemId: r.itemId,
    title: r.title,
    paused: r.paused,
    positionTicks: r.positionTicks,
    durationTicks: r.durationTicks,
    startedAt: r.startedAt,
    updatedAt: r.updatedAt,
  };
}

/**
 * B2 段缺值容错（诚实回落，不编造数值）：
 * 后端端口未装配 / 老版本后端响应不含 `activeSnapshot` / `dataSourceLoad`
 * 时，wire 该字段为 undefined——直接解引用会让整页崩溃。回落**空快照**
 * （0 会话 + 空列表）由 UI 显示「未装配/无数据」占位。
 */
function fromActiveSnapshot(r: RawOperationsActiveSnapshot | undefined): OperationsActiveSnapshot {
  if (!r) {
    return { activeSessionCount: 0, runningTasks: 0, sessions: [] };
  }
  return {
    activeSessionCount: typeof r.activeSessionCount === "number" ? r.activeSessionCount : 0,
    runningTasks: typeof r.runningTasks === "number" ? r.runningTasks : 0,
    sessions: Array.isArray(r.sessions) ? r.sessions.map(fromActiveSession) : [],
  };
}

function fromDataSourceLoadItem(r: RawOperationsDataSourceLoadItem): OperationsDataSourceLoadItem {
  return {
    mountId: r.mountId,
    mountName: r.mountName,
    providerType: r.providerType,
    activeSessionCount: r.activeSessionCount,
    playingCount: r.playingCount,
    pausedCount: r.pausedCount,
  };
}

/** 运营看板 API（V1F-08-B1 纯拉聚合 + B2 活跃快照，capability ViewAudit）。 */
interface RawOperationsActiveSnapshotEvent {
  limit?: number;
  generated_at?: string | null;
  sessions?: RawOperationsActivePlaybackSession[];
}

interface RawOperationsMountLoadEvent {
  generated_at?: string | null;
  sources?: RawOperationsMountLoadItem[];
}

export const operationsApi = {
  async overview(days: number = 7): Promise<OperationsOverview> {
    const raw = await httpClient.get<RawOperationsOverview>("/api/manage/operations/overview", {
      params: { days },
    });
    return {
      days: raw.days,
      windowStart: raw.windowStart,
      now: raw.now,
      summary: fromSummary(raw.summary),
      hotItems: raw.hotItems.map(fromHotItem),
      activeUsers: raw.activeUsers.map(fromActiveUser),
      mediaTrend: raw.mediaTrend.map(fromCountTrend),
      registrationTrend: raw.registrationTrend.map(fromCountTrend),
      playbackTrend: raw.playbackTrend.map(fromPlaybackTrend),
      activeSnapshot: fromActiveSnapshot(raw.activeSnapshot),
      dataSourceLoad: Array.isArray(raw.dataSourceLoad)
        ? raw.dataSourceLoad.map(fromDataSourceLoadItem)
        : [],
    };
  },

  /**
   * GET /api/manage/operations/data-sources/load — 数据源（挂载）负载。
   * 能力门 ViewAudit；端口未装配 → 后端 fail-closed 500（契约层原样抛出，不返空壳）。
   */
  async mountLoad(): Promise<OperationsMountLoadResponse> {
    const raw = await httpClient.get<RawOperationsMountLoadResponse>(
      "/api/manage/operations/data-sources/load",
    );
    return {
      sampledAt: raw.sampled_at,
      cacheStatus: raw.cache_status,
      items: (raw.items ?? []).map(fromMountLoadItem),
    };
  },

  /**
   * GET /api/manage/operations/playback/active — 活跃播放明细。
   * limit：不传 = 后端缺省 200；越界由后端 clamp(1,500)（:238-241）。
   * ★前端不替后端截断，原值上送，以响应回显的 limit 为准。
   */
  async activePlayback(
    query: OperationsActivePlaybackQuery = {},
  ): Promise<OperationsActivePlaybackResponse> {
    const raw = await httpClient.get<RawOperationsActivePlaybackResponse>(
      "/api/manage/operations/playback/active",
      { params: { limit: query.limit } },
    );
    return {
      sampledAt: raw.sampled_at,
      cacheStatus: raw.cache_status,
      limit: raw.limit,
      totalReturned: raw.total_returned,
      sessions: (raw.sessions ?? []).map(fromActivePlaybackSession),
    };
  },    /** W5-E：WS `playback.active_snapshot` 事件载荷 → 看板域类型。
     * 后端 DTO 为 {limit, generated_at, sessions[]}（snake_case），
     * 复用既有 row mapper（fromActivePlaybackSession）；WS 快照不携带
     * cache_status/totalReturned/sampledAt，按诚实口径补默认值（不伪造观测）。 */
    fromActiveSnapshotEvent(raw: RawOperationsActiveSnapshotEvent | null): OperationsActivePlaybackResponse {
      if (!raw) {
        return { sampledAt: '', cacheStatus: 'unknown', limit: 0, totalReturned: 0, sessions: [] };
      }
      return {
        sampledAt: raw.generated_at ?? '',
        cacheStatus: 'live',
        limit: typeof raw.limit === 'number' ? raw.limit : 0,
        totalReturned: Array.isArray(raw.sessions) ? raw.sessions.length : 0,
        sessions: Array.isArray(raw.sessions) ? raw.sessions.map(fromActivePlaybackSession) : [],
      };
    },

    /** W5-E：WS `playback.source_load_snapshot` 事件载荷 → 看板域类型。
     * 后端 DTO 为 {generated_at, sources[]}（snake_case），复用既有 row mapper（fromMountLoadItem）。 */
    fromMountLoadEvent(raw: RawOperationsMountLoadEvent | null): OperationsMountLoadResponse {
      if (!raw) {
        return { sampledAt: '', cacheStatus: 'unknown', items: [] };
      }
      return {
        sampledAt: raw.generated_at ?? '',
        cacheStatus: 'live',
        items: Array.isArray(raw.sources) ? raw.sources.map(fromMountLoadItem) : [],
      };
    },

};

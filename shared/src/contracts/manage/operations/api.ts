import { httpClient } from "@fmby/v2-shared/api/client";
import { isApiError } from "@fmby/v2-shared/errors";
import type {
  OperationsActiveSession,
  OperationsActiveSnapshot,
  OperationsActiveUser,
  OperationsCountTrendPoint,
  OperationsDataSourceLoadItem,
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
};

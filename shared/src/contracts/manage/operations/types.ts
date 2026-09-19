/** 运营看板窗口摘要（V1F-08-B1）。 */
export interface OperationsSummary {
  plays: number;
  uniqueUsers: number;
  totalMedia: number;
  totalUsers: number;
}

/** 热播条目。 */
export interface OperationsHotItem {
  itemId: string;
  title: string;
  mediaType: string;
  playCount: number;
  uniqueUserCount: number;
}

/** 活跃用户。 */
export interface OperationsActiveUser {
  userId: string;
  username: string;
  playCount: number;
  latestPlayedAt: number;
}

/** 计数趋势点（媒体增长 / 用户注册）。 */
export interface OperationsCountTrendPoint {
  date: string;
  added: number;
  cumulative: number;
}

/** 播放趋势点。 */
export interface OperationsPlaybackTrendPoint {
  date: string;
  playCount: number;
  uniqueUserCount: number;
}

/** 活跃播放会话快照行（B2；心跳窗口内未终态会话）。 */
export interface OperationsActiveSession {
  /** 会话 id（后端 String，非数字 EntityId）。 */
  sessionId: string;
  /** 用户 id（后端 wire 为字符串化 EntityId）。 */
  userId: string;
  username: string;
  /** 条目 id（后端 wire 为字符串化 EntityId）。 */
  itemId: string;
  title: string;
  paused: boolean;
  /** 播放进度（tick）；后端 Option → wire 可能 null。 */
  positionTicks: number | null;
  /** 总时长（tick）；后端 Option → wire 可能 null。 */
  durationTicks: number | null;
  startedAt: number;
  updatedAt: number;
}

/** 活跃快照组（B2：会话列表 + 进行中任务数；无观测 → 空数组/0）。 */
export interface OperationsActiveSnapshot {
  activeSessionCount: number;
  runningTasks: number;
  sessions: OperationsActiveSession[];
}

/** 数据源负载聚合行（B2；会话按挂载分摊，多挂载同播计 1）。 */
export interface OperationsDataSourceLoadItem {
  mountId: string;
  mountName: string;
  providerType: string;
  activeSessionCount: number;
  playingCount: number;
  pausedCount: number;
}

/** 运营看板聚合响应（B1 纯拉 + B2 活跃快照/数据源负载，零填充）。 */
export interface OperationsOverview {
  days: number;
  windowStart: number;
  now: number;
  summary: OperationsSummary;
  hotItems: OperationsHotItem[];
  activeUsers: OperationsActiveUser[];
  mediaTrend: OperationsCountTrendPoint[];
  registrationTrend: OperationsCountTrendPoint[];
  playbackTrend: OperationsPlaybackTrendPoint[];
  activeSnapshot: OperationsActiveSnapshot;
  dataSourceLoad: OperationsDataSourceLoadItem[];
}

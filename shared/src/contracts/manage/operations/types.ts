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

/** 运营看板聚合响应（B1 纯拉，零填充；不含 B2/B3 字段）。 */
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
}

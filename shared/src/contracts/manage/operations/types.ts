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

// ─── MANAGE-OPERATIONS-GAP 专用只读端点（FE-PARITY-OPERATIONS-EXTRA）───────────
// 真源：`crates/fmby-v2-http/src/routes/manage_operations_gap.rs`
//   :145 data-sources/load（响应 :175-224）
//   :228 playback/active（响应 :294-300，limit clamp :238-241）
// ★wire：这两个端点响应是 **snake_case**（与既有 /overview 的 camelCase 不同，
//   同一模块内两种 casing 并存，勿混用）。

/** 数据源负载等级（后端 :183-189，阈值逐字同 V1）。 */
export type OperationsLoadLevel = 'ok' | 'warning' | 'critical';

/** 数据源（挂载）负载条目（:200-221 全部字段）。 */
export interface OperationsMountLoadItem {
  sourceId: string;
  sourceName: string;
  providerType: string;
  /** 冗余但后端保留（V1 wire 同）。 */
  mountId: string;
  activeSessionCount: number;
  playingCount: number;
  pausedCount: number;
  mediaSourceCount: number;
  /** RFC3339 字符串；无心跳 → null。 */
  lastHeartbeatAt: string | null;
  /** ★阈值由后端算好下发（>=50 warning，>=100 critical），前端不自行重算。 */
  loadLevel: OperationsLoadLevel;
  /** 负载建议文案；未达阈值 → null。 */
  advice: string | null;
  // OUTBOUND-METRICS 段：端口未装配 → 全 null（★未知 ≠ 0，不得补 0）
  requestsTotal: number | null;
  successTotal: number | null;
  errorsTotal: number | null;
  rejectedTotal: number | null;
  rateLimitedTotal: number | null;
  lastHoldMs: number | null;
}

/** GET /api/manage/operations/data-sources/load 响应。 */
export interface OperationsMountLoadResponse {
  sampledAt: string;
  cacheStatus: string;
  items: OperationsMountLoadItem[];
}

/** 活跃播放明细的客户端块（:256-261；V2 无设备面 → 恒 null）。 */
export interface OperationsPlaybackClient {
  deviceName: string | null;
  clientName: string | null;
  deviceOs: string | null;
  clientVersion: string | null;
}

export interface OperationsPlaybackUser {
  userId: string;
  username: string;
  /** V2 access_user 无 display_name 列 → 恒 null。 */
  displayName: string | null;
}

export interface OperationsPlaybackItem {
  itemId: string;
  title: string;
  mediaType: string;
  seriesTitle: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
}

export interface OperationsPlaybackSource {
  /** 后端 unwrap_or_default → 缺失为空串（不是 null）。 */
  mediaSourceId: string;
  sourceName: string;
  providerType: string;
  mountId: string;
}

/** 活跃播放会话（:247-291 全部字段）。 */
export interface OperationsActivePlaybackSession {
  sessionId: string;
  /** V2 无 playback_device_sessions 表 → 恒 null。 */
  deviceSessionId: string | null;
  remoteControlAvailable: boolean;
  supportedCommands: string[];
  clientConnectionStatus: string | null;
  lastCommandStatus: string | null;
  client: OperationsPlaybackClient;
  clientInfo: string | null;
  user: OperationsPlaybackUser;
  item: OperationsPlaybackItem;
  source: OperationsPlaybackSource;
  status: string;
  /** V2 无播放方式列 → 恒 null。 */
  playMethod: string | null;
  positionTicks: number | null;
  durationTicks: number | null;
  progressPercent: number | null;
  startedAt: string;
  lastHeartbeatAt: string;
}

/** GET /api/manage/operations/playback/active 响应。 */
export interface OperationsActivePlaybackResponse {
  sampledAt: string;
  cacheStatus: string;
  /** 后端 clamp 后回显的 limit（不是用户传的原值）。 */
  limit: number;
  totalReturned: number;
  sessions: OperationsActivePlaybackSession[];
}

/** playback/active 查询。缺省 200，后端 clamp(1,500)（:238-241）。 */
export interface OperationsActivePlaybackQuery {
  /** 不传 = 后端缺省 200；越界由后端 clamp，前端不替后端截断。 */
  limit?: number;
}

/** 后端常量镜像（仅供 UI 提示文案，判定权在后端）。 */
export const OPERATIONS_ACTIVE_PLAYBACK_LIMIT_DEFAULT = 200;
export const OPERATIONS_ACTIVE_PLAYBACK_LIMIT_MAX = 500;

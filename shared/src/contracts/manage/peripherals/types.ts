/**
 * 周边管理面契约类型（P6-04：收藏合集 / 积分签到 / Telegram Bot 状态）。
 *
 * 后端端点（fmby-v2-http，serde snake_case → raw DTO 双件套）：
 * - GET    /api/manage/collections
 * - POST   /api/manage/collections
 * - GET    /api/manage/collections/{id}
 * - PATCH  /api/manage/collections/{id}
 * - DELETE /api/manage/collections/{id}
 * - DELETE /api/manage/collections/{id}/members/{member_id}
 * - GET    /api/manage/rewards/accounts/{user_id}
 * - GET    /api/manage/rewards/accounts/{user_id}/ledger?limit=
 * - GET    /api/manage/telegram-bot/status
 *
 * 前端冻结、后端未装配（页面 fail-closed，不写入 webui 端点对账表）：
 * - GET/PUT /api/manage/telegram-bot/config
 * - GET/PUT /api/manage/rewards/config
 */

/** 合集可见性（后端 domain `Active` / `Hidden` 透传）。 */
export type CollectionVisibility = 'Active' | 'Hidden';

/** 合集来源形态（后端 domain `manual` / `douban_doulist` / `preset` 透传）。 */
export type CollectionSourceKind = 'manual' | 'douban_doulist' | 'preset';

/** 合集成员媒体类型（后端 domain `Movie` / `Series` / `Unknown` 透传）。 */
export type CollectionMemberMediaKind = 'Movie' | 'Series' | 'Unknown';

export interface ManagedCollectionRecord {
  id: string;
  title: string;
  overview: string | null;
  posterUrl: string | null;
  sourceKind: CollectionSourceKind;
  visibility: CollectionVisibility;
  createdAt: number;
  updatedAt: number;
}

export interface ManagedCollectionMemberRecord {
  id: string;
  collectionId: string;
  titleSnapshot: string;
  yearSnapshot: number | null;
  mediaKind: CollectionMemberMediaKind;
  posterUrlSnapshot: string | null;
  isEnabled: boolean;
  releaseOrder: number | null;
  watchOrder: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ManagedCollectionDetailRecord {
  collection: ManagedCollectionRecord;
  members: ManagedCollectionMemberRecord[];
}

export interface ManagedCollectionWriteInput {
  title: string;
  overview?: string;
  posterUrl?: string;
  visibility: CollectionVisibility;
}

export interface RewardsPointAccountRecord {
  userId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  version: number;
  updatedAt: number;
}

export interface RewardsAccountSummaryRecord {
  userId: string;
  /** null = 该用户从未产生积分记录（诚实呈现，不伪造零余额账户）。 */
  account: RewardsPointAccountRecord | null;
  totalCheckinDays: number;
}

export interface RewardsLedgerEntryRecord {
  id: string;
  userId: string;
  delta: number;
  balanceAfter: number;
  transactionType: string;
  sourceType: string;
  sourceId: string;
  ruleVersion: number | null;
  detailJson: string;
  createdAt: number;
}

export interface TelegramBotStatusRecord {
  /** `ready` / `not_configured`。 */
  health: string;
  enabled: boolean;
  configured: boolean;
  /** v2 恒 `long_polling`。 */
  mode: string;
  allowedChatCount: number;
  customApiBase: boolean;
  generatedAt: number;
}

/**
 * Telegram Bot 配置（P6-04 前端冻结；后端写端口未装配）。
 *
 * Bot Token 属于密钥链（`providers.telegram.bot_token`），本 DTO 不含 token 明文。
 */
export interface TelegramBotConfigRecord {
  enabled: boolean;
  /** 自定义 Bot API 基址；null/空串 = 官方默认。不回显密钥。 */
  apiBase: string | null;
  /** 允许的 chat id 列表（写配置用；状态端点只报数量）。 */
  allowedChatIds: string[];
}

export interface TelegramBotConfigWriteInput {
  enabled: boolean;
  apiBase: string | null;
  allowedChatIds: string[];
}

/**
 * 签到/积分事件配置（P6-04 前端冻结；后端规则端口未装配）。
 *
 * 管理面既有账户/流水是只读；本对象是事件规则，不伪造运行时账户数据。
 */
export interface RewardsEventConfigRecord {
  checkinEnabled: boolean;
  /** 每日签到基础积分（>= 0）。 */
  dailyCheckinPoints: number;
  /** 连续签到奖励积分（>= 0）。 */
  streakBonusPoints: number;
  /** 连续签到统计上限天数（>= 0；0 = 不启用 streak）。 */
  maxStreakDays: number;
}

export interface RewardsEventConfigWriteInput {
  checkinEnabled: boolean;
  dailyCheckinPoints: number;
  streakBonusPoints: number;
  maxStreakDays: number;
}

/** 密钥来源层（三层链 env > secrets 文件 > 内置 > 未配置；P2-09 延伸）。 */
export type SecretSourceKind = 'env' | 'secrets_file' | 'builtin' | 'unset';

/** 单键状态（零明文：只有来源层与是否已配置，无值）。 */
export interface SecretStatusEntryRecord {
  /** 白名单键（TOML 路径形态，如 `providers.tmdb.api_key`）。 */
  key: string;
  source: SecretSourceKind;
  configured: boolean;
}

/** 密钥链状态总览。 */
export interface SecretsStatusRecord {
  entries: SecretStatusEntryRecord[];
  /** 覆盖写入目标文件路径（非敏感）。 */
  overridesFile: string;
  /** 微软双版本内置自建应用凭据形态（Global / China21Vianet）。 */
  microsoftEditions: string[];
}

/** 覆盖写入输入：`value = undefined` 表示删除该键覆盖（恢复下层回退）。 */
export interface SecretsOverrideWriteInput {
  overrides: Array<{ key: string; value: string | null }>;
}

/** 覆盖写入结果：`applied` 为写盘后的预测来源层（重启后生效）。 */
export interface SecretsOverrideResultRecord {
  ok: boolean;
  applied: SecretStatusEntryRecord[];
  restartRequired: boolean;
}

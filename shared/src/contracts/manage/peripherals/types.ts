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
 * - POST   /api/manage/collections/{id}/members/remove  （按 item_id 移除，B2 补）
 * - POST   /api/manage/collections/{id}/members/reorder  （按 member_ids 重排，B2 补）
 * - PUT    /api/manage/collections/order  （合集列表排序，B3 补）
 * - POST   /api/manage/collections/rules/preview  （规则预览，B3 补）
 * - PATCH  /api/manage/collections/{id}/rules  （规则编辑，B3 补）
 * - POST   /api/manage/collections/{id}/sync  （手动同步，B3 补）
 * - GET    /api/manage/collections/presets  （预设模板，B3 补）
 * - POST   /api/manage/collections/presets/create  （从预设建合集，B3 补）
 * - PATCH  /api/manage/collections/{id}/members/{member_id}  （成员启停，B3 补）
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

/** 合集类型（后端 domain `manual` / `rule` 透传；规则合集才支持编辑规则/手动同步）。 */
export type CollectionCollectionKind = 'manual' | 'rule' | string;

/** 合集成员媒体类型（后端 domain `Movie` / `Series` / `Unknown` 透传）。 */
export type CollectionMemberMediaKind = 'Movie' | 'Series' | 'Unknown';

export interface ManagedCollectionRecord {
  id: string;
  title: string;
  overview: string | null;
  posterUrl: string | null;
  sourceKind: CollectionSourceKind;
  /** 合集类型：`rule` = 规则合集（支持编辑规则/手动同步）。GET 可能不返回 → 可选。 */
  collectionKind: CollectionCollectionKind;
  /** 规则合集自动扩员开关（仅 rule 合集语义有效）。 */
  autoExpandEnabled: boolean;
  /** 规则合集生效门槛（最少命中成员数）。 */
  minEffectiveMembers: number | null;
  /** 封面生成模式：auto_collage / 等（V1 同）。 */
  artworkMode: string | null;
  visibility: CollectionVisibility;
  createdAt: number;
  updatedAt: number;
}

export interface ManagedCollectionMemberRecord {
  id: string;
  collectionId: string;
  /** 绑定条目 id（后端 `bound_item_id`）。POST /members/remove 用 `item_id` 定位，必须透传不可丢失（B1 mapper 曾漏映射，本卡补回）。 */
  boundItemId: string | null;
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
  /** 规则合集的规则列表（manual 合集为空数组；B1 mapper 曾漏映射，本卡补回）。 */
  rules: ManagedCollectionRule[];
  /** 成员覆盖（如强制启用/隐藏某条目）。 */
  memberOverrides: ManagedCollectionMemberOverride[];
}

/** 规则合集单条规则（GET /{id}/rules 与 PATCH 同形态）。 */
export interface ManagedCollectionRule {
  id: string;
  ruleType: string;
  isExclusion: boolean;
  values: string[];
}

/** 成员覆盖（PATCH /{id}/rules 回传）。 */
export interface ManagedCollectionMemberOverride {
  mediaItemId: string;
  overrideKind: string;
}

/** 规则预览（POST /rules/preview，纯计算不落库）。 */
export interface ManagedCollectionRulePreview {
  matchCount: number;
  visible: boolean;
  sampleItems: ManagedCollectionRulePreviewItem[];
  artworkItems: ManagedCollectionRulePreviewItem[];
}

/** 预览样本条目（≤12 命中 / ≤4 封面候选）。 */
export interface ManagedCollectionRulePreviewItem {
  id: string;
  title: string;
  year: number | null;
  mediaKind: string;
}

/** 预设模板（GET /presets，纯静态数据零 IO）。 */
export interface ManagedCollectionPresetRecord {
  key: string;
  title: string;
  overview: string | null;
  itemCount: number;
}

/** POST /presets/create 入参。 */
export interface ManagedCollectionPresetCreateInput {
  presetKey: string;
}

/** 规则类型（8 类条件，后端枚举 snake_case 透传）。 */
export type CollectionRuleType =
  | 'person'
  | 'genre'
  | 'studio'
  | 'year'
  | 'decade'
  | 'rating'
  | 'library'
  | 'media_type';

/** 单条规则入参（POST /rules/preview、PATCH /{id}/rules 共用）。 */
export interface ManagedCollectionRuleInput {
  ruleType: CollectionRuleType | string;
  isExclusion?: boolean;
  values: string[];
}

/** POST /rules/preview 入参。 */
export interface ManagedCollectionRulePreviewInput {
  minEffectiveMembers?: number;
  rules: ManagedCollectionRuleInput[];
}

/** PATCH /{id}/rules 入参（缺省字段保持现值；artwork_mode 回退 auto_collage）。 */
export interface ManagedCollectionRulesUpdateInput {
  autoExpandEnabled?: boolean;
  minEffectiveMembers?: number;
  artworkMode?: string;
  rules: ManagedCollectionRuleInput[];
}

/** PATCH /{id}/members/{member_id} 入参（快照字段不可改，仅这三项是可调的运行态）。 */
export interface ManagedCollectionMemberPatchInput {
  isEnabled?: boolean;
  releaseOrder?: number;
  watchOrder?: number;
}

/** PUT /collections/order 入参（整组覆写 sort_order；必须与当前全集精确相等）。 */
export interface ManagedCollectionReorderInput {
  collectionIds: string[];
}

/**
 * 合集成员候选（GET /api/manage/collections/member-candidates，响应为**裸数组**）。
 *
 * 契约口径（webui.md:469）：`overview` / `community_rating` / `poster_url`
 * 因 V2 无列 / 无评分源 / 无该图片路由而**恒 null**（不伪造、不回落占位图）。
 */
export interface ManagedCollectionMemberCandidate {
  itemId: string;
  libraryId: string;
  libraryName: string;
  title: string;
  originalTitle: string | null;
  mediaKind: CollectionMemberMediaKind | string;
  year: number | null;
  /** 恒 null（V2 无该列）——不伪造摘要。 */
  overview: string | null;
  /** 恒 null（V2 无评分源）——不回落 0 分。 */
  communityRating: number | null;
  /** 恒 null（V2 无该图片路由）——不回落占位图。 */
  posterUrl: string | null;
}

/** POST /api/manage/collections/{id}/members/add 入参。 */
export interface ManagedCollectionMemberAddInput {
  itemId: string;
}

/** POST /api/manage/collections/{id}/members/remove 入参（按条目移除，V1 同形态）。 */
export interface ManagedCollectionMemberRemoveInput {
  itemId: string;
}

/** POST /api/manage/collections/{id}/members/reorder 入参：顺序即目标 release_order 递增。 */
export interface ManagedCollectionMemberReorderInput {
  memberIds: string[];
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

import { httpClient } from "@fmby/v2-shared/api/client";
import type {
  CollectionVisibility,
  ManagedCollectionDetailRecord,
  ManagedCollectionMemberRecord,
  ManagedCollectionMemberCandidate,
  ManagedCollectionMemberAddInput,
  ManagedCollectionRecord,
  ManagedCollectionWriteInput,
  RewardsAccountSummaryRecord,
  RewardsEventConfigRecord,
  RewardsEventConfigWriteInput,
  RewardsLedgerEntryRecord,
  RewardsPointAccountRecord,
  SecretSourceKind,
  SecretStatusEntryRecord,
  SecretsOverrideResultRecord,
  SecretsOverrideWriteInput,
  SecretsStatusRecord,
  TelegramBotConfigRecord,
  TelegramBotConfigWriteInput,
  TelegramBotStatusRecord,
} from "./types";
import { isApiError } from "@fmby/v2-shared/errors";

interface RawManagedCollection {
  id: string;
  title: string;
  overview: string | null;
  poster_url: string | null;
  source_kind: string;
  visibility: string;
  created_at: number;
  updated_at: number;
}

interface RawManagedCollectionMember {
  id: string;
  collection_id: string;
  title_snapshot: string;
  year_snapshot: number | null;
  media_kind: string;
  poster_url_snapshot: string | null;
  is_enabled: boolean;
  release_order: number | null;
  watch_order: number | null;
  created_at: number;
  updated_at: number;
}

interface RawManagedCollectionDetail {
  collection: RawManagedCollection;
  members: RawManagedCollectionMember[];
}

interface RawMemberCandidate {
  item_id: string;
  library_id: string;
  library_name: string;
  title: string;
  original_title: string | null;
  media_kind: string;
  year: number | null;
  overview: string | null;
  community_rating: number | null;
  poster_url: string | null;
}

interface RawRewardsAccount {
  user_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  version: number;
  updated_at: number;
}

interface RawRewardsAccountSummary {
  user_id: string;
  account: RawRewardsAccount | null;
  total_checkin_days: number;
}

interface RawRewardsLedgerEntry {
  id: string;
  user_id: string;
  delta: number;
  balance_after: number;
  transaction_type: string;
  source_type: string;
  source_id: string;
  rule_version: number | null;
  detail_json: string;
  created_at: number;
}

interface RawTelegramBotStatus {
  health: string;
  enabled: boolean;
  configured: boolean;
  mode: string;
  allowed_chat_count: number;
  custom_api_base: boolean;
  generated_at: number;
}

interface RawTelegramBotConfig {
  enabled: boolean;
  api_base: string | null;
  allowed_chat_ids: string[];
}

interface RawRewardsEventConfig {
  checkin_enabled: boolean;
  daily_checkin_points: number;
  streak_bonus_points: number;
  max_streak_days: number;
}

/**
 * 后端未装配 / 能力未实现时的 fail-closed 判定。
 *
 * 已落地端点未注入端口返回 500 `internal`；G6-F8 未实现能力返回 501
 * `not_implemented`；契约先行端点不存在则 404 `not_found` / `HTTP_404`。
 * 调用方不得把这些状态当成空配置并伪造成功数据。
 */
export function isBackendUnavailableError(error: unknown): boolean {
  if (!isApiError(error)) {
    return false;
  }
  if (
    error.code === "not_found" ||
    error.code === "NOT_FOUND" ||
    error.code === "HTTP_404" ||
    error.code === "not_implemented" ||
    error.code === "NOT_IMPLEMENTED" ||
    error.code === "HTTP_501" ||
    error.code === "internal" ||
    error.code === "HTTP_500"
  ) {
    return true;
  }
  const status = (error as { status?: unknown }).status;
  return status === 404 || status === 501 || status === 500;
}

/** 已落地端口未注入（500 internal）或能力未实现（501）。不含业务 404。 */
export function isServiceUnwiredError(error: unknown): boolean {
  if (!isApiError(error)) {
    return false;
  }
  if (
    error.code === "not_implemented" ||
    error.code === "NOT_IMPLEMENTED" ||
    error.code === "HTTP_501" ||
    error.code === "internal" ||
    error.code === "HTTP_500"
  ) {
    return true;
  }
  const status = (error as { status?: unknown }).status;
  return status === 501 || status === 500;
}

interface RawSecretStatusEntry {
  key: string;
  source: string;
  configured: boolean;
}

interface RawSecretsStatus {
  entries: RawSecretStatusEntry[];
  overrides_file: string;
  microsoft_editions: string[];
}

interface RawSecretsOverrideResponse {
  ok: boolean;
  applied: RawSecretStatusEntry[];
  restart_required: boolean;
}

function fromSecretEntry(r: RawSecretStatusEntry): SecretStatusEntryRecord {
  return {
    key: r.key,
    source: r.source as SecretSourceKind,
    configured: r.configured,
  };
}

function fromCollection(r: RawManagedCollection): ManagedCollectionRecord {
  return {
    id: r.id,
    title: r.title,
    overview: r.overview,
    posterUrl: r.poster_url,
    sourceKind: r.source_kind as ManagedCollectionRecord["sourceKind"],
    visibility: r.visibility as CollectionVisibility,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function fromMember(r: RawManagedCollectionMember): ManagedCollectionMemberRecord {
  return {
    id: r.id,
    collectionId: r.collection_id,
    titleSnapshot: r.title_snapshot,
    yearSnapshot: r.year_snapshot,
    mediaKind: r.media_kind as ManagedCollectionMemberRecord["mediaKind"],
    posterUrlSnapshot: r.poster_url_snapshot,
    isEnabled: r.is_enabled,
    releaseOrder: r.release_order,
    watchOrder: r.watch_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function fromMemberCandidate(r: RawMemberCandidate): ManagedCollectionMemberCandidate {
  return {
    itemId: r.item_id,
    libraryId: r.library_id,
    libraryName: r.library_name,
    title: r.title,
    originalTitle: r.original_title,
    mediaKind: r.media_kind,
    year: r.year,
    // 恒 null 三字段：原样透传，不伪造（契约登记 V2 无源）
    overview: r.overview,
    communityRating: r.community_rating,
    posterUrl: r.poster_url,
  };
}

function fromAccount(r: RawRewardsAccount): RewardsPointAccountRecord {
  return {
    userId: r.user_id,
    balance: r.balance,
    lifetimeEarned: r.lifetime_earned,
    lifetimeSpent: r.lifetime_spent,
    version: r.version,
    updatedAt: r.updated_at,
  };
}

function fromTelegramConfig(r: RawTelegramBotConfig): TelegramBotConfigRecord {
  return {
    enabled: r.enabled,
    apiBase: r.api_base,
    allowedChatIds: Array.isArray(r.allowed_chat_ids) ? r.allowed_chat_ids : [],
  };
}

function fromRewardsConfig(r: RawRewardsEventConfig): RewardsEventConfigRecord {
  return {
    checkinEnabled: r.checkin_enabled,
    dailyCheckinPoints: r.daily_checkin_points,
    streakBonusPoints: r.streak_bonus_points,
    maxStreakDays: r.max_streak_days,
  };
}

/**
 * 周边管理面 API（P6-04）。
 *
 * 已落地端点：collections CRUD / rewards 账户流水 / telegram-bot 状态。
 * 前端冻结写端口：telegram-bot/config、rewards/config。
 * 错误语义 fail-closed：后端 400/404/500/501 由 httpClient 统一抛错，前端不吞、不伪造。
 */
export const peripheralsApi = {
  async listCollections(): Promise<ManagedCollectionRecord[]> {
    const raw = await httpClient.get<RawManagedCollection[]>("/api/manage/collections");
    return raw.map(fromCollection);
  },

  async getCollection(id: string): Promise<ManagedCollectionDetailRecord> {
    const raw = await httpClient.get<RawManagedCollectionDetail>(
      `/api/manage/collections/${encodeURIComponent(id)}`,
    );
    return { collection: fromCollection(raw.collection), members: raw.members.map(fromMember) };
  },

  async createCollection(
    input: ManagedCollectionWriteInput,
  ): Promise<ManagedCollectionRecord> {
    const raw = await httpClient.post<RawManagedCollection>("/api/manage/collections", {
      body: {
        title: input.title,
        overview: input.overview ?? null,
        poster_url: input.posterUrl ?? null,
        visibility: input.visibility,
      },
    });
    return fromCollection(raw);
  },

  async updateCollection(
    id: string,
    input: ManagedCollectionWriteInput,
  ): Promise<ManagedCollectionRecord> {
    const raw = await httpClient.patch<RawManagedCollection>(
      `/api/manage/collections/${encodeURIComponent(id)}`,
      {
        body: {
          title: input.title,
          overview: input.overview ?? null,
          poster_url: input.posterUrl ?? null,
          visibility: input.visibility,
        },
      },
    );
    return fromCollection(raw);
  },

  async deleteCollection(id: string): Promise<void> {
    await httpClient.delete<{ ok: boolean }>(
      `/api/manage/collections/${encodeURIComponent(id)}`,
    );
  },

  /**
   * GET /api/manage/collections/member-candidates —— 成员候选查询。
   *
   * 契约（webui.md:469）：`keyword` **必填**，去空白后 ≥2 字符，否则后端 400；
   * 响应为**裸数组**，上限 30 条。前端**不**在 keyword 不足 2 字符时发请求
   * （省一次注定 400 的往返），但服务端校验仍以 400 为准。
   */
  async listCollectionMemberCandidates(
    keyword: string,
  ): Promise<ManagedCollectionMemberCandidate[]> {
    const raw = await httpClient.get<RawMemberCandidate[]>(
      '/api/manage/collections/member-candidates',
      { params: { keyword } },
    );
    return raw.map(fromMemberCandidate);
  },

  /**
   * POST /api/manage/collections/{id}/members/add —— 加入成员。
   * body 仅 `{item_id}`（后端取条目快照写入绑定）；返回更新后的详情。
   */
  async addCollectionMember(
    collectionId: string,
    input: ManagedCollectionMemberAddInput,
  ): Promise<ManagedCollectionDetailRecord> {
    const raw = await httpClient.post<RawManagedCollectionDetail>(
      `/api/manage/collections/${encodeURIComponent(collectionId)}/members/add`,
      { body: { item_id: input.itemId } },
    );
    return { collection: fromCollection(raw.collection), members: raw.members.map(fromMember) };
  },

  async deleteCollectionMember(collectionId: string, memberId: string): Promise<void> {
    await httpClient.delete<{ ok: boolean }>(
      `/api/manage/collections/${encodeURIComponent(collectionId)}/members/${encodeURIComponent(memberId)}`,
    );
  },

  async getRewardsAccountSummary(userId: string): Promise<RewardsAccountSummaryRecord> {
    const raw = await httpClient.get<RawRewardsAccountSummary>(
      `/api/manage/rewards/accounts/${encodeURIComponent(userId)}`,
    );
    return {
      userId: raw.user_id,
      account: raw.account ? fromAccount(raw.account) : null,
      totalCheckinDays: raw.total_checkin_days,
    };
  },

  async getRewardsLedger(userId: string, limit: number): Promise<RewardsLedgerEntryRecord[]> {
    const raw = await httpClient.get<RawRewardsLedgerEntry[]>(
      `/api/manage/rewards/accounts/${encodeURIComponent(userId)}/ledger`,
      { params: { limit } },
    );
    return raw.map((r) => ({
      id: r.id,
      userId: r.user_id,
      delta: r.delta,
      balanceAfter: r.balance_after,
      transactionType: r.transaction_type,
      sourceType: r.source_type,
      sourceId: r.source_id,
      ruleVersion: r.rule_version,
      detailJson: r.detail_json,
      createdAt: r.created_at,
    }));
  },

  async getTelegramBotStatus(): Promise<TelegramBotStatusRecord> {
    const raw = await httpClient.get<RawTelegramBotStatus>("/api/manage/telegram-bot/status");
    return {
      health: raw.health,
      enabled: raw.enabled,
      configured: raw.configured,
      mode: raw.mode,
      allowedChatCount: raw.allowed_chat_count,
      customApiBase: raw.custom_api_base,
      generatedAt: raw.generated_at,
    };
  },

  /**
   * Telegram Bot 配置读写（前端冻结）。后端未装配时 httpClient 抛错，
   * 页面用 isBackendUnavailableError 走 fail-closed，不伪造默认配置。
   */
  async getTelegramBotConfig(): Promise<TelegramBotConfigRecord> {
    const raw = await httpClient.get<RawTelegramBotConfig>("/api/manage/telegram-bot/config");
    return fromTelegramConfig(raw);
  },

  async putTelegramBotConfig(
    input: TelegramBotConfigWriteInput,
  ): Promise<TelegramBotConfigRecord> {
    const raw = await httpClient.put<RawTelegramBotConfig>("/api/manage/telegram-bot/config", {
      body: {
        enabled: input.enabled,
        api_base: input.apiBase,
        allowed_chat_ids: input.allowedChatIds,
      },
    });
    return fromTelegramConfig(raw);
  },

  async getRewardsEventConfig(): Promise<RewardsEventConfigRecord> {
    const raw = await httpClient.get<RawRewardsEventConfig>("/api/manage/rewards/config");
    return fromRewardsConfig(raw);
  },

  async putRewardsEventConfig(
    input: RewardsEventConfigWriteInput,
  ): Promise<RewardsEventConfigRecord> {
    const raw = await httpClient.put<RawRewardsEventConfig>("/api/manage/rewards/config", {
      body: {
        checkin_enabled: input.checkinEnabled,
        daily_checkin_points: input.dailyCheckinPoints,
        streak_bonus_points: input.streakBonusPoints,
        max_streak_days: input.maxStreakDays,
      },
    });
    return fromRewardsConfig(raw);
  },

  /** P2-09 延伸：密钥链状态（零明文——各键当前生效来源层）。 */
  async getSecretsStatus(): Promise<SecretsStatusRecord> {
    const raw = await httpClient.get<RawSecretsStatus>("/api/manage/secrets/status");
    return {
      entries: raw.entries.map(fromSecretEntry),
      overridesFile: raw.overrides_file,
      microsoftEditions: raw.microsoft_editions,
    };
  },

  /** P2-09 延伸：覆盖写盘（confirmed 由端点 query 强制；进程重启后生效）。 */
  async applySecretsOverrides(input: SecretsOverrideWriteInput): Promise<SecretsOverrideResultRecord> {
    const overrides: Record<string, string | null> = {};
    for (const item of input.overrides) {
      overrides[item.key] = item.value;
    }
    const raw = await httpClient.put<RawSecretsOverrideResponse>(
      "/api/manage/secrets/overrides",
      {
        params: { confirmed: true },
        body: { overrides },
      },
    );
    return {
      ok: raw.ok,
      applied: raw.applied.map(fromSecretEntry),
      restartRequired: raw.restart_required,
    };
  },
};

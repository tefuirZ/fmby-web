import { httpClient } from "@fmby/v2-shared/api/client";
import type {
  CollectionVisibility,
  ManagedCollectionDetailRecord,
  ManagedCollectionMemberRecord,
  ManagedCollectionMemberCandidate,
  ManagedCollectionMemberAddInput,
  ManagedCollectionMemberRemoveInput,
  ManagedCollectionMemberReorderInput,
  ManagedCollectionPresetRecord,
  ManagedCollectionPresetCreateInput,
  ManagedCollectionRule,
  ManagedCollectionRulePreview,
  ManagedCollectionRulePreviewInput,
  ManagedCollectionRuleInput,
  ManagedCollectionRulesUpdateInput,
  ManagedCollectionMemberOverride,
  ManagedCollectionRulePreviewItem,
  ManagedCollectionMemberPatchInput,
  ManagedCollectionReorderInput,
  ManagedCollectionRecord,
  ManagedCollectionWriteInput,
  RewardsAccountSummaryRecord,
  RewardsEventConfigRecord,
  RewardsEventConfigWriteInput,
  RewardsLedgerEntryRecord,
  RewardsRuleConfigRecord,
  RewardsRedemptionRateRecord,
  RewardsRuleVersionRecord,
  RewardsAdminStatsRecord,
  RewardsAdjustPointsInput,
  RewardsAdjustResultRecord,
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
  collection_kind: string;
  auto_expand_enabled: boolean;
  min_effective_members: number | null;
  artwork_mode: string | null;
  visibility: string;
  created_at: number;
  updated_at: number;
}

interface RawManagedCollectionRule {
  id: string;
  rule_type: string;
  is_exclusion: boolean;
  values: string[];
}

interface RawManagedCollectionMemberOverride {
  media_item_id: string;
  override_kind: string;
}

interface RawManagedCollectionPreset {
  key: string;
  title: string;
  overview: string | null;
  item_count: number;
}

interface RawManagedCollectionRulePreviewItem {
  id: string;
  title: string;
  year: number | null;
  media_kind: string;
}

interface RawManagedCollectionRulePreview {
  match_count: number;
  visible: boolean;
  sample_items: RawManagedCollectionRulePreviewItem[];
  artwork_items: RawManagedCollectionRulePreviewItem[];
}

interface RawManagedCollectionMember {
  id: string;
  collection_id: string;
  bound_item_id: string | null;
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
  rules: RawManagedCollectionRule[];
  member_overrides: RawManagedCollectionMemberOverride[];
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

interface RawRewardsRedemptionRate {
  enabled: boolean;
  points_per_unit: number;
  min_quantity: number;
  max_quantity: number;
  daily_limit: number | null;
  monthly_limit: number | null;
}

interface RawRewardsCheckinTier {
  start_day: number;
  end_day: number | null;
  points: number;
}

interface RawRewardsWatchTask {
  enabled: boolean;
  required_minutes: number;
}

interface RawRewardsRuleConfig {
  checkin_enabled: boolean;
  reward_mode: string;
  tiers: RawRewardsCheckinTier[];
  random_min_points: number;
  random_max_points: number;
  watch_task: RawRewardsWatchTask;
  allow_expired_checkin: boolean;
  server_days: RawRewardsRedemptionRate;
  media_request_credits: RawRewardsRedemptionRate;
  media_request_cost: number;
}

interface RawRewardsRuleVersion {
  id: string;
  version: number;
  status: string;
  created_by: string;
  created_at: number;
  published_at: number;
  config: RawRewardsRuleConfig;
}

interface RawRewardsAdminStats {
  points_outstanding: number;
  checkins_today: number;
  pending_checkins: number;
  redemptions_today: number;
  pending_media_requests: number | null;
  processing_media_requests: number | null;
}

interface RawAdjustPointsRequest {
  user_id: string;
  idempotency_key: string;
  delta: number;
  reason: string;
}

interface RawRewardsAdjustResult {
  user_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  applied: boolean;
}

function fromRewardsRuleConfig(r: RawRewardsRuleConfig): RewardsRuleConfigRecord {
  return {
    checkinEnabled: r.checkin_enabled,
    rewardMode: r.reward_mode,
    tiers: (r.tiers ?? []).map((tier) => ({
      startDay: tier.start_day,
      endDay: tier.end_day,
      points: tier.points,
    })),
    randomMinPoints: r.random_min_points,
    randomMaxPoints: r.random_max_points,
    watchTask: {
      enabled: r.watch_task.enabled,
      requiredMinutes: r.watch_task.required_minutes,
    },
    allowExpiredCheckin: r.allow_expired_checkin,
    serverDays: fromRedemptionRate(r.server_days),
    mediaRequestCredits: fromRedemptionRate(r.media_request_credits),
    mediaRequestCost: r.media_request_cost,
  };
}

function fromRedemptionRate(r: RawRewardsRedemptionRate): RewardsRedemptionRateRecord {
  return {
    enabled: r.enabled,
    pointsPerUnit: r.points_per_unit,
    minQuantity: r.min_quantity,
    maxQuantity: r.max_quantity,
    dailyLimit: r.daily_limit,
    monthlyLimit: r.monthly_limit,
  };
}

function toRawRuleConfig(input: RewardsRuleConfigRecord): RawRewardsRuleConfig {
  return {
    checkin_enabled: input.checkinEnabled,
    reward_mode: input.rewardMode,
    tiers: (input.tiers ?? []).map((tier) => ({
      start_day: tier.startDay,
      end_day: tier.endDay,
      points: tier.points,
    })),
    random_min_points: input.randomMinPoints,
    random_max_points: input.randomMaxPoints,
    watch_task: {
      enabled: input.watchTask.enabled,
      required_minutes: input.watchTask.requiredMinutes,
    },
    allow_expired_checkin: input.allowExpiredCheckin,
    server_days: toRawRedemptionRate(input.serverDays),
    media_request_credits: toRawRedemptionRate(input.mediaRequestCredits),
    media_request_cost: input.mediaRequestCost,
  };
}

function toRawRedemptionRate(r: RewardsRedemptionRateRecord): RawRewardsRedemptionRate {
  return {
    enabled: r.enabled,
    points_per_unit: r.pointsPerUnit,
    min_quantity: r.minQuantity,
    max_quantity: r.maxQuantity,
    daily_limit: r.dailyLimit,
    monthly_limit: r.monthlyLimit,
  };
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
    collectionKind: r.collection_kind,
    autoExpandEnabled: r.auto_expand_enabled,
    minEffectiveMembers: r.min_effective_members,
    artworkMode: r.artwork_mode,
    visibility: r.visibility as CollectionVisibility,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function fromRule(r: RawManagedCollectionRule): ManagedCollectionRule {
  return { id: r.id, ruleType: r.rule_type, isExclusion: r.is_exclusion, values: r.values };
}

interface RawCollectionRuleInput {
  rule_type: string;
  is_exclusion: boolean;
  values: string[];
}
function toRawRule(r: ManagedCollectionRuleInput): RawCollectionRuleInput {
  return { rule_type: r.ruleType, is_exclusion: r.isExclusion ?? false, values: r.values };
}

function fromMemberOverride(
  r: RawManagedCollectionMemberOverride,
): ManagedCollectionMemberOverride {
  return { mediaItemId: r.media_item_id, overrideKind: r.override_kind };
}

function fromPreviewItem(r: RawManagedCollectionRulePreviewItem): ManagedCollectionRulePreviewItem {
  return { id: r.id, title: r.title, year: r.year, mediaKind: r.media_kind };
}

function fromDetail(r: RawManagedCollectionDetail): ManagedCollectionDetailRecord {
  return {
    collection: fromCollection(r.collection),
    members: r.members.map(fromMember),
    rules: (r.rules ?? []).map(fromRule),
    memberOverrides: (r.member_overrides ?? []).map(fromMemberOverride),
  };
}

function fromMember(r: RawManagedCollectionMember): ManagedCollectionMemberRecord {
  return {
    id: r.id,
    collectionId: r.collection_id,
    boundItemId: r.bound_item_id,
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
    return fromDetail(raw);
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
    return fromDetail(raw);
  },

  async deleteCollectionMember(collectionId: string, memberId: string): Promise<void> {
    await httpClient.delete<{ ok: boolean }>(
      `/api/manage/collections/${encodeURIComponent(collectionId)}/members/${encodeURIComponent(memberId)}`,
    );
  },

  /**
   * POST /api/manage/collections/{id}/members/remove —— 按条目移除成员（V1 同形态）。
   * body 仅 `{item_id}`（取后端返回的 `bound_item_id`）；返回更新后的详情。
   */
  async removeCollectionMember(
    collectionId: string,
    input: ManagedCollectionMemberRemoveInput,
  ): Promise<ManagedCollectionDetailRecord> {
    const raw = await httpClient.post<RawManagedCollectionDetail>(
      `/api/manage/collections/${encodeURIComponent(collectionId)}/members/remove`,
      { body: { item_id: input.itemId } },
    );
    return fromDetail(raw);
  },

  /**
   * POST /api/manage/collections/{id}/members/reorder —— 成员排序。
   * body `{member_ids}` 顺序即目标 release_order 递增；返回 `{ok}`。
   */
  async reorderCollectionMembers(
    collectionId: string,
    input: ManagedCollectionMemberReorderInput,
  ): Promise<{ ok: boolean }> {
    return httpClient.post<{ ok: boolean }>(
      `/api/manage/collections/${encodeURIComponent(collectionId)}/members/reorder`,
      { body: { member_ids: input.memberIds } },
    );
  },

  /** PUT /api/manage/collections/order —— 合集列表整体排序（整组覆写 sort_order）。 */
  async reorderCollections(input: ManagedCollectionReorderInput): Promise<ManagedCollectionRecord[]> {
    const raw = await httpClient.put<RawManagedCollection[]>(
      '/api/manage/collections/order',
      { body: { collection_ids: input.collectionIds } },
    );
    return raw.map(fromCollection);
  },

  /** GET /api/manage/collections/presets —— 预设模板列表（纯静态数据，零 IO）。 */
  async listCollectionPresets(): Promise<ManagedCollectionPresetRecord[]> {
    const raw = await httpClient.get<RawManagedCollectionPreset[]>('/api/manage/collections/presets');
    return raw.map((r) => ({
      key: r.key,
      title: r.title,
      overview: r.overview,
      itemCount: r.item_count,
    }));
  },

  /** POST /api/manage/collections/presets/create —— 从预设模板建合集。 */
  async createCollectionFromPreset(
    input: ManagedCollectionPresetCreateInput,
  ): Promise<ManagedCollectionDetailRecord> {
    const raw = await httpClient.post<RawManagedCollectionDetail>(
      '/api/manage/collections/presets/create',
      { body: { preset_key: input.presetKey } },
    );
    return fromDetail(raw);
  },

  /** POST /api/manage/collections/rules/preview —— 规则预览（纯计算不落库）。 */
  async previewCollectionRules(
    input: ManagedCollectionRulePreviewInput,
  ): Promise<ManagedCollectionRulePreview> {
    const raw = await httpClient.post<RawManagedCollectionRulePreview>(
      '/api/manage/collections/rules/preview',
      { body: { min_effective_members: input.minEffectiveMembers, rules: input.rules.map(toRawRule) } },
    );
    return {
      matchCount: raw.match_count,
      visible: raw.visible,
      sampleItems: raw.sample_items.map(fromPreviewItem),
      artworkItems: raw.artwork_items.map(fromPreviewItem),
    };
  },

  /** PATCH /api/manage/collections/{id}/rules —— 编辑规则合集规则（单事务覆盖替换）。 */
  async updateCollectionRules(
    collectionId: string,
    input: ManagedCollectionRulesUpdateInput,
  ): Promise<ManagedCollectionDetailRecord> {
    const raw = await httpClient.patch<RawManagedCollectionDetail>(
      `/api/manage/collections/${encodeURIComponent(collectionId)}/rules`,
      {
        body: {
          auto_expand_enabled: input.autoExpandEnabled,
          min_effective_members: input.minEffectiveMembers,
          artwork_mode: input.artworkMode,
          rules: input.rules.map(toRawRule),
        },
      },
    );
    return fromDetail(raw);
  },

  /** POST /api/manage/collections/{id}/sync —— 规则合集手动同步（仅 rule 合集支持）。 */
  async syncCollection(collectionId: string): Promise<ManagedCollectionDetailRecord> {
    const raw = await httpClient.post<RawManagedCollectionDetail>(
      `/api/manage/collections/${encodeURIComponent(collectionId)}/sync`,
    );
    return fromDetail(raw);
  },

  /** PATCH /api/manage/collections/{id}/members/{member_id} —— 成员运行态（启用/停用/双序）。 */
  async patchCollectionMember(
    collectionId: string,
    memberId: string,
    input: ManagedCollectionMemberPatchInput,
  ): Promise<void> {
    await httpClient.patch<{ ok: boolean }>(
      `/api/manage/collections/${encodeURIComponent(collectionId)}/members/${encodeURIComponent(memberId)}`,
      {
        body: {
          is_enabled: input.isEnabled,
          release_order: input.releaseOrder,
          watch_order: input.watchOrder,
        },
      },
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

  /** GET /api/manage/rewards/rule — 当前生效规则（版本化）。 */
  async getRewardsRule(): Promise<RewardsRuleVersionRecord> {
    const raw = await httpClient.get<RawRewardsRuleVersion>('/api/manage/rewards/rule');
    return {
      id: raw.id,
      version: raw.version,
      status: raw.status,
      createdBy: raw.created_by,
      createdAt: raw.created_at,
      publishedAt: raw.published_at,
      config: fromRewardsRuleConfig(raw.config),
    };
  },

  /** POST /api/manage/rewards/rule — 发布新版本规则（同事务 retire 旧版）。 */
  async publishRewardsRule(config: RewardsRuleConfigRecord): Promise<RewardsRuleVersionRecord> {
    const raw = await httpClient.post<RawRewardsRuleVersion>(
      '/api/manage/rewards/rule',
      { body: toRawRuleConfig(config) },
    );
    return {
      id: raw.id,
      version: raw.version,
      status: raw.status,
      createdBy: raw.created_by,
      createdAt: raw.created_at,
      publishedAt: raw.published_at,
      config: fromRewardsRuleConfig(raw.config),
    };
  },

  /** GET /api/manage/rewards/stats — 积分/签到管理统计。 */
  async getRewardsAdminStats(): Promise<RewardsAdminStatsRecord> {
    const raw = await httpClient.get<RawRewardsAdminStats>('/api/manage/rewards/stats');
    return {
      pointsOutstanding: raw.points_outstanding,
      checkinsToday: raw.checkins_today,
      pendingCheckins: raw.pending_checkins,
      redemptionsToday: raw.redemptions_today,
      pendingMediaRequests: raw.pending_media_requests,
      processingMediaRequests: raw.processing_media_requests,
    };
  },

  /** POST /api/manage/rewards/points/adjust — 管理员积分调整（单事务写账户+流水）。 */
  async adjustRewardsPoints(input: RewardsAdjustPointsInput): Promise<RewardsAdjustResultRecord> {
    const raw = await httpClient.post<RawRewardsAdjustResult>(
      '/api/manage/rewards/points/adjust',
      {
        body: {
          user_id: input.userId,
          idempotency_key: input.idempotencyKey,
          delta: input.delta,
          reason: input.reason,
        } satisfies RawAdjustPointsRequest,
      },
    );
    return {
      userId: raw.user_id,
      balance: raw.balance,
      lifetimeEarned: raw.lifetime_earned,
      lifetimeSpent: raw.lifetime_spent,
      applied: raw.applied,
    };
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

import { httpClient } from "@fmby/v2-shared/api/client";
import type {
  CollectionVisibility,
  ManagedCollectionDetailRecord,
  ManagedCollectionMemberRecord,
  ManagedCollectionRecord,
  ManagedCollectionWriteInput,
  RewardsAccountSummaryRecord,
  RewardsLedgerEntryRecord,
  RewardsPointAccountRecord,
  TelegramBotStatusRecord,
} from "./types";

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

/**
 * 周边管理面 API（P6-04）。
 *
 * 三组端点分别对应 collections / rewards / telegram-bot 状态；错误语义
 * fail-closed：后端 400/404/500 由 httpClient 统一抛错，前端不吞。
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
};

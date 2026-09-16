import { httpClient } from "@fmby/v2-shared/api/client";
import { isApiError } from "@fmby/v2-shared/errors";
import type {
  MediaReviewListQuery,
  MediaReviewListResponse,
  MediaReviewProviderCandidate,
  MediaReviewProviderSearchQuery,
  MediaReviewProviderSearchResponse,
  MediaReviewRecord,
  MediaReviewResolveInput,
} from "./types";

interface RawMediaReview {
  id: string;
  mediaItemId: string;
  identifyTaskId: string | null;
  currentBindingId: string | null;
  reviewStage: string;
  reasonCode: string;
  status: string;
  priority: number;
  subjectSnapshotJson: string | null;
  candidatesJson: string | null;
  aiSuggestionJson: string | null;
  resolutionAction: string | null;
  resolutionPayloadJson: string | null;
  claimedByUserId: string | null;
  claimedAt: number | null;
  resolvedByUserId: string | null;
  resolvedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

interface RawMediaReviewList {
  items: RawMediaReview[];
  total: number;
  page: number;
  pageSize: number;
}

interface RawProviderCandidate {
  provider: string;
  entityType: string;
  providerItemId: string;
  title: string;
  originalTitle: string | null;
  year: number | null;
  overview: string | null;
  confidence: number | null;
  externalId: string | null;
}

interface RawProviderSearchResponse {
  provider: string;
  query: string;
  candidates: RawProviderCandidate[];
}

/** 后端端口未装配 / 能力未实现时的 fail-closed 判定（500/501/404）。 */
export function isMediaReviewsUnwiredError(error: unknown): boolean {
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

function fromReview(r: RawMediaReview): MediaReviewRecord {
  return {
    id: r.id,
    mediaItemId: r.mediaItemId,
    identifyTaskId: r.identifyTaskId,
    currentBindingId: r.currentBindingId,
    reviewStage: r.reviewStage as MediaReviewRecord["reviewStage"],
    reasonCode: r.reasonCode,
    status: r.status as MediaReviewRecord["status"],
    priority: r.priority,
    subjectSnapshotJson: r.subjectSnapshotJson,
    candidatesJson: r.candidatesJson,
    aiSuggestionJson: r.aiSuggestionJson,
    resolutionAction: r.resolutionAction,
    resolutionPayloadJson: r.resolutionPayloadJson,
    claimedByUserId: r.claimedByUserId,
    claimedAt: r.claimedAt,
    resolvedByUserId: r.resolvedByUserId,
    resolvedAt: r.resolvedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function fromCandidate(r: RawProviderCandidate): MediaReviewProviderCandidate {
  return {
    provider: r.provider,
    entityType: r.entityType,
    providerItemId: r.providerItemId,
    title: r.title,
    originalTitle: r.originalTitle,
    year: r.year,
    overview: r.overview,
    confidence: r.confidence,
    externalId: r.externalId,
  };
}

/**
 * 媒体审核工单 API（V1F-03a/b）。
 * 队列列表 / 详情 / 认领 / 释放 / 处理 + provider 候选搜索（人工匹配）。
 * 可见性治理动作（resolve action）需在 query 携带 `confirmed=true`。
 */
export const mediaReviewsApi = {
  async list(query: MediaReviewListQuery): Promise<MediaReviewListResponse> {
    const raw = await httpClient.get<RawMediaReviewList>("/api/manage/media-reviews", {
      params: {
        stage: query.stage || undefined,
        status: query.status || undefined,
        mediaItemId: query.mediaItemId || undefined,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
      },
    });
    return {
      items: raw.items.map(fromReview),
      total: raw.total,
      page: raw.page,
      pageSize: raw.pageSize,
    };
  },

  async get(id: string): Promise<MediaReviewRecord> {
    const raw = await httpClient.get<RawMediaReview>(
      `/api/manage/media-reviews/${encodeURIComponent(id)}`,
    );
    return fromReview(raw);
  },

  async claim(id: string): Promise<MediaReviewRecord> {
    const raw = await httpClient.post<{ item: RawMediaReview }>(
      `/api/manage/media-reviews/${encodeURIComponent(id)}/claim`,
    );
    return fromReview(raw.item);
  },

  async release(id: string): Promise<MediaReviewRecord> {
    const raw = await httpClient.post<{ item: RawMediaReview }>(
      `/api/manage/media-reviews/${encodeURIComponent(id)}/release`,
    );
    return fromReview(raw.item);
  },

  async resolve(id: string, input: MediaReviewResolveInput): Promise<MediaReviewRecord> {
    const isVisibility = isVisibilityAction(input.action);
    const raw = await httpClient.post<{ item: RawMediaReview }>(
      `/api/manage/media-reviews/${encodeURIComponent(id)}/resolve`,
      {
        params: isVisibility ? { confirmed: true } : undefined,
        body: {
          action: input.action,
          payload: input.payload ?? {},
        },
      },
    );
    return fromReview(raw.item);
  },

  async providerSearch(query: MediaReviewProviderSearchQuery): Promise<MediaReviewProviderSearchResponse> {
    const raw = await httpClient.get<RawProviderSearchResponse>(
      "/api/manage/media-reviews/provider-search",
      {
        params: {
          provider: query.provider,
          q: query.query,
          entityType: query.entityType || undefined,
          year: query.year ?? undefined,
        },
      },
    );
    return {
      provider: raw.provider,
      query: raw.query,
      candidates: raw.candidates.map(fromCandidate),
    };
  },
};

/** 可见性治理动作（V1F-03b）——命中则 resolve 请求需 confirmed 二次闸门。 */
export function isVisibilityAction(action: string): boolean {
  return (
    action === "ApproveVisibilityHide" ||
    action === "KeepVisible" ||
    action === "RetryIdentify" ||
    action === "RestoreVisibility"
  );
}

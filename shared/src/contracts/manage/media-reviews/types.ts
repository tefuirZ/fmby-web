/** 媒体审核工单的流转阶段（wire PascalCase，对齐后端 ReviewStage）。 */
export type MediaReviewStage =
  | "Identify"
  | "Scrape"
  | "VersionMerge"
  | "PolicyCheck"
  | "AiAssist"
  | "VisibilityGovernance";

/** 工单状态（wire PascalCase，对齐后端 ReviewStatus）。 */
export type MediaReviewStatus =
  | "Open"
  | "Claimed"
  | "Resolved"
  | "Ignored"
  | "Cancelled";

/** 工单详情 / 列表项（V1F-03a/b wire 契约，camelCase）。 */
export interface MediaReviewRecord {
  id: string;
  mediaItemId: string;
  identifyTaskId: string | null;
  currentBindingId: string | null;
  reviewStage: MediaReviewStage;
  reasonCode: string;
  status: MediaReviewStatus;
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

/** 审核工单队列列表响应。 */
export interface MediaReviewListResponse {
  items: MediaReviewRecord[];
  total: number;
  page: number;
  pageSize: number;
}

/** 列表查询参数。 */
export interface MediaReviewListQuery {
  stage?: string;
  status?: string;
  mediaItemId?: string;
  page?: number;
  pageSize?: number;
}

/** provider 候选命中（人工匹配面）。 */
export interface MediaReviewProviderCandidate {
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

/** provider 候选搜索响应。 */
export interface MediaReviewProviderSearchResponse {
  provider: string;
  query: string;
  candidates: MediaReviewProviderCandidate[];
}

/** provider 候选搜索参数。 */
export interface MediaReviewProviderSearchQuery {
  provider: string;
  query: string;
  entityType?: string;
  year?: number;
}

/** 工单处理动作（V1F-03b 可见性治理动作属危险操作，需 confirmed）。 */
export type MediaReviewResolveAction = string;

/** 处理请求体。 */
export interface MediaReviewResolveInput {
  action: MediaReviewResolveAction;
  payload?: unknown;
}

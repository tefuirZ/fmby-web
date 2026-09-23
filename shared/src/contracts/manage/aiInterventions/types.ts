/**
 * AI 干预会话面契约类型（FE-AI-INTERVENTIONS）。
 *
 * 后端真源（V2，**7** 条路由，卡面「6 条」有误）：
 * `crates/fmby-v2-http/src/routes/ai_interventions.rs`（threads / media/{id} /
 * session-open / session-message / session-close / media/{id}/apply / media/{id}/suggest）。
 *
 * 域类型 camelCase；wire 为 snake_case（threads/run/message），枚举 casing：
 * SkillKey = snake_case，RunKind / SessionState / MessageRole = PascalCase
 * （见 `crates/fmby-v2-domain/src/ai_intervention.rs:12-73`）。
 */

export type AiInterventionSkillKey =
  | 'naming_cleanup'
  | 'candidate_rerank'
  | 'scrape_repair'
  | 'conflict_explainer';

export type AiInterventionRunKind = 'AutoRun' | 'AdminSessionTurn' | 'AdminApply';
export type AiInterventionSessionState = 'Open' | 'Closed';
export type AiInterventionMessageRole = 'System' | 'User' | 'Assistant';

/** 会话线程（后端 `AiInterventionThread`）。 */
export interface AiInterventionThreadRecord {
  id: string;
  mediaItemId: string;
  latestRunId: string | null;
  latestAutoTaskId: string | null;
  latestSummaryJson: string;
  latestEvidenceJson: string;
  latestResultJson: string;
  latestDiffJson: string;
  latestSkillKey: AiInterventionSkillKey | null;
  latestProvider: string | null;
  latestModel: string | null;
  latestRunStatus: string | null;
  latestAppliedRunId: string | null;
  latestAppliedResultJson: string;
  sessionState: AiInterventionSessionState;
  currentSessionId: string | null;
  currentSessionSkillKey: AiInterventionSkillKey | null;
  sessionOpenedByUserId: string | null;
  /** epoch 毫秒。 */
  sessionOpenedAt: number | null;
  sessionLastActivityAt: number | null;
  archivedSessionSummaryJson: string;
  createdAt: number;
  updatedAt: number;
}

/** 会话轮次运行（后端 `AiInterventionRun`）。 */
export interface AiInterventionRunRecord {
  id: string;
  threadId: string;
  mediaItemId: string;
  sessionId: string | null;
  aiTaskId: string | null;
  runKind: AiInterventionRunKind;
  skillKey: AiInterventionSkillKey;
  provider: string | null;
  model: string | null;
  runStatus: string;
  turnIndex: number | null;
  summaryJson: string;
  evidenceSnapshotJson: string;
  resultSnapshotJson: string;
  diffSnapshotJson: string;
  errorCode: string | null;
  errorMessage: string | null;
  requestedByUserId: string | null;
  appliedByUserId: string | null;
  appliedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/** 会话消息（后端 `AiInterventionSessionMessage`）。 */
export interface AiInterventionMessageRecord {
  id: string;
  threadId: string;
  mediaItemId: string;
  sessionId: string;
  role: AiInterventionMessageRole;
  contentText: string | null;
  archivedSummaryText: string | null;
  evidenceSnapshotJson: string;
  skillResultRefJson: string;
  createdByUserId: string | null;
  archivedAt: number | null;
  createdAt: number;
}

/** 线程详情（后端 `ThreadDetail{thread,messages,runs}`）。 */
export interface AiInterventionThreadDetailRecord {
  thread: AiInterventionThreadRecord;
  messages: AiInterventionMessageRecord[];
  runs: AiInterventionRunRecord[];
}

/** 列表查询（后端 `ThreadListQuery`：仅 limit/offset）。 */
export interface AiInterventionListQuery {
  limit?: number;
  offset?: number;
}

/** 单次建议（A2，后端 `AiSuggestResponse`，camelCase wire）。 */
export interface AiInterventionSuggestExternalId {
  provider: string;
  kind: string;
  value: string;
}

export interface AiInterventionSuggestRecord {
  mediaItemId: string;
  suggestedTitle: string;
  suggestedYear: number | null;
  suggestedSeason: number | null;
  suggestedEpisode: number | null;
  externalId: AiInterventionSuggestExternalId | null;
  confidence: number;
  reasoning: string;
  wouldAutoBind: boolean;
}

/**
 * AI 干预会话面 API（FE-AI-INTERVENTIONS）。
 *
 * 端点（V2 真源，7 条；卡面「6 条」有误）：
 * - GET  /api/manage/ai-interventions/threads                          → **裸数组**
 * - GET  /api/manage/ai-interventions/media/{id}                       → ThreadDetail
 * - POST /api/manage/ai-interventions/media/{id}/session/open          → Thread
 * - POST /api/manage/ai-interventions/session/message                  → Message（body session_id）
 * - POST /api/manage/ai-interventions/session/close                    → Thread（body session_id）
 * - POST /api/manage/ai-interventions/media/{id}/apply                 → Thread（body session_id）
 * - POST /api/manage/ai-interventions/media/{id}/suggest               → Suggest（A2 只读）
 *
 * fail-closed：后端 400/403/404/500 由 httpClient 统一抛 ApiError，本层不吞。
 * ★注意 path 与 V1 不同：message/close 是 **session 级路径 + session_id body**。
 */

import { httpClient } from '@fmby/v2-shared/api/client';
import type {
  AiInterventionListQuery,
  AiInterventionMessageRecord,
  AiInterventionMessageRole,
  AiInterventionRunKind,
  AiInterventionRunRecord,
  AiInterventionSessionState,
  AiInterventionSkillKey,
  AiInterventionSuggestRecord,
  AiInterventionThreadDetailRecord,
  AiInterventionThreadRecord,
} from './types';

const BASE = '/api/manage/ai-interventions';

// ─── Raw（后端 serde snake_case；枚举值见各字段注释） ────────────────────────────

interface RawThread {
  id: string;
  media_item_id: string;
  latest_run_id: string | null;
  latest_auto_task_id: string | null;
  latest_summary_json: string;
  latest_evidence_json: string;
  latest_result_json: string;
  latest_diff_json: string;
  latest_skill_key: string | null;
  latest_provider: string | null;
  latest_model: string | null;
  latest_run_status: string | null;
  latest_applied_run_id: string | null;
  latest_applied_result_json: string;
  session_state: string;
  current_session_id: string | null;
  current_session_skill_key: string | null;
  session_opened_by_user_id: string | null;
  session_opened_at: number | null;
  session_last_activity_at: number | null;
  archived_session_summary_json: string;
  created_at: number;
  updated_at: number;
}

interface RawRun {
  id: string;
  thread_id: string;
  media_item_id: string;
  session_id: string | null;
  ai_task_id: string | null;
  run_kind: string;
  skill_key: string;
  provider: string | null;
  model: string | null;
  run_status: string;
  turn_index: number | null;
  summary_json: string;
  evidence_snapshot_json: string;
  result_snapshot_json: string;
  diff_snapshot_json: string;
  error_code: string | null;
  error_message: string | null;
  requested_by_user_id: string | null;
  applied_by_user_id: string | null;
  applied_at: number | null;
  created_at: number;
  updated_at: number;
}

interface RawMessage {
  id: string;
  thread_id: string;
  media_item_id: string;
  session_id: string;
  role: string;
  content_text: string | null;
  archived_summary_text: string | null;
  evidence_snapshot_json: string;
  skill_result_ref_json: string;
  created_by_user_id: string | null;
  archived_at: number | null;
  created_at: number;
}

interface RawThreadDetail {
  thread: RawThread;
  messages: RawMessage[];
  runs: RawRun[];
}

interface RawSuggest {
  mediaItemId: string;
  suggestedTitle: string;
  suggestedYear: number | null;
  suggestedSeason: number | null;
  suggestedEpisode: number | null;
  externalId: { provider: string; kind: string; value: string } | null;
  confidence: number;
  reasoning: string;
  wouldAutoBind: boolean;
}

// ─── 枚举解析（值域 fail-closed：未知值抛错不吞） ───────────────────────────────

const SKILL_KEYS = new Set<AiInterventionSkillKey>([
  'naming_cleanup',
  'candidate_rerank',
  'scrape_repair',
  'conflict_explainer',
]);
const RUN_KINDS = new Set<AiInterventionRunKind>(['AutoRun', 'AdminSessionTurn', 'AdminApply']);
const SESSION_STATES = new Set<AiInterventionSessionState>(['Open', 'Closed']);
const MESSAGE_ROLES = new Set<AiInterventionMessageRole>(['System', 'User', 'Assistant']);

function parseSkillKey(value: string): AiInterventionSkillKey {
  if (SKILL_KEYS.has(value as AiInterventionSkillKey)) return value as AiInterventionSkillKey;
  throw new Error(`未知 AI 技能键：${value}`);
}
function parseOptionalSkillKey(value: string | null): AiInterventionSkillKey | null {
  return value == null ? null : parseSkillKey(value);
}
function parseRunKind(value: string): AiInterventionRunKind {
  if (RUN_KINDS.has(value as AiInterventionRunKind)) return value as AiInterventionRunKind;
  throw new Error(`未知 AI 运行类别：${value}`);
}
function parseSessionState(value: string): AiInterventionSessionState {
  if (SESSION_STATES.has(value as AiInterventionSessionState)) {
    return value as AiInterventionSessionState;
  }
  throw new Error(`未知 AI 会话状态：${value}`);
}
function parseMessageRole(value: string): AiInterventionMessageRole {
  if (MESSAGE_ROLES.has(value as AiInterventionMessageRole)) {
    return value as AiInterventionMessageRole;
  }
  throw new Error(`未知 AI 消息角色：${value}`);
}

// ─── 映射器 ──────────────────────────────────────────────────────────────────

function mapThread(raw: RawThread): AiInterventionThreadRecord {
  return {
    id: raw.id,
    mediaItemId: raw.media_item_id,
    latestRunId: raw.latest_run_id,
    latestAutoTaskId: raw.latest_auto_task_id,
    latestSummaryJson: raw.latest_summary_json,
    latestEvidenceJson: raw.latest_evidence_json,
    latestResultJson: raw.latest_result_json,
    latestDiffJson: raw.latest_diff_json,
    latestSkillKey: parseOptionalSkillKey(raw.latest_skill_key),
    latestProvider: raw.latest_provider,
    latestModel: raw.latest_model,
    latestRunStatus: raw.latest_run_status,
    latestAppliedRunId: raw.latest_applied_run_id,
    latestAppliedResultJson: raw.latest_applied_result_json,
    sessionState: parseSessionState(raw.session_state),
    currentSessionId: raw.current_session_id,
    currentSessionSkillKey: parseOptionalSkillKey(raw.current_session_skill_key),
    sessionOpenedByUserId: raw.session_opened_by_user_id,
    sessionOpenedAt: raw.session_opened_at,
    sessionLastActivityAt: raw.session_last_activity_at,
    archivedSessionSummaryJson: raw.archived_session_summary_json,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function mapRun(raw: RawRun): AiInterventionRunRecord {
  return {
    id: raw.id,
    threadId: raw.thread_id,
    mediaItemId: raw.media_item_id,
    sessionId: raw.session_id,
    aiTaskId: raw.ai_task_id,
    runKind: parseRunKind(raw.run_kind),
    skillKey: parseSkillKey(raw.skill_key),
    provider: raw.provider,
    model: raw.model,
    runStatus: raw.run_status,
    turnIndex: raw.turn_index,
    summaryJson: raw.summary_json,
    evidenceSnapshotJson: raw.evidence_snapshot_json,
    resultSnapshotJson: raw.result_snapshot_json,
    diffSnapshotJson: raw.diff_snapshot_json,
    errorCode: raw.error_code,
    errorMessage: raw.error_message,
    requestedByUserId: raw.requested_by_user_id,
    appliedByUserId: raw.applied_by_user_id,
    appliedAt: raw.applied_at,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function mapMessage(raw: RawMessage): AiInterventionMessageRecord {
  return {
    id: raw.id,
    threadId: raw.thread_id,
    mediaItemId: raw.media_item_id,
    sessionId: raw.session_id,
    role: parseMessageRole(raw.role),
    contentText: raw.content_text,
    archivedSummaryText: raw.archived_summary_text,
    evidenceSnapshotJson: raw.evidence_snapshot_json,
    skillResultRefJson: raw.skill_result_ref_json,
    createdByUserId: raw.created_by_user_id,
    archivedAt: raw.archived_at,
    createdAt: raw.created_at,
  };
}

function mapSuggest(raw: RawSuggest): AiInterventionSuggestRecord {
  return {
    mediaItemId: raw.mediaItemId,
    suggestedTitle: raw.suggestedTitle,
    suggestedYear: raw.suggestedYear,
    suggestedSeason: raw.suggestedSeason,
    suggestedEpisode: raw.suggestedEpisode,
    externalId: raw.externalId,
    confidence: raw.confidence,
    reasoning: raw.reasoning,
    wouldAutoBind: raw.wouldAutoBind,
  };
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const aiInterventionsApi = {
  async listThreads(query: AiInterventionListQuery = {}): Promise<AiInterventionThreadRecord[]> {
    const params: Record<string, number> = {};
    if (query.limit !== undefined) params.limit = query.limit;
    if (query.offset !== undefined) params.offset = query.offset;
    const raw = await httpClient.get<RawThread[]>(`${BASE}/threads`, { params });
    return raw.map(mapThread);
  },

  async getThread(mediaItemId: string): Promise<AiInterventionThreadDetailRecord> {
    const raw = await httpClient.get<RawThreadDetail>(
      `${BASE}/media/${encodeURIComponent(mediaItemId)}`,
    );
    return {
      thread: mapThread(raw.thread),
      messages: raw.messages.map(mapMessage),
      runs: raw.runs.map(mapRun),
    };
  },

  async openSession(
    mediaItemId: string,
    preferredSkillKey?: AiInterventionSkillKey,
  ): Promise<AiInterventionThreadRecord> {
    const raw = await httpClient.post<RawThread>(
      `${BASE}/media/${encodeURIComponent(mediaItemId)}/session/open`,
      { body: preferredSkillKey ? { preferred_skill_key: preferredSkillKey } : {} },
    );
    return mapThread(raw);
  },

  async sendMessage(sessionId: string, message: string): Promise<AiInterventionMessageRecord> {
    const raw = await httpClient.post<RawMessage>(`${BASE}/session/message`, {
      body: { session_id: sessionId, message },
    });
    return mapMessage(raw);
  },

  async closeSession(sessionId: string): Promise<AiInterventionThreadRecord> {
    const raw = await httpClient.post<RawThread>(`${BASE}/session/close`, {
      body: { session_id: sessionId },
    });
    return mapThread(raw);
  },

  async applyLatestResult(
    mediaItemId: string,
    sessionId: string,
  ): Promise<AiInterventionThreadRecord> {
    const raw = await httpClient.post<RawThread>(
      `${BASE}/media/${encodeURIComponent(mediaItemId)}/apply`,
      { body: { session_id: sessionId } },
    );
    return mapThread(raw);
  },

  async suggestForMediaItem(mediaItemId: string): Promise<AiInterventionSuggestRecord> {
    const raw = await httpClient.post<RawSuggest>(
      `${BASE}/media/${encodeURIComponent(mediaItemId)}/suggest`,
    );
    return mapSuggest(raw);
  },
};

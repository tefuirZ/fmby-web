/**
 * FE-VISIBILITY-GOVERNANCE 类型（wire = 后端 snake_case 真源
 * `crates/fmby-v2-http/src/dto/media_visibility_governance.rs`）。
 */

export interface GovernanceStatsRaw {
  scanned_roots: number;
  candidate_hits: number;
  protected_skipped: number;
  would_hide: number;
  hidden_applied: number;
  would_restore: number;
  restored: number;
  already_hidden: number;
  errors: number;
}

export interface GovernanceTaskRaw {
  id: string;
  mode: string;
  status: string;
  restore_from_task_id: string | null;
  cursor_media_item_id: number | null;
  batch_size: number;
  policy_version: string;
  stats: GovernanceStatsRaw;
  requested_by_user_id: number | null;
  lease_owner: string | null;
  lease_token: string | null;
  lease_expires_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

/** camelCase（前端消费形态）。 */
export interface GovernanceStats {
  scannedRoots: number;
  candidateHits: number;
  protectedSkipped: number;
  wouldHide: number;
  hiddenApplied: number;
  wouldRestore: number;
  restored: number;
  alreadyHidden: number;
  errors: number;
}

export interface GovernanceTask {
  id: string;
  mode: string;
  status: string;
  restoreFromTaskId: string | null;
  cursorMediaItemId: number | null;
  batchSize: number;
  policyVersion: string;
  stats: GovernanceStats;
  requestedByUserId: number | null;
  leaseOwner: string | null;
  leaseToken: string | null;
  leaseExpiresAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
}

export interface GovernanceCreateRequest {
  mode: string;
  batchSize?: number;
  policyVersion?: string;
  restoreFromTaskId?: string;
}

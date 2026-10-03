/**
 * 可见性治理作业面 API（FE-VISIBILITY-GOVERNANCE）。
 *
 * 端点（V2 真源，4 条；router_manage.rs:356-371）：
 * - GET  …/media-visibility-governance                 → GovernanceTaskDto[]
 * - POST …/media-visibility-governance?confirmed=true → GovernanceTaskDto（危险动作闸）
 * - GET  …/media-visibility-governance/{taskId}        → GovernanceTaskDto
 * - POST …/media-visibility-governance/{taskId}/cancel → { cancelled }
 *
 * 能力门 MANAGE_LIBRARY（create 另需 DANGEROUS_ACTION）；端口未装配 → 后端
 * fail-closed 500，httpClient 统一抛 ApiError，本层不吞。
 */

import { httpClient } from '@fmby/v2-shared/api/client';
import type {
  GovernanceCreateRequest,
  GovernanceTask,
  GovernanceTaskRaw,
} from './types';

const BASE = '/api/manage/operations/media-visibility-governance';

function fromRaw(raw: GovernanceTaskRaw): GovernanceTask {
  return {
    id: raw.id,
    mode: raw.mode,
    status: raw.status,
    restoreFromTaskId: raw.restore_from_task_id,
    cursorMediaItemId: raw.cursor_media_item_id,
    batchSize: raw.batch_size,
    policyVersion: raw.policy_version,
    stats: {
      scannedRoots: raw.stats.scanned_roots,
      candidateHits: raw.stats.candidate_hits,
      protectedSkipped: raw.stats.protected_skipped,
      wouldHide: raw.stats.would_hide,
      hiddenApplied: raw.stats.hidden_applied,
      wouldRestore: raw.stats.would_restore,
      restored: raw.stats.restored,
      alreadyHidden: raw.stats.already_hidden,
      errors: raw.stats.errors,
    },
    requestedByUserId: raw.requested_by_user_id,
    leaseOwner: raw.lease_owner,
    leaseToken: raw.lease_token,
    leaseExpiresAt: raw.lease_expires_at,
    lastErrorCode: raw.last_error_code,
    lastErrorMessage: raw.last_error_message,
    createdAt: raw.created_at,
    startedAt: raw.started_at,
    finishedAt: raw.finished_at,
    updatedAt: raw.updated_at,
  };
}

export const visibilityGovernanceApi = {
  async list(): Promise<GovernanceTask[]> {
    const raw = await httpClient.get<GovernanceTaskRaw[]>(BASE);
    return raw.map(fromRaw);
  },

  async create(req: GovernanceCreateRequest): Promise<GovernanceTask> {
    const raw = await httpClient.post<GovernanceTaskRaw>(`${BASE}?confirmed=true`, {
      body: {
        mode: req.mode,
        batch_size: req.batchSize,
        policy_version: req.policyVersion,
        restore_from_task_id: req.restoreFromTaskId,
      },
    });
    return fromRaw(raw);
  },

  async get(taskId: string): Promise<GovernanceTask> {
    const raw = await httpClient.get<GovernanceTaskRaw>(`${BASE}/${taskId}`);
    return fromRaw(raw);
  },

  async cancel(taskId: string): Promise<{ cancelled: boolean }> {
    return httpClient.post<{ cancelled: boolean }>(`${BASE}/${taskId}/cancel`);
  },
};

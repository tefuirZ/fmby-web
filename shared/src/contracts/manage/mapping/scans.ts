import type {
  ManageLibraryScanTriggerResult,
  ManageLibraryScanTriggerTask,
} from "../types";
import type {
  RawManageLibraryScanTriggerResponse,
  RawManagedScanTaskRecord,
  RawScanTriggerTask,
} from "../raw-types";
import { mapScanStatus, mapScanTaskType } from "./shared";

export function mapManagedScanTaskRecord(raw: RawManagedScanTaskRecord) {
  return {
    id: raw.id,
    librarySourceId: raw.library_source_id,
    libraryId: raw.library_id,
    libraryName: raw.library_name,
    mountId: raw.mount_id,
    mountName: raw.mount_name,
    sourcePath: raw.source_path,
    taskType: mapScanTaskType(raw.task_type),
    status: mapScanStatus(raw.status),
    itemsFound: raw.items_found,
    itemsUpdated: raw.items_updated,
    errorMessage: raw.error_message ?? undefined,
    startedAt: raw.started_at ?? undefined,
    completedAt: raw.completed_at ?? undefined,
    createdAt: raw.created_at,
  };
}

/**
 * 库级扫描触发响应 mapper（FE-CONTRACT-DRIFT-CLOSE：为库级另拆，不再复用
 * 挂载级形状/编造 taskType 与伪 ManageScanTaskRecord）。
 * 后端真 wire = `LibraryScanTriggerResponse`（http/state/scan_trigger.rs:104-112，
 * serde camelCase rename）：{ libraryId, tasks, skippedMountIds }。
 */
export function mapManageLibraryScanTriggerResponse(
  raw: RawManageLibraryScanTriggerResponse,
): ManageLibraryScanTriggerResult {
  return {
    libraryId: raw.libraryId,
    tasks: raw.tasks.map(mapLibraryScanTriggerTask),
    skippedMountIds: raw.skippedMountIds,
  };
}

/** 单挂载触发结果（对位 ScanTriggerResponse，scan_trigger.rs:26-39）——真值直传。 */
export function mapLibraryScanTriggerTask(
  raw: RawScanTriggerTask,
): ManageLibraryScanTriggerTask {
  return {
    mountId: raw.mountId,
    taskKey: raw.taskKey,
    taskId: raw.taskId,
    created: raw.created,
  };
}


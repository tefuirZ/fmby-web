import type { ManageScanTriggerResult } from "../types";
import type {
  RawManageScanTriggerResponse,
  RawManagedScanTaskRecord,
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

export function mapManageScanTriggerResponse(
  raw: RawManageScanTriggerResponse,
): ManageScanTriggerResult {
  return {
    libraryId: raw.library_id,
    taskType: mapScanTaskType(raw.task_type),
    tasks: raw.tasks.map(mapManagedScanTaskRecord),
    skippedSourceIds: raw.skipped_source_ids,
  };
}

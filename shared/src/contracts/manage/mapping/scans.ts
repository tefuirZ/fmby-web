import type { ManageScanTaskRecord, ManageScanTriggerResult } from "../types";
import type {
  RawManageScanTriggerResponse,
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

export function mapManageScanTriggerResponse(
  raw: RawManageScanTriggerResponse,
): ManageScanTriggerResult {
  // 契约漂移收口：后端 wire 为 camelCase（libraryId/skippedMountIds，serde
  // rename，见 http/state/scan_trigger.rs:104-112）；snake 形状为老契约，保留
  // 回退兼容。tasks 元素 = {mountId,taskKey,taskId,created}，非扫描任务记录。
  const libraryId = raw.libraryId ?? raw.library_id ?? "unknown";
  const skippedMountIds = raw.skippedMountIds ?? raw.skipped_source_ids ?? [];
  return {
    libraryId,
    taskType: mapScanTaskType("library"),
    tasks: raw.tasks.map(mapScanTriggerTask),
    skippedSourceIds: skippedMountIds,
  };
}

function mapScanTriggerTask(raw: RawScanTriggerTask): ManageScanTaskRecord {
  // wire 类型已确定（RawScanTriggerTask 4 字段，scan_trigger.rs:23-39），
  // 无需 Record 运行时探测；保留 created→status 的幂等语义映射。
  return {
    id: raw.taskId,
    librarySourceId: "unknown",
    libraryId: "unknown",
    libraryName: "unknown",
    mountId: raw.mountId,
    mountName: "unknown",
    sourcePath: "unknown",
    taskType: mapScanTaskType("library"),
    status: mapScanStatus(raw.created ? "pending" : "running"),
    itemsFound: 0,
    itemsUpdated: 0,
    errorMessage: undefined,
    startedAt: undefined,
    completedAt: undefined,
    createdAt: new Date().toISOString(),
  };
}

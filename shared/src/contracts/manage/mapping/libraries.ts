import type { ManageLibraryDetailRecord } from "../types";
import type {
  RawManagedLibraryDetailResponse,
  RawManagedLibraryGrantRecord,
  RawManagedLibraryRecord,
  RawManagedLibrarySourceBindingRecord,
} from "../raw-types";
import { mapEntityStatus, mapLibraryType } from "./shared";
import { mapManagedScanTaskRecord } from "./scans";

export function mapManagedLibraryRecord(raw: RawManagedLibraryRecord) {
  return {
    id: raw.id,
    name: raw.name,
    libraryType: mapLibraryType(raw.kind),
    typeLabel: raw.type_label || raw.kind || "媒体库",
    description: raw.description ?? undefined,
    itemCount: raw.item_count ?? raw.total_items ?? 0,
    status: mapEntityStatus(raw.status),
    visibilityLabel: raw.visibility_label ?? undefined,
    updatedAt: raw.updated_at ?? undefined,
    lastScanAt: raw.last_scan_at ?? undefined,
    sourceNames: raw.sources ?? [],
    actualSourceNames: raw.actual_sources ?? [],
  };
}

export function mapManagedLibraryDetailResponse(
  raw: RawManagedLibraryDetailResponse,
): ManageLibraryDetailRecord {
  return {
    library: mapManagedLibraryRecord(raw.library),
    sourceBindings: (raw.source_bindings ?? []).map(
      mapManagedLibrarySourceBindingRecord,
    ),
    accessGrants: (raw.access_grants ?? []).map(mapManagedLibraryGrantRecord),
    recentScanTasks: (raw.recent_scan_tasks ?? []).map(
      mapManagedScanTaskRecord,
    ),
  };
}

function mapManagedLibrarySourceBindingRecord(
  raw: RawManagedLibrarySourceBindingRecord,
) {
  return {
    id: raw.id,
    mountId: raw.mount_id,
    mountName: raw.mount_name,
    mountType: raw.mount_type,
    typeLabel: raw.type_label,
    mountStatus: raw.mount_status,
    subPath: raw.sub_path,
    pathLabel: raw.path_label,
    scanPriority: raw.scan_priority,
    capabilities: raw.capabilities ?? [],
  };
}

function mapManagedLibraryGrantRecord(raw: RawManagedLibraryGrantRecord) {
  return {
    userId: raw.user_id,
    username: raw.username,
    displayName: raw.display_name ?? undefined,
    grantedAt: raw.granted_at,
    grantedByUserId: raw.granted_by_user_id ?? undefined,
    grantedByUsername: raw.granted_by_username ?? undefined,
    grantedByDisplayName: raw.granted_by_display_name ?? undefined,
  };
}

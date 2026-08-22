import type {
  ManageMountDetailRecord,
  ManageStorageCapabilitiesState,
} from "../types";
import type {
  RawManagedMountDetailResponse,
  RawManagedMountLinkedSourceRecord,
  RawManagedMountRecord,
  RawManagedMountReferenceCounts,
  RawManagedSourcePathPolicyRecord,
  RawManagedStorageCapabilities,
} from "../raw-types";
import { mapProviderTypeFromApi as mapProviderType } from "../provider-mapping";
import { mapEntityStatus } from "./shared";
import { mapManagedScanTaskRecord } from "./scans";

export function mapManagedMountRecord(raw: RawManagedMountRecord) {
  return {
    id: raw.id,
    name: raw.name,
    mountType: mapProviderType(raw.mount_type),
    typeLabel: raw.type_label || raw.mount_type || "数据源",
    path: raw.path ?? undefined,
    pathLabel: raw.path_label || raw.path || "未提供来源地址",
    healthStatus: mapEntityStatus(raw.health_status),
    description: raw.description ?? undefined,
    statusMessage: raw.status_message ?? undefined,
    lastCheckedAt: raw.last_checked_at ?? undefined,
    capabilities: raw.capabilities ?? [],
    linkedLibraries: raw.linked_libraries ?? [],
    referenceCounts: mapManagedMountReferenceCounts(
      raw.reference_counts,
      raw.linked_libraries?.length ?? 0,
    ),
    unavailableBindingCount: raw.unavailable_binding_count ?? 0,
  };
}

export function mapManagedMountDetailResponse(
  raw: RawManagedMountDetailResponse,
): ManageMountDetailRecord {
  return {
    mount: mapManagedMountRecord(raw.mount),
    providerType: mapProviderType(raw.provider_type),
    rootPath: raw.root_path,
    configJson: raw.config_json ?? {},
    capabilityState: mapManagedStorageCapabilities(raw.capability_state),
    pathPolicies: (raw.path_policies ?? []).map(mapManagedSourcePathPolicyRecord),
    linkedSources: (raw.linked_sources ?? []).map(
      mapManagedMountLinkedSourceRecord,
    ),
    recentScanTasks: (raw.recent_scan_tasks ?? []).map(
      mapManagedScanTaskRecord,
    ),
  };
}

function mapManagedMountReferenceCounts(
  raw: RawManagedMountReferenceCounts | null | undefined,
  linkedLibraryCount: number,
) {
  return {
    librarySourceCount: raw?.library_source_count ?? linkedLibraryCount,
    mediaSourceCount: raw?.media_source_count ?? 0,
    sidecarAssetCount: raw?.sidecar_asset_count ?? 0,
  };
}

function mapManagedMountLinkedSourceRecord(
  raw: RawManagedMountLinkedSourceRecord,
) {
  return {
    id: raw.id,
    libraryId: raw.library_id,
    libraryName: raw.library_name,
    subPath: raw.sub_path,
    scanPriority: raw.scan_priority,
    createdAt: raw.created_at,
    availabilityStatus: mapEntityStatus(raw.availability_status),
    availabilityMessage: raw.availability_message ?? undefined,
    lastScanTaskStatus: raw.last_scan_task_status ?? undefined,
    consecutiveUnavailableFailures:
      raw.consecutive_unavailable_failures ?? 0,
    lastFailureAt: raw.last_failure_at ?? undefined,
    hiddenAt: raw.hidden_at ?? undefined,
  };
}

function mapManagedStorageCapabilities(
  raw: RawManagedStorageCapabilities,
): ManageStorageCapabilitiesState {
  return {
    canList: raw.can_list,
    canRandomRead: raw.can_random_read,
    canReadSidecar: raw.can_read_sidecar,
    canGeneratePlayTarget: raw.can_generate_play_target,
    canRefreshCredentials: raw.can_refresh_credentials,
  };
}

function mapManagedSourcePathPolicyRecord(
  raw: RawManagedSourcePathPolicyRecord,
) {
  return {
    id: raw.id,
    mountId: raw.mount_id,
    pathPrefix: raw.path_prefix ?? "",
    priority: raw.priority ?? 0,
    maxConcurrentStreams: raw.max_concurrent_streams ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

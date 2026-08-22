import type {
  CreateManageLibraryRequest,
  CreateManageMountRequest,
  DangerousActionRequest,
  ManageSourcePathGrantInput,
  ManageSourcePathPolicyInput,
  ManageStorageCapabilitiesState,
  UpdateManageLibraryRequest,
  UpdateManageMountRequest,
} from "../types";
import { mapProviderTypeToApi } from "../provider-mapping";
import { mapLibraryTypeToApi } from "./shared";

export function mapCreateLibraryPayloadToApi(
  payload: CreateManageLibraryRequest,
) {
  return {
    name: payload.name,
    library_type: mapLibraryTypeToApi(payload.libraryType),
    description: payload.description,
    source_bindings: payload.sourceBindings.map(mapLibrarySourceBindingToApi),
    grant_user_ids: payload.grantUserIds,
  };
}

export function mapUpdateLibraryPayloadToApi(
  payload: UpdateManageLibraryRequest,
) {
  return {
    name: payload.name,
    library_type: payload.libraryType
      ? mapLibraryTypeToApi(payload.libraryType)
      : undefined,
    description: payload.description,
    replace_source_bindings: payload.replaceSourceBindings?.map(
      mapLibrarySourceBindingToApi,
    ),
    replace_grant_user_ids: payload.replaceGrantUserIds,
  };
}

export function mapCreateMountPayloadToApi(payload: CreateManageMountRequest) {
  return {
    name: payload.name,
    provider_type: mapProviderTypeToApi(payload.providerType),
    root_path: payload.rootPath,
    config_json: payload.configJson ?? {},
    status: payload.status,
    path_policies: payload.pathPolicies?.map(mapSourcePathPolicyToApi) ?? [],
    capabilities: payload.capabilities
      ? mapStorageCapabilitiesToApi(payload.capabilities)
      : undefined,
  };
}

export function mapUpdateMountPayloadToApi(payload: UpdateManageMountRequest) {
  return {
    name: payload.name,
    root_path: payload.rootPath,
    config_json: payload.configJson,
    status: payload.status,
    path_policies: payload.pathPolicies?.map(mapSourcePathPolicyToApi),
    capabilities: payload.capabilities
      ? mapStorageCapabilitiesToApi(payload.capabilities)
      : undefined,
  };
}

export function mapDangerousActionPayloadToApi(payload: DangerousActionRequest) {
  return {
    confirm_action: payload.confirmAction,
    session_confirmation: payload.sessionConfirmation,
    current_password: payload.currentPassword,
  };
}

function mapLibrarySourceBindingToApi(binding: {
  id?: string;
  mountId: string;
  subPath: string;
  scanPriority: number;
}) {
  return {
    id: binding.id,
    mount_id: binding.mountId,
    sub_path: binding.subPath,
    scan_priority: binding.scanPriority,
  };
}

function mapStorageCapabilitiesToApi(payload: ManageStorageCapabilitiesState) {
  return {
    can_list: payload.canList,
    can_random_read: payload.canRandomRead,
    can_read_sidecar: payload.canReadSidecar,
    can_generate_play_target: payload.canGeneratePlayTarget,
    can_refresh_credentials: payload.canRefreshCredentials,
  };
}

export function mapSourcePathGrantToApi(payload: ManageSourcePathGrantInput) {
  return {
    mount_id: payload.mountId,
    path_prefix: payload.pathPrefix,
  };
}

function mapSourcePathPolicyToApi(payload: ManageSourcePathPolicyInput) {
  return {
    id: payload.id,
    path_prefix: payload.pathPrefix,
    priority: payload.priority,
    max_concurrent_streams: payload.maxConcurrentStreams ?? null,
  };
}

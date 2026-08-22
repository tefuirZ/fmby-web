import type {
  ManageLibrariesQuery,
  ManageMountsQuery,
  ManageProbeTasksQuery,
  ManageRuntimeLogsQuery,
  ManageScansQuery,
} from "../types";
import { mapProviderTypeToApi } from "../provider-mapping";
import {
  mapLibraryTypeToApi,
  mapProbeTaskStatusToApi,
  mapRuntimeLogLevelToApi,
  mapScanStatusToApi,
  mapScanTaskTypeToApi,
} from "./shared";

export function mapLibrariesQueryToParams(query?: ManageLibrariesQuery) {
  if (!query) {
    return undefined;
  }

  return {
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    status: query.status,
    libraryType: query.libraryType
      ? mapLibraryTypeToApi(query.libraryType)
      : undefined,
    mountId: query.mountId,
  };
}

export function mapMountsQueryToParams(query?: ManageMountsQuery) {
  if (!query) {
    return undefined;
  }

  return {
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    healthStatus: query.healthStatus,
    providerType: query.providerType
      ? mapProviderTypeToApi(query.providerType)
      : undefined,
    libraryId: query.libraryId,
  };
}

export function mapScansQueryToParams(query?: ManageScansQuery) {
  if (!query) {
    return undefined;
  }

  return {
    page: query.page,
    pageSize: query.pageSize,
    status: query.status ? mapScanStatusToApi(query.status) : undefined,
    taskType: query.taskType ? mapScanTaskTypeToApi(query.taskType) : undefined,
    libraryId: query.libraryId,
    mountId: query.mountId,
    librarySourceId: query.librarySourceId,
  };
}

export function mapProbeTasksQueryToParams(query?: ManageProbeTasksQuery) {
  if (!query) {
    return undefined;
  }

  return {
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    status: query.status ? mapProbeTaskStatusToApi(query.status) : undefined,
    libraryId: query.libraryId,
    mountId: query.mountId,
  };
}

export function mapRuntimeLogsQueryToParams(query?: ManageRuntimeLogsQuery) {
  if (!query) {
    return undefined;
  }

  return {
    page: query.page,
    pageSize: query.pageSize,
    level: query.level ? mapRuntimeLogLevelToApi(query.level) : undefined,
    target: query.target,
    search: query.search,
    method: query.method,
    path: query.path,
    client: query.client,
    ip: query.ip,
    request_id: query.requestId,
    user: query.user,
    all: query.all,
  };
}

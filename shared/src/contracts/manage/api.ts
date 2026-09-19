import { httpClient } from "@fmby/v2-shared/api/client";
import type {
  BatchDeleteManageUsersRequest,
  BatchDeleteRegistrationCodeBatchesRequest,
  BatchDisableManageUsersRequest,
  BatchUpdateManageUsersRequest,
  CreateManageUserRequest,
  BrowseManageMountDirectoriesRequest,
  CreateManageLibraryRequest,
  CreateManageMountRequest,
  CreateRegistrationCodeRequest,
  CreateRoleTemplateRequest,
  DangerousActionRequest,
  ManageActionResult,
  ManageAdvancedResponse,
  ManageAuditLogsResponse,
  ManageBatchUsersActionResponse,
  ManageBatchRegistrationCodeActionResponse,
  ManageLibrariesQuery,
  ManageLibrariesResponse,
  ManageLibraryDetailRecord,
  ManageMountDetailRecord,
  ManageMountDirectoryBrowserResponse,
  ManageMountsQuery,
  ManageMountsResponse,
  ManageOverviewResponse,
  ManageProbeTaskDetailRecord,
  ManageProbeTasksQuery,
  ManageProbeTasksResponse,
  ManageRegistrationCodesResponse,
  ManageRoleTemplatesResponse,
  ManageRuntimeLogsQuery,
  ManageRuntimeLogsResponse,
  ResetIpLoginRiskRequest,
  ResetUserLoginRiskRequest,
  ResetUserPasswordRequest,
  ReviewUserRegistrationRequest,
  ManageScanTriggerResult,
  ManageScansQuery,
  ManageScansResponse,
  ManageSourceAvailabilityRecoverResponse,
  ManageUserDetailRecord,
  ManageUsersQuery,
  ManageSessionsResponse,
  TriggerManageLibraryScanRequest,
  UpdateManageLibraryRequest,
  UpdateManageMountRequest,
  UpdateManageUserRequest,
  UpdateRegistrationCodeBatchRequest,
  ManageUsersResponse,
  UpdateRegistrationCodeRequest,
  UpdateRegistrationCodeStatusRequest,
  UpdateRoleTemplateRequest,
  UpdateUserStatusRequest,
} from "./types";
import type {
  RawAuditLogRecord,
  RawListResponse,
  RawManageActionResult,
  RawManageAdvancedResponse,
  RawManageBatchUsersActionResponse,
  RawManageBatchRegistrationCodeActionResponse,
  RawManageOverviewResponse,
  RawManageSourceAvailabilityRecoverResponse,
  RawManageRuntimeLogsResponse,
  RawManageScanTriggerResponse,
  RawManagedLibraryDetailResponse,
  RawManagedLibraryRecord,
  RawManagedMountDetailResponse,
  RawManagedMountDirectoryBrowserResponse,
  RawManagedMountRecord,
  RawManagedProbeTaskDetailResponse,
  RawManagedProbeTaskRecord,
  RawManagedScanTaskRecord,
  RawManagedSessionRecord,
  RawManagedUserRecord,
  RawRegistrationCodeBatchRecord,
  RawRegistrationCodeRecord,
  RawRoleTemplateRecord,
} from "./raw-types";
import { mapProviderTypeToApi } from "./provider-mapping";
import {
  mapAdvanced,
  mapAuditLogRecord,
  mapCreateLibraryPayloadToApi,
  mapCreateMountPayloadToApi,
  mapDangerousActionPayloadToApi,
  mapLibrariesQueryToParams,
  mapManageActionResult,
  mapManageScanTriggerResponse,
  mapManagedLibraryDetailResponse,
  mapManagedLibraryRecord,
  mapManagedMountDetailResponse,
  mapManagedMountRecord,
  mapManagedProbeTaskDetailResponse,
  mapManagedProbeTaskRecord,
  mapManagedScanTaskRecord,
  mapMountsQueryToParams,
  mapOverview,
  mapProbeTasksQueryToParams,
  mapRegistrationCodeBatch,
  mapRegistrationCode,
  mapRegistrationCodeStatusToApi,
  mapRoleTemplateRecord,
  mapRuntimeLogRecord,
  mapRuntimeLogsQueryToParams,
  mapScanTaskTypeToApi,
  mapScansQueryToParams,
  mapSourcePathGrantToApi,
  mapSessionRecord,
  mapUpdateLibraryPayloadToApi,
  mapUpdateMountPayloadToApi,
  mapUserRecord,
  mapUserStatusToApi,
} from "./mapping";

export const manageApi = {
  async getOverview(): Promise<ManageOverviewResponse> {
    const raw = await httpClient.get<RawManageOverviewResponse>(
      "/api/manage/overview",
    );
    return mapOverview(raw);
  },

  async recoverUnavailableLibrarySource(
    librarySourceId: string,
  ): Promise<ManageSourceAvailabilityRecoverResponse> {
    const raw = await httpClient.post<RawManageSourceAvailabilityRecoverResponse>(
      `/api/manage/source-availability/${librarySourceId}/recover`,
    );
    return {
      librarySourceId: raw.library_source_id,
      recovered: raw.recovered,
      recoveredAt: raw.recovered_at,
    };
  },

  async getUsers(query?: ManageUsersQuery): Promise<ManageUsersResponse> {
    const raw =
      await httpClient.get<RawListResponse<RawManagedUserRecord>>(
        "/api/manage/users",
        {
          params: {
            page: query?.page,
            pageSize: query?.pageSize,
            search: query?.search?.trim() || undefined,
            status: query?.status ? mapUserStatusToApi(query.status) : undefined,
            account_kind: query?.accountKind,
          },
        },
      );
    return {
      items: raw.items.map(mapUserRecord),
      total: raw.total,
    };
  },

  async getUserDetail(userId: string): Promise<ManageUserDetailRecord> {
    const raw = await httpClient.get<RawManagedUserRecord>(
      `/api/manage/users/${userId}`,
    );
    return mapUserRecord(raw);
  },

  async createUser(
    payload: CreateManageUserRequest,
  ): Promise<ManageUserDetailRecord> {
    const raw = await httpClient.post<RawManagedUserRecord>(
      "/api/manage/users",
      {
        body: {
          username: payload.username,
          display_name: payload.displayName,
          email: payload.email,
          password: payload.password,
          role: payload.role,
          role_template_id: payload.roleTemplateId ?? null,
          status: mapUserStatusToApi(payload.status),
          account_kind: payload.accountKind ?? "human",
          max_sessions: payload.maxSessions ?? null,
          valid_until: payload.validUntil
            ? new Date(payload.validUntil).toISOString()
            : null,
          max_concurrent_playbacks: payload.maxConcurrentPlaybacks ?? null,
          source_grants: payload.sourceGrants?.map(mapSourcePathGrantToApi),
        },
      },
    );
    return mapUserRecord(raw);
  },

  async updateUser(
    userId: string,
    payload: UpdateManageUserRequest,
  ): Promise<ManageUserDetailRecord> {
    const raw = await httpClient.patch<RawManagedUserRecord>(
      `/api/manage/users/${userId}`,
      {
        // CONFIRM-GATE-ALIGN：后端 `manage.users_update` 走 `?confirmed=true` query 闸
        // （`http/routes/manage.rs` ConfirmQuery），仅发 body 会 400。
        params: { confirmed: true },
        body: {
          display_name: payload.displayName,
          email: payload.email,
          status: payload.status ? mapUserStatusToApi(payload.status) : undefined,
          account_kind: payload.accountKind,
          roles: payload.role ? [payload.role] : undefined,
          role_template_id: payload.roleTemplateId,
          max_sessions: payload.maxSessions,
          valid_until:
            payload.validUntil === undefined
              ? undefined
              : payload.validUntil
                ? new Date(payload.validUntil).toISOString()
                : null,
          max_concurrent_playbacks: payload.maxConcurrentPlaybacks,
          source_grants: payload.sourceGrants?.map(mapSourcePathGrantToApi),
          confirm_action: payload.confirmAction,
          session_confirmation: payload.sessionConfirmation,
          current_password: payload.currentPassword,
        },
      },
    );
    return mapUserRecord(raw);
  },

  async batchUpdateUsers(
    payload: BatchUpdateManageUsersRequest,
  ): Promise<ManageBatchUsersActionResponse> {
    const raw = await httpClient.post<RawManageBatchUsersActionResponse>(
      "/api/manage/users/batch/update",
      {
        // CONFIRM-GATE-ALIGN：后端 `manage_users_batch_update` 经 require_dangerous_manage
        // → require_confirmed，要求 `?confirmed=true`。
        params: { confirmed: true },
        body: {
          user_ids: payload.userIds,
          status: payload.status ? mapUserStatusToApi(payload.status) : undefined,
          roles: payload.role ? [payload.role] : undefined,
          source_grants: payload.sourceGrants?.map(mapSourcePathGrantToApi),
          ...mapDangerousActionPayloadToApi({
            confirmAction: payload.confirmAction ?? "batch-update-users",
            sessionConfirmation: payload.sessionConfirmation,
            currentPassword: payload.currentPassword,
          }),
        },
      },
    );
    return {
      updatedCount: raw.updated_count,
      results: (raw.results ?? []).map(mapManageActionResult),
    };
  },

  async batchDisableUsers(
    payload: BatchDisableManageUsersRequest,
  ): Promise<ManageBatchUsersActionResponse> {
    const raw = await httpClient.post<RawManageBatchUsersActionResponse>(
      "/api/manage/users/batch/disable",
      {
        // CONFIRM-GATE-ALIGN：后端 `manage_users_batch_disable` 同样要求 `?confirmed=true`。
        params: { confirmed: true },
        body: {
          user_ids: payload.userIds,
          ...mapDangerousActionPayloadToApi({
            confirmAction: payload.confirmAction ?? "disable-users",
            sessionConfirmation: payload.sessionConfirmation,
            currentPassword: payload.currentPassword,
          }),
        },
      },
    );
    return {
      updatedCount: raw.updated_count,
      results: (raw.results ?? []).map(mapManageActionResult),
    };
  },

  async batchDeleteUsers(
    payload: BatchDeleteManageUsersRequest,
  ): Promise<ManageBatchUsersActionResponse> {
    const raw = await httpClient.post<RawManageBatchUsersActionResponse>(
      "/api/manage/users/batch/delete",
      {
        body: {
          user_ids: payload.userIds,
          ...mapDangerousActionPayloadToApi({
            confirmAction: payload.confirmAction ?? "delete-users",
            sessionConfirmation: payload.sessionConfirmation,
            currentPassword: payload.currentPassword,
          }),
        },
      },
    );
    return {
      updatedCount: raw.updated_count,
      results: (raw.results ?? []).map(mapManageActionResult),
    };
  },

  async updateUserStatus(userId: string, payload: UpdateUserStatusRequest) {
    await httpClient.patch(`/api/manage/users/${userId}/status`, {
      body: {
        status: mapUserStatusToApi(payload.status),
        ...mapDangerousActionPayloadToApi({
          confirmAction: payload.confirmAction ?? "update-user-status",
          sessionConfirmation: payload.sessionConfirmation,
          currentPassword: payload.currentPassword,
        }),
      },
    });
  },

  async approveUserRegistration(
    userId: string,
    payload: ReviewUserRegistrationRequest,
  ): Promise<ManageUserDetailRecord> {
    const raw = await httpClient.post<RawManagedUserRecord>(
      `/api/manage/users/${userId}/approve-registration`,
      {
        // V2 危险写统一 query 确认闸（照 deleteRoleTemplate/revokeSession 先例）；
        // 后端 manage_users_approve_registration 要求 ?confirmed=true
        // （check-confirm-gate 强制，缺发必 400）。
        params: { confirmed: true },
        body: mapDangerousActionPayloadToApi({
          confirmAction:
            payload.confirmAction ?? "approve-user-registration",
          sessionConfirmation: payload.sessionConfirmation,
          currentPassword: payload.currentPassword,
        }),
      },
    );
    return mapUserRecord(raw);
  },

  async rejectUserRegistration(
    userId: string,
    payload: ReviewUserRegistrationRequest,
  ): Promise<ManageUserDetailRecord> {
    const raw = await httpClient.post<RawManagedUserRecord>(
      `/api/manage/users/${userId}/reject-registration`,
      {
        // 同 approve-registration：后端 manage_users_reject_registration 要求
        // ?confirmed=true（check-confirm-gate 强制，缺发必 400）。
        params: { confirmed: true },
        body: mapDangerousActionPayloadToApi({
          confirmAction:
            payload.confirmAction ?? "reject-user-registration",
          sessionConfirmation: payload.sessionConfirmation,
          currentPassword: payload.currentPassword,
        }),
      },
    );
    return mapUserRecord(raw);
  },

  async resetUserPassword(
    userId: string,
    payload: ResetUserPasswordRequest,
  ): Promise<ManageActionResult> {
    const raw = await httpClient.post<RawManageActionResult>(
      `/api/manage/users/${userId}/reset-password`,
      {
        // CONFIRM-GATE-ALIGN：后端 `manage_users_reset_password` 经 require_dangerous_manage
        // → require_confirmed，要求 `?confirmed=true`。
        params: { confirmed: true },
        body: {
          new_password: payload.newPassword,
          force_change: payload.forceChange ?? false,
          ...mapDangerousActionPayloadToApi({
            confirmAction: payload.confirmAction ?? "reset-user-password",
            sessionConfirmation: payload.sessionConfirmation,
            currentPassword: payload.currentPassword,
          }),
        },
      },
    );
    return mapManageActionResult(raw);
  },

  async resetIpLoginRisk(
    payload: ResetIpLoginRiskRequest,
  ): Promise<ManageActionResult> {
    const raw = await httpClient.post<RawManageActionResult>(
      "/api/manage/login-risk/ip/reset",
      {
        // CONFIRM-GATE-ALIGN：后端 `manage_login_risk_ip_reset` 经 require_dangerous_manage
        // → require_confirmed，要求 `?confirmed=true`。
        params: { confirmed: true },
        body: {
          ip_address: payload.ipAddress,
          ...mapDangerousActionPayloadToApi({
            confirmAction: payload.confirmAction ?? "reset-ip-login-risk",
            sessionConfirmation: payload.sessionConfirmation,
            currentPassword: payload.currentPassword,
          }),
        },
      },
    );
    return mapManageActionResult(raw);
  },

  async resetUserLoginRisk(
    userId: string,
    payload: ResetUserLoginRiskRequest,
  ): Promise<ManageActionResult> {
    const raw = await httpClient.post<RawManageActionResult>(
      `/api/manage/users/${userId}/login-risk/reset`,
      {
        // CONFIRM-GATE-ALIGN：后端 `manage_users_reset_login_risk` 经 require_dangerous_manage
        // → require_confirmed，要求 `?confirmed=true`。
        params: { confirmed: true },
        body: mapDangerousActionPayloadToApi({
          confirmAction: payload.confirmAction ?? "reset-user-login-risk",
          sessionConfirmation: payload.sessionConfirmation,
          currentPassword: payload.currentPassword,
        }),
      },
    );
    return mapManageActionResult(raw);
  },

  async getRegistrationCodes(): Promise<ManageRegistrationCodesResponse> {
    const raw = await httpClient.get<
      RawListResponse<RawRegistrationCodeBatchRecord>
    >("/api/manage/registration-codes");
    return {
      items: raw.items.map(mapRegistrationCodeBatch),
    };
  },

  async createRegistrationCode(payload: CreateRegistrationCodeRequest) {
    const raw = await httpClient.post<RawRegistrationCodeBatchRecord>(
      "/api/manage/registration-codes",
      {
        body: {
          mode:
            payload.mode === "shared-code" ? "shared_code" : "single_use_batch",
          batch_name: payload.batchName,
          generate_count:
            payload.mode === "single-use-batch" &&
            payload.generateCount &&
            payload.generateCount > 0
              ? payload.generateCount
              : undefined,
          code:
            payload.mode === "shared-code" && payload.code?.trim()
              ? payload.code.trim()
              : undefined,
          role_template: payload.roleTemplate,
          max_uses:
            payload.mode === "shared-code" &&
            payload.usageLimit &&
            payload.usageLimit > 0
              ? payload.usageLimit
              : null,
          max_sessions:
            payload.maxSessions && payload.maxSessions > 0
              ? payload.maxSessions
              : null,
          valid_days:
            payload.validDays && payload.validDays > 0 ? payload.validDays : null,
          expires_at: payload.expiresAt
            ? new Date(payload.expiresAt).toISOString()
            : undefined,
          default_library_ids: payload.defaultLibraries ?? [],
          allow_reactivation: payload.allowReactivation ?? true,
          require_approval: payload.requireApproval ?? false,
        },
      },
    );
    return mapRegistrationCodeBatch(raw);
  },

  async updateRegistrationCode(
    codeId: string,
    payload: UpdateRegistrationCodeRequest,
  ) {
    const raw = await httpClient.patch<RawRegistrationCodeRecord>(
      `/api/manage/registration-codes/${codeId}`,
      {
        body: {
          role_template: payload.roleTemplate,
          max_uses: payload.usageLimit > 0 ? payload.usageLimit : null,
          max_sessions:
            payload.maxSessions && payload.maxSessions > 0
              ? payload.maxSessions
              : null,
          valid_days:
            payload.validDays && payload.validDays > 0 ? payload.validDays : null,
          expires_at: payload.expiresAt
            ? new Date(payload.expiresAt).toISOString()
            : null,
          default_library_ids: payload.defaultLibraries ?? [],
          allow_reactivation: payload.allowReactivation ?? true,
          require_approval: payload.requireApproval ?? false,
        },
      },
    );
    return mapRegistrationCode(raw);
  },

  async updateRegistrationCodeBatch(
    batchId: string,
    payload: UpdateRegistrationCodeBatchRequest,
  ) {
    const raw = await httpClient.patch<RawRegistrationCodeBatchRecord>(
      `/api/manage/registration-codes/batches/${batchId}`,
      {
        body: {
          batch_name: payload.batchName,
          role_template: payload.roleTemplate,
          code: payload.code?.trim() ? payload.code.trim() : undefined,
          max_uses:
            payload.usageLimit && payload.usageLimit > 0
              ? payload.usageLimit
              : null,
          max_sessions:
            payload.maxSessions && payload.maxSessions > 0
              ? payload.maxSessions
              : null,
          valid_days:
            payload.validDays && payload.validDays > 0 ? payload.validDays : null,
          expires_at: payload.expiresAt
            ? new Date(payload.expiresAt).toISOString()
            : null,
          default_library_ids: payload.defaultLibraries ?? [],
          allow_reactivation: payload.allowReactivation ?? true,
          require_approval: payload.requireApproval ?? false,
        },
      },
    );
    return mapRegistrationCodeBatch(raw);
  },

  async updateRegistrationCodeStatus(
    codeId: string,
    payload: UpdateRegistrationCodeStatusRequest,
  ) {
    await httpClient.patch(`/api/manage/registration-codes/${codeId}/status`, {
      // CONFIRM-GATE-ALIGN（REG-CODES-B）：后端 manage_registration_codes_update_status
      // 要求 `?confirmed=true`。
      params: { confirmed: true },
      body: {
        status: mapRegistrationCodeStatusToApi(payload.status),
        ...mapDangerousActionPayloadToApi({
          confirmAction:
            payload.confirmAction ?? "update-registration-code-status",
          sessionConfirmation: payload.sessionConfirmation,
          currentPassword: payload.currentPassword,
        }),
      },
    });
  },

  async deleteRegistrationCode(
    codeId: string,
    payload: DangerousActionRequest = {
      confirmAction: "delete-registration-code",
    },
  ): Promise<ManageActionResult> {
    const raw = await httpClient.delete<RawManageActionResult>(
      `/api/manage/registration-codes/${codeId}`,
      {
        // CONFIRM-GATE-ALIGN（REG-CODES-B）：后端 manage_registration_codes_delete
        // 要求 `?confirmed=true`。
        params: { confirmed: true },
        body: mapDangerousActionPayloadToApi(payload),
      },
    );
    return mapManageActionResult(raw);
  },

  async batchDeleteRegistrationCodeBatches(
    payload: BatchDeleteRegistrationCodeBatchesRequest,
  ): Promise<ManageBatchRegistrationCodeActionResponse> {
    const raw = await httpClient.post<RawManageBatchRegistrationCodeActionResponse>(
      "/api/manage/registration-codes/batch/delete",
      {
        // V2 危险写统一 query 确认闸（照 revokeSession 先例）；后端
        // manage_registration_codes_batch_delete 要求 ?confirmed=true
        // （check-confirm-gate 强制）。
        params: { confirmed: true },
        body: {
          batch_ids: payload.batchIds,
          ...mapDangerousActionPayloadToApi({
            confirmAction:
              payload.confirmAction ?? "delete-registration-code-batches",
            sessionConfirmation: payload.sessionConfirmation,
            currentPassword: payload.currentPassword,
          }),
        },
      },
    );
    return {
      updatedCount: raw.updated_count,
      results: (raw.results ?? []).map(mapManageActionResult),
    };
  },

  async getRoleTemplates(): Promise<ManageRoleTemplatesResponse> {
    const raw = await httpClient.get<RawListResponse<RawRoleTemplateRecord>>(
      "/api/manage/role-templates",
    );
    return {
      items: raw.items.map(mapRoleTemplateRecord),
    };
  },

  async createRoleTemplate(payload: CreateRoleTemplateRequest) {
    return httpClient.post("/api/manage/role-templates", {
      body: {
        code: payload.code,
        name: payload.name,
        description: payload.description,
        default_library_ids: payload.defaultLibraries ?? [],
        source_grants: payload.sourceGrants?.map(mapSourcePathGrantToApi) ?? [],
        default_max_sessions:
          payload.defaultMaxSessions && payload.defaultMaxSessions > 0
            ? payload.defaultMaxSessions
            : null,
        default_valid_days:
          payload.defaultValidDays && payload.defaultValidDays > 0
            ? payload.defaultValidDays
            : null,
      },
    });
  },

  async updateRoleTemplate(
    templateId: string,
    payload: UpdateRoleTemplateRequest,
  ) {
    return httpClient.patch(`/api/manage/role-templates/${templateId}`, {
      body: {
        name: payload.name,
        description: payload.description,
        default_library_ids: payload.defaultLibraries ?? [],
        source_grants: payload.sourceGrants?.map(mapSourcePathGrantToApi),
        default_max_sessions:
          payload.defaultMaxSessions && payload.defaultMaxSessions > 0
            ? payload.defaultMaxSessions
            : null,
        default_valid_days:
          payload.defaultValidDays && payload.defaultValidDays > 0
            ? payload.defaultValidDays
            : null,
      },
    });
  },

  async deleteRoleTemplate(
    templateId: string,
    payload: DangerousActionRequest = { confirmAction: "delete-role-template" },
  ): Promise<ManageActionResult> {
    const raw = await httpClient.delete<RawManageActionResult>(
      `/api/manage/role-templates/${templateId}`,
      {
        // V2 危险写统一 query 确认闸（后端 manage_role_templates_delete 要求）。
        params: { confirmed: true },
        body: mapDangerousActionPayloadToApi(payload),
      },
    );
    return mapManageActionResult(raw);
  },

  async getSessions(): Promise<ManageSessionsResponse> {
    const raw = await httpClient.get<RawListResponse<RawManagedSessionRecord>>(
      "/api/manage/sessions",
    );
    return {
      items: raw.items.map(mapSessionRecord),
    };
  },

  async revokeSession(
    sessionId: string,
    payload: DangerousActionRequest = { confirmAction: "revoke-session" },
  ) {
    await httpClient.delete(`/api/manage/sessions/${sessionId}`, {
      // V2 危险写统一 query 确认闸（照 peripherals/api.ts 先例）；
      // 后端 manage_sessions_delete 要求 ?confirmed=true（check-confirm-gate 强制）。
      params: { confirmed: true },
      body: mapDangerousActionPayloadToApi(payload),
    });
  },

  async getAuditLogs(): Promise<ManageAuditLogsResponse> {
    const raw = await httpClient.get<RawListResponse<RawAuditLogRecord>>(
      "/api/manage/audit-logs",
    );
    return {
      items: raw.items.map(mapAuditLogRecord),
    };
  },

  async getRuntimeLogs(
    query?: ManageRuntimeLogsQuery,
  ): Promise<ManageRuntimeLogsResponse> {
    const raw = await httpClient.get<RawManageRuntimeLogsResponse>(
      "/api/manage/runtime-logs",
      {
        params: mapRuntimeLogsQueryToParams(query),
      },
    );
    return {
      items: (raw.items ?? []).map(mapRuntimeLogRecord),
      total: raw.total ?? 0,
      truncated: raw.truncated ?? false,
      logDir: raw.log_dir,
      availableTargets: raw.available_targets ?? [],
    };
  },

  async getAdvanced(): Promise<ManageAdvancedResponse> {
    const raw = await httpClient.get<RawManageAdvancedResponse>(
      "/api/manage/advanced",
    );
    return mapAdvanced(raw);
  },

  async getLibraries(
    query?: ManageLibrariesQuery,
  ): Promise<ManageLibrariesResponse> {
    const raw = await httpClient.get<RawListResponse<RawManagedLibraryRecord>>(
      "/api/manage/libraries",
      {
        params: mapLibrariesQueryToParams(query),
      },
    );
    return {
      items: raw.items.map(mapManagedLibraryRecord),
    };
  },

  async getLibraryDetail(
    libraryId: string,
  ): Promise<ManageLibraryDetailRecord> {
    const raw = await httpClient.get<RawManagedLibraryDetailResponse>(
      `/api/manage/libraries/${libraryId}`,
    );
    return mapManagedLibraryDetailResponse(raw);
  },

  async createLibrary(
    payload: CreateManageLibraryRequest,
  ): Promise<ManageLibraryDetailRecord> {
    const raw = await httpClient.post<RawManagedLibraryDetailResponse>(
      "/api/manage/libraries",
      {
        body: mapCreateLibraryPayloadToApi(payload),
      },
    );
    return mapManagedLibraryDetailResponse(raw);
  },

  async updateLibrary(
    libraryId: string,
    payload: UpdateManageLibraryRequest,
  ): Promise<ManageLibraryDetailRecord> {
    const raw = await httpClient.patch<RawManagedLibraryDetailResponse>(
      `/api/manage/libraries/${libraryId}`,
      {
        body: mapUpdateLibraryPayloadToApi(payload),
      },
    );
    return mapManagedLibraryDetailResponse(raw);
  },

  async deleteLibrary(
    libraryId: string,
    payload: DangerousActionRequest = { confirmAction: "delete-library" },
  ): Promise<ManageActionResult> {
    const raw = await httpClient.delete<RawManageActionResult>(
      `/api/manage/libraries/${libraryId}`,
      {
        // CONFIRM-GATE-ALIGN：后端 `manage.libraries_delete` 要求 `?confirmed=true`。
        params: { confirmed: true },
        body: mapDangerousActionPayloadToApi(payload),
      },
    );
    return mapManageActionResult(raw);
  },

  async triggerLibraryScan(
    libraryId: string,
    payload: TriggerManageLibraryScanRequest = {},
  ): Promise<ManageScanTriggerResult> {
    const raw = await httpClient.post<RawManageScanTriggerResponse>(
      `/api/manage/libraries/${libraryId}/scan`,
      {
        body: {
          task_type: payload.taskType
            ? mapScanTaskTypeToApi(payload.taskType)
            : undefined,
        },
      },
    );
    return mapManageScanTriggerResponse(raw);
  },

  async getMounts(query?: ManageMountsQuery): Promise<ManageMountsResponse> {
    const raw = await httpClient.get<RawListResponse<RawManagedMountRecord>>(
      "/api/manage/mounts",
      {
        params: mapMountsQueryToParams(query),
      },
    );
    return {
      items: raw.items.map(mapManagedMountRecord),
    };
  },

  async getMountDetail(mountId: string): Promise<ManageMountDetailRecord> {
    const raw = await httpClient.get<RawManagedMountDetailResponse>(
      `/api/manage/mounts/${mountId}`,
    );
    return mapManagedMountDetailResponse(raw);
  },

  async createMount(
    payload: CreateManageMountRequest,
  ): Promise<ManageMountDetailRecord> {
    const raw = await httpClient.post<RawManagedMountDetailResponse>(
      "/api/manage/mounts",
      {
        body: mapCreateMountPayloadToApi(payload),
      },
    );
    return mapManagedMountDetailResponse(raw);
  },

  async browseMountDirectories(
    payload: BrowseManageMountDirectoriesRequest,
  ): Promise<ManageMountDirectoryBrowserResponse> {
    const raw = await httpClient.post<RawManagedMountDirectoryBrowserResponse>(
      "/api/manage/mounts/browse-directories",
      {
        body: {
          provider_type: mapProviderTypeToApi(payload.providerType),
          config_json: payload.configJson,
          path: payload.path,
        },
      },
    );
    return {
      currentPath: raw.current_path,
      parentPath: raw.parent_path ?? undefined,
      directories: raw.directories ?? [],
    };
  },

  async updateMount(
    mountId: string,
    payload: UpdateManageMountRequest,
  ): Promise<ManageMountDetailRecord> {
    const raw = await httpClient.patch<RawManagedMountDetailResponse>(
      `/api/manage/mounts/${mountId}`,
      {
        body: mapUpdateMountPayloadToApi(payload),
      },
    );
    return mapManagedMountDetailResponse(raw);
  },

  async deleteMount(
    mountId: string,
    payload: DangerousActionRequest = { confirmAction: "delete-mount" },
  ): Promise<ManageActionResult> {
    const raw = await httpClient.delete<RawManageActionResult>(
      `/api/manage/mounts/${mountId}`,
      {
        // CONFIRM-GATE-ALIGN：后端 `manage.mounts_delete` 要求 `?confirmed=true`。
        params: { confirmed: true },
        body: mapDangerousActionPayloadToApi(payload),
      },
    );
    return mapManageActionResult(raw);
  },

  async validateMount(mountId: string): Promise<ManageMountDetailRecord> {
    const raw = await httpClient.post<RawManagedMountDetailResponse>(
      `/api/manage/mounts/${mountId}/validate`,
    );
    return mapManagedMountDetailResponse(raw);
  },

  async refreshMountAccess(mountId: string): Promise<ManageMountDetailRecord> {
    const raw = await httpClient.post<RawManagedMountDetailResponse>(
      `/api/manage/mounts/${mountId}/refresh-access`,
    );
    return mapManagedMountDetailResponse(raw);
  },

  async getScans(query?: ManageScansQuery): Promise<ManageScansResponse> {
    const raw = await httpClient.get<RawListResponse<RawManagedScanTaskRecord>>(
      "/api/manage/scans",
      {
        params: mapScansQueryToParams(query),
      },
    );
    return {
      items: raw.items.map(mapManagedScanTaskRecord),
    };
  },

  async getProbeTasks(
    query?: ManageProbeTasksQuery,
  ): Promise<ManageProbeTasksResponse> {
    const raw = await httpClient.get<RawListResponse<RawManagedProbeTaskRecord>>(
      "/api/manage/probe-tasks",
      {
        params: mapProbeTasksQueryToParams(query),
      },
    );
    return {
      items: raw.items.map(mapManagedProbeTaskRecord),
    };
  },

  async getProbeTaskDetail(
    sourceId: string,
  ): Promise<ManageProbeTaskDetailRecord> {
    const raw = await httpClient.get<RawManagedProbeTaskDetailResponse>(
      `/api/manage/probe-tasks/${sourceId}`,
    );
    return mapManagedProbeTaskDetailResponse(raw);
  },

  async enqueueProbeTask(sourceId: string): Promise<ManageActionResult> {
    const raw = await httpClient.post<RawManageActionResult>(
      `/api/manage/probe-tasks/${sourceId}/enqueue`,
    );
    return mapManageActionResult(raw);
  },

  async refreshProbeTask(sourceId: string): Promise<ManageActionResult> {
    const raw = await httpClient.post<RawManageActionResult>(
      `/api/manage/probe-tasks/${sourceId}/refresh`,
    );
    return mapManageActionResult(raw);
  },
};

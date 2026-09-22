// Backend raw DTOs for the manage domain.
// These types reflect the shape of the JSON payloads returned from the
// backend before they are mapped to the frontend-facing models declared
// in `./types.ts`.

export interface RawListResponse<T> {
  items: T[];
  total: number;
}

export interface RawManageOverviewResponse {
  /** V2 wire 无此字段（跨仓缺口 X-2）：缺省 = UI 显示「—」，不得回落 "healthy"。 */
  environment_status?: string;
  refreshed_at: string;
  /** V2 OverviewDto 平铺真值（snake 直出）。 */
  total_items?: number;
  total_libraries?: number;
  total_mounts?: number;
  active_admin_count?: number;
  uptime_secs?: number;
  /** 老契约形状：V2 wire 不再提供（mapping 已按缺省处理）。 */
  kpis?: {
    total_libraries?: number;
    total_media_items?: number;
    movie_count?: number;
    series_count?: number;
    episode_count?: number;
    total_mounts?: number;
    remote_mounts?: number;
    healthy_remote_mounts?: number;
  };
  alerts?: {
    empty_libraries?: number;
    unreachable_mounts?: number;
    disabled_mounts?: number;
    unavailable_library_sources?: number;
    unavailable_source_summaries?: RawUnavailableLibrarySourceSummary[] | null;
  };
  recent_audit_logs?: RawAuditLogRecord[];
}

export interface RawUnavailableLibrarySourceSummary {
  library_source_id: string;
  library_id: string;
  library_name: string;
  mount_id: string;
  mount_name: string;
  sub_path: string;
  consecutive_unavailable_failures: number;
  last_failure_kind?: string | null;
  last_failure_message?: string | null;
  last_failure_at?: string | null;
  last_success_at?: string | null;
  hidden_at?: string | null;
  updated_at: string;
}

export interface RawManageSourceAvailabilityRecoverResponse {
  library_source_id: string;
  recovered: boolean;
  recovered_at: string;
}

export interface RawManagedUserRecord {
  id: string;
  username: string;
  display_name?: string | null;
  email?: string | null;
  account_kind?: string | null;
  status: string;
  roles: string[];
  source_grants?: RawManagedSourcePathGrantRecord[] | null;
  max_sessions?: number | null;
  max_concurrent_playbacks?: number | null;
  valid_until?: string | null;
  must_change_password?: boolean | null;
  created_at: string;
  updated_at: string;
  last_activity_at?: string | null;
  recent_client_info?: string | null;
}

export interface RawManageBatchUsersActionResponse {
  updated_count: number;
  results: RawManageActionResult[];
}

export interface RawManageBatchRegistrationCodeActionResponse {
  updated_count: number;
  results: RawManageActionResult[];
}

export interface RawRegistrationCodeRecord {
  id: string;
  batch_id: string;
  code: string;
  role_template: string;
  default_library_ids: string[];
  max_uses?: number | null;
  max_sessions?: number | null;
  valid_days?: number | null;
  used_count: number;
  expires_at?: string | null;
  allow_reactivation: boolean;
  require_approval: boolean;
  status: string;
  created_by: string;
  created_by_username?: string | null;
  created_by_display_name?: string | null;
  created_at: string;
}

export interface RawRegistrationCodeBatchRecord {
  id: string;
  name: string;
  kind: string;
  total_codes: number;
  available_codes: number;
  used_codes: number;
  disabled_codes: number;
  expired_codes: number;
  total_used_count: number;
  created_by: string;
  created_by_username?: string | null;
  created_by_display_name?: string | null;
  created_at: string;
  items: RawRegistrationCodeRecord[];
}

export interface RawRoleTemplateRecord {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  capabilities?: string[] | null;
  default_library_ids?: string[] | null;
  source_grants?: RawManagedSourcePathGrantRecord[] | null;
  default_max_sessions?: number | null;
  default_max_concurrent_playbacks?: number | null;
  default_valid_days?: number | null;
  is_system: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RawManagedSourcePathGrantRecord {
  mount_id: string;
  path_prefix: string;
  granted_at: string;
  granted_by?: string | null;
}

export interface RawManagedSourcePathPolicyRecord {
  id: string;
  mount_id: string;
  path_prefix: string;
  priority: number;
  max_concurrent_streams?: number | null;
  created_at: string;
  updated_at: string;
}

export interface RawNowPlayingInfo {
  media_id?: string;
  media_title?: string;
  episode_title?: string;
  poster_url?: string;
  progress_percent?: number;
  play_method?: "DirectPlay" | "DirectStream";
  bitrate_kbps?: number;
}

export interface RawManagedSessionRecord {
  id: string;
  user_id: string;
  username: string;
  display_name?: string | null;
  client_info?: string | null;
  ip_address?: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  last_activity_at: string;
  now_playing?: RawNowPlayingInfo | null;
}

export interface RawAuditLogRecord {
  id: string;
  user_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  action: string;
  summary: string;
  target_type?: string | null;
  target_id?: string | null;
  detail_json?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
}

export interface RawRuntimeLogRecord {
  id: string;
  timestamp: string;
  level: string;
  target?: string | null;
  message: string;
  request_id?: string | null;
  source_file: string;
  raw_line: string;
}

export interface RawManageRuntimeLogsResponse {
  items: RawRuntimeLogRecord[];
  total: number;
  truncated: boolean;
  log_dir: string;
  available_targets?: string[] | null;
}

export interface RawManagedLibraryRecord {
  id: string;
  name: string;
  description?: string | null;
  kind: string;
  type_label: string;
  item_count: number;
  total_items: number;
  status: string;
  visibility_label?: string | null;
  updated_at: string;
  last_scan_at?: string | null;
  sources: string[];
  actual_sources?: string[] | null;
}

export interface RawManagedMountRecord {
  id: string;
  name: string;
  mount_type: string;
  type_label: string;
  path: string;
  path_label: string;
  health_status: string;
  description?: string | null;
  status_message?: string | null;
  last_checked_at?: string | null;
  capabilities: string[];
  linked_libraries: Array<{ id: string; name: string }>;
  reference_counts?: RawManagedMountReferenceCounts | null;
  unavailable_binding_count?: number | null;
  note?: string | null;
  rate_config?: string | null;
  visibility_rule?: string | null;
  sidecar_nfo?: boolean | null;
  sidecar_subtitle?: boolean | null;
  sidecar_poster?: boolean | null;
}

export interface RawManagedMountHealthRecord {
  mount_id: string;
  name: string;
  provider_type: string;
  status: string;
  health_status: string;
  status_message: string | null;
  unavailable_binding_count: number | null;
  attention_binding_count: number | null;
  last_checked_at: number | null;
  last_fault_kind: string | null;
  last_fault_title: string | null;
  last_fault_action: string | null;
  last_fault_at: number | null;
}

export interface RawMountsHealthResponse {
  items: RawManagedMountHealthRecord[];
  total: number;
}

export interface RawManagedMountReferenceCounts {
  library_source_count: number;
  media_source_count: number;
  sidecar_asset_count: number;
}

export interface RawManagedStorageCapabilities {
  can_list: boolean;
  can_random_read: boolean;
  can_read_sidecar: boolean;
  can_generate_play_target: boolean;
  can_refresh_credentials: boolean;
}

export interface RawManagedLibrarySourceBindingRecord {
  id: string;
  mount_id: string;
  mount_name: string;
  mount_type: string;
  type_label: string;
  mount_status: string;
  sub_path: string;
  path_label: string;
  scan_priority: number;
  capabilities?: string[] | null;
}

export interface RawManagedLibraryGrantRecord {
  user_id: string;
  username: string;
  display_name?: string | null;
  granted_at: string;
  granted_by_user_id?: string | null;
  granted_by_username?: string | null;
  granted_by_display_name?: string | null;
}

export interface RawManagedScanTaskRecord {
  id: string;
  library_source_id: string;
  library_id: string;
  library_name: string;
  mount_id: string;
  mount_name: string;
  source_path: string;
  task_type: string;
  status: string;
  items_found: number;
  items_updated: number;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface RawManagedProbeTechnicalSummary {
  container?: string | null;
  duration_ticks?: number | null;
  bitrate?: number | null;
  width?: number | null;
  height?: number | null;
  video_codec?: string | null;
  audio_codec?: string | null;
  dynamic_range_label?: string | null;
  audio_track_count?: number | null;
  subtitle_count?: number | null;
  release_group?: string | null;
}

export interface RawManagedProbeTaskRecord {
  source_id: string;
  media_item_id: string;
  title: string;
  year?: number | null;
  library_id: string;
  library_name: string;
  mount_id: string;
  mount_name: string;
  provider_type: string;
  mount_status: string;
  availability_state: string;
  source_path: string;
  source_status: string;
  status: string;
  priority?: number | null;
  request_reason?: string | null;
  attempt_count: number;
  requested_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  next_retry_at?: string | null;
  last_error?: string | null;
  probed_at?: string | null;
  technical_summary?: RawManagedProbeTechnicalSummary | null;
}

export interface RawManagedProbeTaskStreamRecord {
  index?: number | null;
  codec_name?: string | null;
  codec_tag?: string | null;
  title?: string | null;
  language?: string | null;
  channels?: number | null;
  channel_layout?: string | null;
  width?: number | null;
  height?: number | null;
  profile?: string | null;
  bit_rate?: number | null;
  bit_depth?: number | null;
  pixel_format?: string | null;
  color_primaries?: string | null;
  color_space?: string | null;
  color_transfer?: string | null;
  aspect_ratio?: string | null;
  average_frame_rate?: number | null;
  real_frame_rate?: number | null;
  dynamic_range_label?: string | null;
  dv_version_major?: number | null;
  dv_version_minor?: number | null;
  dv_profile?: number | null;
  dv_level?: number | null;
  rpu_present_flag?: number | null;
  el_present_flag?: number | null;
  bl_present_flag?: number | null;
  dv_bl_signal_compatibility_id?: number | null;
  hdr10_plus_present_flag?: boolean | null;
  is_default?: boolean | null;
  is_forced?: boolean | null;
}

export interface RawManagedProbeTaskDetailResponse {
  task: RawManagedProbeTaskRecord;
  video_streams?: RawManagedProbeTaskStreamRecord[] | null;
  audio_streams?: RawManagedProbeTaskStreamRecord[] | null;
  subtitle_streams?: RawManagedProbeTaskStreamRecord[] | null;
}

export interface RawManagedLibraryDetailResponse {
  library: RawManagedLibraryRecord;
  source_bindings?: RawManagedLibrarySourceBindingRecord[] | null;
  access_grants?: RawManagedLibraryGrantRecord[] | null;
  recent_scan_tasks?: RawManagedScanTaskRecord[] | null;
}

export interface RawManagedMountLinkedSourceRecord {
  id: string;
  library_id: string;
  library_name: string;
  sub_path: string;
  scan_priority: number;
  created_at: string;
  availability_status: string;
  availability_message?: string | null;
  last_scan_task_status?: string | null;
  consecutive_unavailable_failures?: number | null;
  last_failure_at?: string | null;
  hidden_at?: string | null;
}

export interface RawManagedMountDetailResponse {
  mount: RawManagedMountRecord;
  provider_type: string;
  root_path: string;
  config_json?: Record<string, unknown> | null;
  capability_state: RawManagedStorageCapabilities;
  path_policies?: RawManagedSourcePathPolicyRecord[] | null;
  linked_sources?: RawManagedMountLinkedSourceRecord[] | null;
  recent_scan_tasks?: RawManagedScanTaskRecord[] | null;
}

export interface RawManagedMountDirectoryBrowserResponse {
  current_path: string;
  parent_path?: string | null;
  directories: Array<{
    name: string;
    path: string;
  }>;
}

/**
 * 库级扫描触发响应（FE-CONTRACT-DRIFT-CLOSE：不再复用挂载级 DTO 形状）。
 * 后端真 wire = `LibraryScanTriggerResponse`（http/state/scan_trigger.rs:104-112，
 * serde camelCase rename）：{ libraryId, tasks, skippedMountIds }。
 * 旧契约的 `task_type` / snake 形字段后端**不存在**（V2 单语义），删除。
 */
export interface RawManageLibraryScanTriggerResponse {
  libraryId: string;
  /** 该库每个挂载的任务结果（含 created 标志）。 */
  tasks: RawScanTriggerTask[];
  /** 因已有在途任务而未新建的挂载 id（幂等，非错误）。 */
  skippedMountIds: string[];
}

/** POST scan-trigger 的单挂载任务结果（对位 http/state/scan_trigger.rs:26-39）。 */
export interface RawScanTriggerTask {
  mountId: string;
  taskKey: string;
  taskId: string;
  created: boolean;
}

export interface RawManageActionResult {
  id: string;
  result: string;
  message: string;
}

export interface RawManageAdvancedResponse {
  refreshed_at: string;
  database: {
    total_users: number;
    total_sessions: number;
    total_registration_codes: number;
    total_audit_logs: number;
  };
  security: {
    admin_users: number;
    disabled_users: number;
    active_sessions: number;
    /** V2 无真值来源（吊销=物理 DELETE，无行可数）：wire 上可能省略。 */
    revoked_sessions?: number;
    expired_sessions: number;
    disabled_registration_codes: number;
  };
  settings: {
    registration_enabled: boolean;
    login_rate_limit_enabled: boolean;
    sensitive_action_confirmation: boolean;
    user_session_ttl_seconds: number;
    admin_session_ttl_seconds: number;
    token_rotation_enabled: boolean;
    /** 后端 MANAGE-ADVANCED 第 7 项（V1 逐字对位）；旧后端可能省略。 */
    compat_legacy_session_fallback_enabled?: boolean;
  };
}

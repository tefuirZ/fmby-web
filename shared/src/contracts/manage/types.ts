export type RiskLevel = "info" | "warning" | "critical";
export type UserStatus = "active" | "disabled" | "locked" | "pending";
export type ManageUserAccountKind = "human" | "service";
export type ManageUserRole =
  | "user"
  | "restricted_user"
  | "admin"
  | "super_admin";
export type RegistrationCodeStatus =
  | "active"
  | "paused"
  | "expired"
  | "used-up";
export type RegistrationCodeBatchMode = "single-use-batch" | "shared-code";
export type RoleTemplateStatus = "active" | "disabled";
export type SessionStatus = "active" | "idle" | "expired" | "revoked";
export type AuditResult = "success" | "warning" | "failure";
export type RuntimeLogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "unknown";
export type ManageLibraryType = "movie" | "series" | "music" | "mixed";
export type ManageMountProviderType =
  | "local"
  | "webdav"
  | "s3-compatible"
  | "alist"
  | "openlist"
  | "pan115";
export type ManageScanStatus = "pending" | "running" | "completed" | "failed";
export type ManageScanTaskType =
  | "full-scan"
  | "incremental-refresh"
  | "manual-refresh";
export type ManageProbeTaskStatus =
  | "idle"
  | "queued"
  | "running"
  | "retry-waiting"
  | "succeeded"
  | "failed";
export type ManageSourceAvailabilityState = "active" | "unavailable";

export interface ManageSourcePathGrantRecord {
  mountId: string;
  pathPrefix: string;
  grantedAt: string;
  grantedBy?: string;
}

export interface ManageSourcePathGrantInput {
  mountId: string;
  pathPrefix: string;
}

export interface ManageSourcePathPolicyRecord {
  id: string;
  mountId: string;
  pathPrefix: string;
  priority: number;
  maxConcurrentStreams?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManageSourcePathPolicyInput {
  id?: string;
  pathPrefix: string;
  priority: number;
  maxConcurrentStreams?: number;
}

export interface ManageKpi {
  key: string;
  label: string;
  value: number;
  trend?: string;
  status: "healthy" | "attention" | "critical";
}

export interface ManageTodoItem {
  id: string;
  title: string;
  description: string;
  level: RiskLevel;
}

export interface ManageQuickLink {
  id: string;
  label: string;
  description: string;
  to: string;
}

export interface ManageActivityItem {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
}

export interface ManageUnavailableSourceSummary {
  librarySourceId: string;
  libraryId: string;
  libraryName: string;
  mountId: string;
  mountName: string;
  subPath: string;
  consecutiveUnavailableFailures: number;
  lastFailureKind?: string;
  lastFailureMessage?: string;
  lastFailureAt?: string;
  lastSuccessAt?: string;
  hiddenAt?: string;
  updatedAt: string;
}

export interface ManageOverviewResponse {
  /** 后端 wire 无 environment_status（X-2 缺口）：缺省 = UI 显示「—」。 */
  environmentLabel?: string;
  environmentStatus?: "healthy" | "warning" | "critical";
  refreshedAt: string;
  primaryActionLabel?: string;
  kpis: ManageKpi[];
  todoItems: ManageTodoItem[];
  quickLinks: ManageQuickLink[];
  activities: ManageActivityItem[];
  unavailableLibrarySources: number;
  unavailableSourceSummaries: ManageUnavailableSourceSummary[];
}

export interface ManageSourceAvailabilityRecoverResponse {
  librarySourceId: string;
  recovered: boolean;
  recoveredAt: string;
}

export interface ManageUserRecord {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  accountKind: ManageUserAccountKind;
  roles: ManageUserRole[];
  roleLabel: string;
  status: UserStatus;
  libraryScopes: string[];
  sourceGrants: ManageSourcePathGrantRecord[];
  maxSessions?: number;
  maxConcurrentPlaybacks?: number;
  validUntil?: string;
  mustChangePassword: boolean;
  lastLoginAt?: string;
  lastDevice?: string;
  createdAt?: string;
  updatedAt?: string;
  recentClientInfo?: string;
}

export interface ManageUsersQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: UserStatus;
  accountKind?: ManageUserAccountKind;
}

export interface ManageUsersResponse {
  items: ManageUserRecord[];
  total: number;
}

export interface ManageUserDetailRecord extends ManageUserRecord {}

export interface CreateManageUserRequest {
  username: string;
  displayName?: string;
  email?: string;
  password: string;
  role: ManageUserRole;
  roleTemplateId?: string;
  status: UserStatus;
  accountKind?: ManageUserAccountKind;
  maxSessions?: number;
  validUntil?: string;
  maxConcurrentPlaybacks?: number;
  sourceGrants?: ManageSourcePathGrantInput[];
}

export interface UpdateManageUserRequest {
  displayName?: string | null;
  email?: string | null;
  status?: UserStatus;
  accountKind?: ManageUserAccountKind;
  role?: ManageUserRole;
  roleTemplateId?: string;
  maxSessions?: number | null;
  validUntil?: string | null;
  maxConcurrentPlaybacks?: number | null;
  sourceGrants?: ManageSourcePathGrantInput[];
  confirmAction?: string;
  sessionConfirmation?: string;
  currentPassword?: string;
}

export interface BatchDisableManageUsersRequest {
  userIds: string[];
  confirmAction?: string;
  sessionConfirmation?: string;
  currentPassword?: string;
}

export type BatchDeleteManageUsersRequest = BatchDisableManageUsersRequest;

export interface BatchUpdateManageUsersRequest {
  userIds: string[];
  status?: UserStatus;
  role?: ManageUserRole;
  sourceGrants?: ManageSourcePathGrantInput[];
  confirmAction?: string;
  sessionConfirmation?: string;
  currentPassword?: string;
}

export interface ManageBatchUsersActionResponse {
  updatedCount: number;
  results: ManageActionResult[];
}

export interface UpdateUserStatusRequest {
  status: UserStatus;
  confirmAction?: string;
  sessionConfirmation?: string;
  currentPassword?: string;
}

export interface ReviewUserRegistrationRequest {
  confirmAction?: string;
  sessionConfirmation?: string;
  currentPassword?: string;
}

export interface ResetUserPasswordRequest extends DangerousActionRequest {
  newPassword: string;
  forceChange?: boolean;
}

export interface ResetUserLoginRiskRequest extends DangerousActionRequest {}

export interface RegistrationCodeRecord {
  id: string;
  batchId: string;
  code: string;
  roleTemplate: ManageUserRole;
  roleTemplateLabel: string;
  status: RegistrationCodeStatus;
  usageCount: number;
  usageLimit: number;
  maxSessions?: number;
  validDays?: number;
  expiresAt?: string;
  defaultLibraries: string[];
  allowReactivation: boolean;
  requireApproval: boolean;
  createdById: string;
  createdByName?: string;
  createdAt: string;
}

export interface RegistrationCodeBatchRecord {
  id: string;
  name: string;
  mode: RegistrationCodeBatchMode;
  totalCodes: number;
  availableCodes: number;
  usedCodes: number;
  disabledCodes: number;
  expiredCodes: number;
  totalUsedCount: number;
  createdById: string;
  createdByName?: string;
  createdAt: string;
  items: RegistrationCodeRecord[];
}

export interface ManageRegistrationCodesResponse {
  items: RegistrationCodeBatchRecord[];
}

export interface CreateRegistrationCodeRequest {
  mode: RegistrationCodeBatchMode;
  batchName: string;
  generateCount?: number;
  code?: string;
  roleTemplate: ManageUserRole;
  usageLimit?: number;
  maxSessions?: number;
  validDays?: number;
  expiresAt?: string;
  defaultLibraries?: string[];
  allowReactivation?: boolean;
  requireApproval?: boolean;
}

export interface UpdateRegistrationCodeRequest {
  roleTemplate: ManageUserRole;
  usageLimit: number;
  maxSessions?: number;
  validDays?: number;
  expiresAt?: string;
  defaultLibraries?: string[];
  allowReactivation?: boolean;
  requireApproval?: boolean;
}

export interface UpdateRegistrationCodeBatchRequest {
  batchName: string;
  roleTemplate: ManageUserRole;
  code?: string;
  usageLimit?: number;
  maxSessions?: number;
  validDays?: number;
  expiresAt?: string;
  defaultLibraries?: string[];
  allowReactivation?: boolean;
  requireApproval?: boolean;
}

export interface UpdateRegistrationCodeStatusRequest {
  status: RegistrationCodeStatus;
  confirmAction?: string;
  sessionConfirmation?: string;
  currentPassword?: string;
}

export interface BatchDeleteRegistrationCodeBatchesRequest {
  batchIds: string[];
  confirmAction?: string;
  sessionConfirmation?: string;
  currentPassword?: string;
}

export interface ManageBatchRegistrationCodeActionResponse {
  updatedCount: number;
  results: ManageActionResult[];
}

export interface RoleTemplateRecord {
  id: string;
  code: string;
  name: string;
  description?: string;
  capabilities: string[];
  defaultLibraries: string[];
  sourceGrants: ManageSourcePathGrantRecord[];
  defaultMaxSessions?: number;
  defaultMaxConcurrentPlaybacks?: number;
  defaultValidDays?: number;
  isSystem: boolean;
  status: RoleTemplateStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ManageRoleTemplatesResponse {
  items: RoleTemplateRecord[];
}

export interface CreateRoleTemplateRequest {
  code: string;
  name: string;
  description?: string;
  defaultLibraries?: string[];
  sourceGrants?: ManageSourcePathGrantInput[];
  defaultMaxSessions?: number | null;
  defaultValidDays?: number | null;
}

export interface UpdateRoleTemplateRequest {
  name?: string;
  description?: string;
  defaultLibraries?: string[];
  sourceGrants?: ManageSourcePathGrantInput[];
  defaultMaxSessions?: number | null;
  defaultValidDays?: number | null;
}

export interface NowPlayingMediaInfo {
  mediaId: string;
  mediaTitle: string;
  episodeTitle?: string;
  posterUrl?: string;
  progressPercent?: number;
  playMethod?: "DirectPlay" | "DirectStream";
  bitrateKbps?: number;
}

export interface SessionRecord {
  id: string;
  userName: string;
  deviceName: string;
  clientName: string;
  clientHeader?: string;
  ipAddress?: string;
  status: SessionStatus;
  current: boolean;
  createdAt: string;
  lastActiveAt: string;
  nowPlaying?: NowPlayingMediaInfo;
}

export interface ManageSessionsResponse {
  items: SessionRecord[];
}

export interface AuditLogRecord {
  id: string;
  actorName: string;
  actionLabel: string;
  targetLabel: string;
  summary: string;
  result: AuditResult;
  createdAt: string;
  traceId?: string;
}

export interface ManageAuditLogsResponse {
  items: AuditLogRecord[];
}

export interface RuntimeLogRecord {
  id: string;
  timestamp: string;
  level: RuntimeLogLevel;
  target?: string;
  message: string;
  requestId?: string;
  sourceFile: string;
  rawLine: string;
}

export interface ManageRuntimeLogsQuery {
  page?: number;
  pageSize?: number;
  level?: RuntimeLogLevel;
  target?: string;
  search?: string;
  method?: string;
  path?: string;
  client?: string;
  ip?: string;
  requestId?: string;
  user?: string;
  all?: boolean;
}

export interface ManageRuntimeLogsResponse {
  items: RuntimeLogRecord[];
  total: number;
  truncated: boolean;
  logDir: string;
  availableTargets: string[];
}

export interface AdvancedSystemHealth {
  /**
   * 后端版本。**可能为 `undefined`**——后端 `/api/manage/advanced` 当前未提供该
   * 字段（契约仓 G-14，后端未实现），前端**不得**用占位值冒充真值。
   */
  version?: string;
  /**
   * 数据库健康状态。**可能为 `undefined`**：后端未提供该字段。
   *
   * 历史教训：此处曾硬编码 `"Healthy"`，导致后端数据库异常时前端仍显示健康
   * （静默失真）。缺字段时必须显示"—"，绝不回落任何"看起来正常"的字面量。
   */
  databaseStatus?: string;
  /** 队列积压。**可能为 `undefined`**：后端未提供该字段。 */
  queueDepth?: number;
  lastBackupAt?: string;
  configurationDrift?: string;
}

export interface AdvancedMaintenanceAction {
  id: string;
  title: string;
  description: string;
  impact: string;
  dangerous: boolean;
}

export interface ManageAdvancedResponse {
  health: AdvancedSystemHealth;
  riskItems: ManageTodoItem[];
  maintenanceActions: AdvancedMaintenanceAction[];
}

export interface ManageLibraryRecord {
  id: string;
  name: string;
  libraryType: ManageLibraryType;
  typeLabel: string;
  description?: string;
  itemCount: number;
  status: "healthy" | "attention" | "critical";
  visibilityLabel?: string;
  updatedAt?: string;
  lastScanAt?: string;
  sourceNames: string[];
  actualSourceNames: string[];
}

export interface ManageLibrariesResponse {
  items: ManageLibraryRecord[];
}

export interface ManageLibrariesQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  libraryType?: ManageLibraryType;
  mountId?: string;
}

export interface ManageStorageCapabilitiesState {
  canList: boolean;
  canRandomRead: boolean;
  canReadSidecar: boolean;
  canGeneratePlayTarget: boolean;
  canRefreshCredentials: boolean;
}

export interface ManageLibrarySourceBindingInput {
  id?: string;
  mountId: string;
  subPath: string;
  scanPriority: number;
}

export interface ManageLibrarySourceBindingRecord {
  id: string;
  mountId: string;
  mountName: string;
  mountType: string;
  typeLabel: string;
  mountStatus: string;
  subPath: string;
  pathLabel: string;
  scanPriority: number;
  capabilities: string[];
}

export interface ManageLibraryGrantRecord {
  userId: string;
  username: string;
  displayName?: string;
  grantedAt: string;
  grantedByUserId?: string;
  grantedByUsername?: string;
  grantedByDisplayName?: string;
}

export interface ManageScanTaskRecord {
  id: string;
  librarySourceId: string;
  libraryId: string;
  libraryName: string;
  mountId: string;
  mountName: string;
  sourcePath: string;
  taskType: ManageScanTaskType;
  status: ManageScanStatus;
  itemsFound: number;
  itemsUpdated: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface ManageScansResponse {
  items: ManageScanTaskRecord[];
}

export interface ManageProbeTechnicalSummary {
  container?: string;
  durationTicks?: number;
  bitrate?: number;
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
  dynamicRangeLabel?: string;
  audioTrackCount?: number;
  subtitleCount?: number;
  releaseGroup?: string;
}

export interface ManageProbeTaskStreamRecord {
  index?: number;
  codecName?: string;
  codecTag?: string;
  title?: string;
  language?: string;
  channels?: number;
  channelLayout?: string;
  width?: number;
  height?: number;
  profile?: string;
  bitRate?: number;
  bitDepth?: number;
  pixelFormat?: string;
  colorPrimaries?: string;
  colorSpace?: string;
  colorTransfer?: string;
  aspectRatio?: string;
  averageFrameRate?: number;
  realFrameRate?: number;
  dynamicRangeLabel?: string;
  dvVersionMajor?: number;
  dvVersionMinor?: number;
  dvProfile?: number;
  dvLevel?: number;
  rpuPresentFlag?: number;
  elPresentFlag?: number;
  blPresentFlag?: number;
  dvBlSignalCompatibilityId?: number;
  hdr10PlusPresentFlag?: boolean;
  isDefault: boolean;
  isForced: boolean;
}

export interface ManageProbeTaskRecord {
  sourceId: string;
  mediaItemId: string;
  title: string;
  year?: number;
  libraryId: string;
  libraryName: string;
  mountId: string;
  mountName: string;
  providerType: ManageMountProviderType;
  mountStatus: string;
  availabilityState: ManageSourceAvailabilityState;
  sourcePath: string;
  sourceStatus: string;
  status: ManageProbeTaskStatus;
  priority?: number;
  requestReason?: string;
  attemptCount: number;
  requestedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  nextRetryAt?: string;
  lastError?: string;
  probedAt?: string;
  technicalSummary?: ManageProbeTechnicalSummary;
}

export interface ManageProbeTaskDetailRecord {
  task: ManageProbeTaskRecord;
  videoStreams: ManageProbeTaskStreamRecord[];
  audioStreams: ManageProbeTaskStreamRecord[];
  subtitleStreams: ManageProbeTaskStreamRecord[];
}

export interface ManageProbeTasksQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ManageProbeTaskStatus;
  libraryId?: string;
  mountId?: string;
}

export interface ManageProbeTasksResponse {
  items: ManageProbeTaskRecord[];
}

export interface ManageLibraryDetailRecord {
  library: ManageLibraryRecord;
  sourceBindings: ManageLibrarySourceBindingRecord[];
  accessGrants: ManageLibraryGrantRecord[];
  recentScanTasks: ManageScanTaskRecord[];
}

export interface CreateManageLibraryRequest {
  name: string;
  libraryType: ManageLibraryType;
  description?: string;
  sourceBindings: ManageLibrarySourceBindingInput[];
  grantUserIds: string[];
}

export interface UpdateManageLibraryRequest {
  name?: string;
  libraryType?: ManageLibraryType;
  description?: string;
  replaceSourceBindings?: ManageLibrarySourceBindingInput[];
  replaceGrantUserIds?: string[];
}

export interface DangerousActionRequest {
  confirmAction: string;
  sessionConfirmation?: string;
  currentPassword?: string;
}

export interface ResetIpLoginRiskRequest extends DangerousActionRequest {
  ipAddress: string;
}

export interface TriggerManageLibraryScanRequest {
  taskType?: ManageScanTaskType;
}

export interface ManageScanTriggerResult {
  libraryId: string;
  taskType: ManageScanTaskType;
  tasks: ManageScanTaskRecord[];
  skippedSourceIds: string[];
}

export interface ManageMountLinkedLibrary {
  id: string;
  name: string;
}

export interface ManageMountReferenceCounts {
  librarySourceCount: number;
  mediaSourceCount: number;
  sidecarAssetCount: number;
}

export interface ManageMountRecord {
  id: string;
  name: string;
  mountType: ManageMountProviderType;
  typeLabel: string;
  path?: string;
  pathLabel: string;
  healthStatus: "healthy" | "attention" | "critical";
  description?: string;
  statusMessage?: string;
  lastCheckedAt?: string;
  capabilities: string[];
  linkedLibraries: ManageMountLinkedLibrary[];
  referenceCounts: ManageMountReferenceCounts;
  unavailableBindingCount: number;
}

export interface ManageMountsResponse {
  items: ManageMountRecord[];
}

export interface ManageMountsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  healthStatus?: string;
  providerType?: ManageMountProviderType;
  libraryId?: string;
}

export interface ManageMountLinkedSourceRecord {
  id: string;
  libraryId: string;
  libraryName: string;
  subPath: string;
  scanPriority: number;
  createdAt: string;
  availabilityStatus: "healthy" | "attention" | "critical";
  availabilityMessage?: string;
  lastScanTaskStatus?: string;
  consecutiveUnavailableFailures: number;
  lastFailureAt?: string;
  hiddenAt?: string;
}

export interface ManageMountDetailRecord {
  mount: ManageMountRecord;
  providerType: ManageMountProviderType;
  rootPath: string;
  configJson: Record<string, unknown>;
  capabilityState: ManageStorageCapabilitiesState;
  pathPolicies: ManageSourcePathPolicyRecord[];
  linkedSources: ManageMountLinkedSourceRecord[];
  recentScanTasks: ManageScanTaskRecord[];
}

export interface ManageMountDirectoryEntry {
  name: string;
  path: string;
}

export interface BrowseManageMountDirectoriesRequest {
  providerType: ManageMountProviderType;
  configJson: Record<string, unknown>;
  path?: string;
}

export interface ManageMountDirectoryBrowserResponse {
  currentPath: string;
  parentPath?: string;
  directories: ManageMountDirectoryEntry[];
}

export interface CreateManageMountRequest {
  name: string;
  providerType: ManageMountProviderType;
  rootPath: string;
  configJson?: Record<string, unknown>;
  status?: string;
  capabilities?: ManageStorageCapabilitiesState;
  pathPolicies?: ManageSourcePathPolicyInput[];
}

export interface UpdateManageMountRequest {
  name?: string;
  rootPath?: string;
  configJson?: Record<string, unknown>;
  status?: string;
  capabilities?: ManageStorageCapabilitiesState;
  pathPolicies?: ManageSourcePathPolicyInput[];
}

export interface ManageScansQuery {
  page?: number;
  pageSize?: number;
  status?: ManageScanStatus;
  taskType?: ManageScanTaskType;
  libraryId?: string;
  mountId?: string;
  librarySourceId?: string;
}

export interface ManageActionResult {
  id: string;
  result: string;
  message: string;
}

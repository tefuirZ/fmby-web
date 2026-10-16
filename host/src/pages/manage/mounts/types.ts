import type {
  ManageSourcePathPolicyInput,
  ManageMountProviderType,
  ManageStorageCapabilitiesState,
} from '@fmby/v2-shared/contracts/manage';

export type MountHealthStatus = 'healthy' | 'attention' | 'critical';
export type MountDrawerMode = 'create' | 'view' | 'edit';
export type MountRemoteAuthMode = 'username-password' | 'token';

export interface MountDrawerState {
  mode: MountDrawerMode;
  mountId?: string;
}

export interface MountRemoteConfigState {
  endpoint: string;
  authMode: MountRemoteAuthMode;
  username: string;
  password: string;
  token: string;
  otpCode: string;
  /** S3：桶名（必填，WEBDAV-S3-ENABLE §3.1）。 */
  bucket: string;
  /** S3：区域（可选）。 */
  region: string;
  /** S3：对象 key 前缀（写入 root_path，不进 config_json）。 */
  prefix: string;
  /** S3：Access Key（敏感键，见 formUtils 的 MOUNT-CRED-SEAL 注释）。 */
  accessKey: string;
  /** S3：Secret Key（敏感键，同上）。 */
  secretKey: string;
  // ── MOUNT-CRED-SEAL：编辑态凭据「留空则不修改」的记忆位 ──────────────────
  // 后端 Detail 回显的是 `__sealed:` 引用（绝不回明文）。编辑时把引用存这里、
  // 输入框留空展示「已配置」；保存时若用户未重填，则**原样回传引用**
  // （Update 语义 = 不改凭据）。PATCH 是整表替换，省略该键会丢凭据，故必须回传。
  passwordSealedRef?: string | null;
  tokenSealedRef?: string | null;
  accessKeySealedRef?: string | null;
  secretKeySealedRef?: string | null;
}

export interface MountFormErrors {
  name?: string;
  rootPath?: string;
  configJsonText?: string;
  /** FE-MOUNT-CONFIG-UI：速率/可见性 JSON 文本校验（非法拦截，不崩保存）。 */
  rateConfigText?: string;
  visibilityRuleText?: string;
  endpoint?: string;
  username?: string;
  password?: string;
  token?: string;
  browse?: string;
  /** S3 bucket 缺失（后端具名错误码同口径）。 */
  bucket?: string;
  /** 敏感输入框误填 `__sealed:` 引用（§3.3③ 防御）。 */
  accessKey?: string;
  secretKey?: string;
}

export interface MountFormState {
  name: string;
  providerType: ManageMountProviderType;
  rootPath: string;
  capabilities: ManageStorageCapabilitiesState;
  pathPolicies: ManageSourcePathPolicyInput[];
  configJsonText: string;
  remoteConfig: MountRemoteConfigState;
  preservedConfig: Record<string, unknown>;
  /** 以下四项为 DATASOURCE-CRUD-BACKFILL-UI 旧值回填：编辑时必须预填旧数值。 */
  note: string;
  rateConfigText: string;
  visibilityRuleText: string;
  sidecarNfo: boolean;
  sidecarSubtitle: boolean;
  sidecarPoster: boolean;
}

export interface PendingMountDeleteState {
  mountId: string;
  mountName: string;
  pathLabel: string;
  linkedLibraryCount: number;
  librarySourceCount: number;
  mediaSourceCount: number;
  sidecarAssetCount: number;
}

/**
 * FE-SOURCE-TYPES-CONSOLIDATE：**云盘账号**类数据源的入口。
 *
 * 用户裁定（原话）：「139、微软网盘等**不要在侧边栏**，应该**全部集成到"添加数据源"的数据源类型下拉选择**中」。
 * 故这些入口从侧栏收起，改为「添加媒体来源」抽屉「来源类型」下拉里的**独立一组**。
 *
 * 为什么单列一组、且**不是** `ManageMountProviderType`：它们**不是挂载类型** ——
 * 139 / 微软 / 115 分享 各有自己的页面与流程（凭据 / OAuth / 分享同步），
 * 选中后应**进入原流程**（页面未删，仅入口组织变化）。混进挂载类型会误导表单状态机。
 * 未授权实例上的「需要授权」语义**完全沿用原页面**（`ManagePaidFeatureGuard`）——
 * 本组只负责把用户送到那里，绝不绕过付费守卫。
 */
export const CLOUD_SOURCE_LINKS: Array<{ value: string; label: string; to: string }> = [
  { value: '__cloud:yun139', label: '139 云盘', to: '/manage/media/yun139' },
  { value: '__cloud:microsoft', label: '微软账号（OneDrive / SharePoint）', to: '/manage/media/microsoft' },
  { value: '__cloud:pan115-share', label: '115 分享与同步', to: '/manage/media/pan115-share' },
];

/** 导航型条目的 value 前缀（与 `PROVIDER_OPTIONS` 的值域互不相交）。 */
export const CLOUD_SOURCE_VALUE_PREFIX = '__cloud:';

export const PROVIDER_OPTIONS: Array<{ value: ManageMountProviderType; label: string }> = [
  { value: 'local', label: 'Local' },
  { value: 'webdav', label: 'WebDAV' },
  { value: 's3-compatible', label: 'S3 Compatible' },
  { value: 'alist', label: 'AList' },
  { value: 'openlist', label: 'OpenList' },
  { value: 'pan115', label: '115 网盘' },
];

export const CAPABILITY_OPTIONS: Array<{
  key: keyof ManageStorageCapabilitiesState;
  label: string;
  description: string;
}> = [
  { key: 'canList', label: '列目录', description: '允许列出挂载根路径下的目录结构。' },
  { key: 'canRandomRead', label: '随机读取', description: '支持 Range 或分段读取。' },
  { key: 'canReadSidecar', label: '读取旁路资源', description: '允许读取字幕、NFO、海报等附属资源。' },
  { key: 'canGeneratePlayTarget', label: '生成播放目标', description: '可以为播放链路生成有效播放地址。' },
  { key: 'canRefreshCredentials', label: '刷新凭据', description: '支持刷新上游访问凭据或令牌。' },
];

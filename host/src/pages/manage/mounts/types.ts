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

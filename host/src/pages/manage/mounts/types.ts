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

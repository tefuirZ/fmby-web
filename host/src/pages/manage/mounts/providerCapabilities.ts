/**
 * mounts provider 分类、能力默认值与 provider-keyed 文案（FE-MOUNT-AGGREGATE 拆分）。
 * 纯函数，无取数、无副作用。
 */

import type {
  ManageMountDetailRecord,
  ManageMountProviderType,
  ManageStorageCapabilitiesState,
} from '@fmby/v2-shared/contracts/manage';

export function isStructuredRemoteProvider(providerType: ManageMountProviderType) {
  return providerType === 'alist' || providerType === 'openlist';
}

/** WebDAV（WEBDAV-S3-FE）。 */
export function isWebDavProvider(providerType: ManageMountProviderType) {
  return providerType === 'webdav';
}

/** S3 兼容（WEBDAV-S3-FE）。 */
export function isS3Provider(providerType: ManageMountProviderType) {
  return providerType === 's3-compatible';
}

/** 是否走「结构化字段表单」（AList/OpenList + WebDAV + S3），否则回落到 config_json 手填。 */
export function isStructuredConfigProvider(providerType: ManageMountProviderType) {
  return isStructuredRemoteProvider(providerType) || isWebDavProvider(providerType) || isS3Provider(providerType);
}

export function supportsDirectoryBrowser(providerType: ManageMountProviderType) {
  return (
    providerType === 'local' ||
    isStructuredRemoteProvider(providerType) ||
    isWebDavProvider(providerType) ||
    isS3Provider(providerType)
  );
}

export function canValidateMount(detail: ManageMountDetailRecord) {
  return canValidateMountType(detail.providerType);
}

export function canValidateMountType(providerType: ManageMountProviderType) {
  return providerType === 'local' || providerType === 'alist' || providerType === 'openlist';
}

export function defaultMountCapabilities(providerType: ManageMountProviderType): ManageStorageCapabilitiesState {
  if (providerType === 'local') {
    return {
      canList: true,
      canRandomRead: true,
      canReadSidecar: true,
      canGeneratePlayTarget: true,
      canRefreshCredentials: false,
    };
  }

  if (providerType === 'alist' || providerType === 'openlist') {
    return {
      canList: true,
      canRandomRead: false,
      canReadSidecar: true,
      canGeneratePlayTarget: true,
      canRefreshCredentials: false,
    };
  }

  return {
    canList: false,
    canRandomRead: false,
    canReadSidecar: false,
    canGeneratePlayTarget: false,
    canRefreshCredentials: false,
  };
}

export function getDirectoryBrowserDescription(providerType: ManageMountProviderType) {
  switch (providerType) {
    case 'local':
      return 'Local 路径请直接从本机目录中选择，优先使用盘符和目录浏览，不再依赖手填。';
    case 'alist':
      return 'AList 路径请直接从远端目录里选择，不再手动输入。';
    case 'webdav':
      return 'WebDAV 根路径请直接从远端目录里选择，归一为 / 前缀。';
    case 's3-compatible':
      return 'S3 前缀请直接从远端目录里选择，归一为无前导 /。';
    default:
      return 'OpenList 路径请直接从远端目录里选择。';
  }
}

export function getDirectoryBrowserHint(providerType: ManageMountProviderType) {
  switch (providerType) {
    case 'local':
      return '点击“加载目录”后可先选择盘符，再逐级进入目录；目录选择后会自动写回根路径字段。';
    case 'alist':
    case 'openlist':
      return '先填好服务地址；如果上游要求认证，再补充账号密码或 token。目录选择后会自动写回根路径字段。';
    default:
      return '目录选择后会自动写回根路径字段。';
  }
}

export function getRootPathReadonlyHint(providerType: ManageMountProviderType) {
  switch (providerType) {
    case 'local':
      return 'Local 路径建议通过目录浏览器选择，避免盘符或权限路径手工输入出错。';
    case 'alist':
    case 'openlist':
      return 'AList / OpenList 路径必须通过目录浏览器选择。';
    default:
      return '请通过目录浏览器选择根路径。';
  }
}

export function getProviderHint(providerType: ManageMountProviderType) {
  switch (providerType) {
    case 'local':
      return 'Local 来源使用本机绝对路径；config_json 通常留空。';
    case 'webdav':
      return 'WebDAV 走结构化配置：服务地址 + 可选用户名密码 + 目录浏览器选择根路径（归一为 / 前缀）。';
    case 's3-compatible':
      return 'S3 兼容来源走结构化配置：服务地址 + bucket（必填）+ 可选 region/凭证 + 目录浏览器选择 key 前缀（无前导 /）。';
    case 'alist':
      return 'AList 改为结构化配置：服务地址 + 认证方式 + 目录浏览器选择路径。';
    default:
      return 'OpenList 改为结构化配置：服务地址 + 认证方式 + 目录浏览器选择路径。';
  }
}

export function getRootPathPlaceholder(providerType: ManageMountProviderType) {
  switch (providerType) {
    case 'local':
      return '例如：E:\\Media\\Movies';
    case 'webdav':
      return '例如：/dav/media（归一为 / 前缀）';
    case 's3-compatible':
      return '例如：media/movies（归一为无前导 /）';
    case 'alist':
      return '例如：/movies';
    default:
      return '例如：/library';
  }
}

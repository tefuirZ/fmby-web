import type {
  CreateManageMountRequest,
  ManageMountDetailRecord,
  ManageMountRecord,
  ManageMountProviderType,
  ManageStorageCapabilitiesState,
} from '@fmby/v2-shared/contracts/manage';
import type {
  MountDrawerMode,
  MountDrawerState,
  MountFormErrors,
  MountFormState,
  MountHealthStatus,
  PendingMountDeleteState,
  MountRemoteAuthMode,
  MountRemoteConfigState,
} from './types';

const REMOTE_CONFIG_KNOWN_KEYS = [
  'endpoint',
  'base_url',
  'baseUrl',
  'server',
  'url',
  'username',
  'password',
  'token',
  'access_token',
  'accessToken',
  'otp_code',
  'otpCode',
] as const;

export function createEmptyMountForm(): MountFormState {
  return {
    name: '',
    providerType: 'local',
    rootPath: '',
    capabilities: defaultMountCapabilities('local'),
    pathPolicies: [],
    configJsonText: '{}',
    remoteConfig: createEmptyRemoteConfig(),
    preservedConfig: {},
  };
}

export function createEmptyRemoteConfig(): MountRemoteConfigState {
  return {
    endpoint: '',
    authMode: 'username-password',
    username: '',
    password: '',
    token: '',
    otpCode: '',
    bucket: '',
    region: '',
    prefix: '',
    accessKey: '',
    secretKey: '',
  };
}

export function buildMountFormState(detail: ManageMountDetailRecord): MountFormState {
  const configJson = detail.configJson ?? {};
  const { remoteConfig, preservedConfig } = extractRemoteConfigState(configJson);

  return {
    name: detail.mount.name,
    providerType: detail.providerType,
    rootPath: detail.rootPath,
    capabilities: detail.capabilityState,
    pathPolicies: (detail.pathPolicies ?? []).map((policy) => ({
      id: policy.id,
      pathPrefix: policy.pathPrefix,
      priority: policy.priority,
      maxConcurrentStreams: policy.maxConcurrentStreams,
    })),
    configJsonText: JSON.stringify(configJson, null, 2),
    // S3：root_path 即对象 key 前缀（后端 validate_root_path 把 root_path 当
    // prefix 归一），故以它回填 prefix，保证「显示即实际」（否则编辑态前缀框
    // 为空、实际有前缀，改一次就可能把它覆盖掉）。
    remoteConfig: isS3Provider(detail.providerType)
      ? { ...remoteConfig, prefix: detail.rootPath ?? '' }
      : remoteConfig,
    preservedConfig,
  };
}

export function buildCreateMountPayload(form: MountFormState): CreateManageMountRequest {
  return {
    name: form.name.trim(),
    providerType: form.providerType,
    rootPath: normalizeMountRootPath(form),
    configJson: buildMountConfigObject(form),
    capabilities: form.capabilities,
    pathPolicies: form.pathPolicies,
  };
}

export function buildUpdateMountPayload(form: MountFormState) {
  return {
    name: form.name.trim(),
    rootPath: normalizeMountRootPath(form),
    configJson: buildMountConfigObject(form),
    capabilities: form.capabilities,
    pathPolicies: form.pathPolicies,
  };
}

export function buildMountConfigObject(form: MountFormState) {
  if (isStructuredRemoteProvider(form.providerType)) {
    return buildStructuredRemoteConfig(form);
  }
  if (isWebDavProvider(form.providerType) || isS3Provider(form.providerType)) {
    return buildWebDavS3Config(form);
  }
  return parseConfigJson(form.configJsonText);
}

/**
 * root_path 归一分派（WEBDAV-S3-ENABLE §3.2）：
 * AList/OpenList 与 WebDAV → `/`-prefixed；S3 → 无前导 `/`；其余原样。
 */
function normalizeMountRootPath(form: MountFormState) {
  if (isStructuredRemoteProvider(form.providerType)) {
    return normalizeRemoteMountPath(form.rootPath);
  }
  if (isWebDavProvider(form.providerType) || isS3Provider(form.providerType)) {
    // S3 的「prefix」即 root_path（对象 key 前缀），二者同源不同名。
    const raw = isS3Provider(form.providerType) && form.remoteConfig.prefix.trim() !== ''
      ? form.remoteConfig.prefix
      : form.rootPath;
    return normalizeWebDavS3RootPath(form.providerType, raw);
  }
  return form.rootPath.trim();
}

export function buildStructuredRemoteConfig(form: MountFormState): Record<string, unknown> {
  const next: Record<string, unknown> = { ...form.preservedConfig };
  for (const key of REMOTE_CONFIG_KNOWN_KEYS) {
    delete next[key];
  }

  next.endpoint = form.remoteConfig.endpoint.trim();
  if (form.remoteConfig.authMode === 'token') {
    if (form.remoteConfig.token.trim() !== '') {
      next.token = form.remoteConfig.token.trim();
    }
  } else {
    if (form.remoteConfig.username.trim() !== '' && form.remoteConfig.password.trim() !== '') {
      next.username = form.remoteConfig.username.trim();
      next.password = form.remoteConfig.password.trim();
    }
    if (form.remoteConfig.otpCode.trim() !== '') {
      next.otp_code = form.remoteConfig.otpCode.trim();
    }
  }

  return next;
}

export function extractRemoteConfigState(configJson: Record<string, unknown>) {
  const endpoint =
    readConfigString(configJson, ['endpoint', 'base_url', 'baseUrl', 'server', 'url']) ?? '';
  const token = readConfigString(configJson, ['token', 'access_token', 'accessToken']) ?? '';
  const username = readConfigString(configJson, ['username']) ?? '';
  const password = readConfigString(configJson, ['password']) ?? '';
  const otpCode = readConfigString(configJson, ['otp_code', 'otpCode']) ?? '';

  const preservedConfig = Object.fromEntries(
    Object.entries(configJson).filter(
      ([key]) => !REMOTE_CONFIG_KNOWN_KEYS.includes(key as (typeof REMOTE_CONFIG_KNOWN_KEYS)[number]),
    ),
  );

  const bucket = readConfigString(configJson, ['bucket']) ?? '';
  const region = readConfigString(configJson, ['region']) ?? '';
  const accessKey = readConfigString(configJson, ['access_key', 'accessKey']) ?? '';
  const secretKey = readConfigString(configJson, ['secret_key', 'secretKey']) ?? '';

  return {
    remoteConfig: {
      endpoint,
      authMode: token !== '' ? 'token' : 'username-password',
      username,
      password,
      token,
      otpCode,
      bucket,
      region,
      // 编辑态：S3 的 root_path 即 key 前缀，回填进 prefix 供表单展示。
      prefix: '',
      accessKey,
      secretKey,
    } satisfies MountRemoteConfigState,
    preservedConfig,
  };
}

export function readConfigString(configJson: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = configJson[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }
  return undefined;
}

export function parseConfigJson(value: string) {
  const trimmed = value.trim();
  if (trimmed === '') {
    return {};
  }
  return JSON.parse(trimmed) as Record<string, unknown>;
}

export function validateMountForm(form: MountFormState): MountFormErrors {
  const errors: MountFormErrors = {};

  if (form.name.trim() === '') {
    errors.name = '数据源名称不能为空。';
  }

  if (isWebDavProvider(form.providerType) || isS3Provider(form.providerType)) {
    return { ...errors, ...validateWebDavS3Form(form) };
  }

  if (isStructuredRemoteProvider(form.providerType)) {
    const normalizedRootPath = normalizeRemoteMountPath(form.rootPath);
    if (normalizedRootPath === '') {
      errors.rootPath = hasParentTraversalSegment(form.rootPath)
        ? '根路径禁止包含「..」段（防路径穿越）。'
        : '请先通过目录浏览器选择远端根路径。';
    }

    if (!isValidHttpUrl(form.remoteConfig.endpoint)) {
      errors.endpoint = '服务地址必须是合法的 http/https URL。';
    }

    if (form.remoteConfig.authMode === 'token') {
      // Token 允许留空，表示以游客方式访问上游。
    } else {
      const username = form.remoteConfig.username.trim();
      const password = form.remoteConfig.password.trim();
      if ((username === '' && password !== '') || (username !== '' && password === '')) {
        errors.username = '如果使用账号密码，用户名和密码必须同时填写。';
        errors.password = '如果使用账号密码，用户名和密码必须同时填写。';
      }
    }

    return errors;
  }

  if (form.rootPath.trim() === '') {
    errors.rootPath = '数据源根路径不能为空。';
  } else if (form.providerType === 'local' && !/^(?:[A-Za-z]:\\|\\\\|\/)/.test(form.rootPath.trim())) {
    errors.rootPath = '本地数据源根路径必须是绝对路径。';
  }

  try {
    parseConfigJson(form.configJsonText);
  } catch {
    errors.configJsonText = 'config_json 必须是合法 JSON。';
  }

  return errors;
}

export function validateDirectoryBrowser(form: MountFormState): MountFormErrors {
  const errors: MountFormErrors = {};
  if (!supportsDirectoryBrowser(form.providerType)) {
    errors.browse = '当前来源类型不支持目录浏览器。';
    return errors;
  }
  if (isWebDavProvider(form.providerType) || isS3Provider(form.providerType)) {
    if (!isValidHttpUrl(form.remoteConfig.endpoint)) {
      errors.endpoint = '请先填写合法的服务地址。';
    }
    if (isS3Provider(form.providerType) && form.remoteConfig.bucket.trim() === '') {
      errors.bucket = '先填写 bucket 再浏览目录。';
    }
    return errors;
  }
  if (!isStructuredRemoteProvider(form.providerType)) {
    return errors;
  }
  if (!isValidHttpUrl(form.remoteConfig.endpoint)) {
    errors.endpoint = '请先填写合法的服务地址。';
  }
  if (form.remoteConfig.authMode === 'token') {
    return errors;
  }

  const username = form.remoteConfig.username.trim();
  const password = form.remoteConfig.password.trim();
  if ((username === '' && password !== '') || (username !== '' && password === '')) {
    errors.username = '如果使用账号密码，用户名和密码必须同时填写。';
    errors.password = '如果使用账号密码，用户名和密码必须同时填写。';
  }
  return errors;
}

/**
 * WebDAV / S3 的 config_json（WEBDAV-S3-ENABLE §3.1，与 adapter 解析端同口径）：
 * - WebDAV 必填 `url`（别名 endpoint/base_url/baseUrl 四者任一），凭据可选（匿名合法）；
 * - S3 必填 `endpoint`（别名 base_url/baseUrl）+ `bucket`，region/AK/SK 可选。
 *
 * ⚠️ 凭据字段（password / access_key / secret_key）属后端敏感键
 * （`ConfigJsonValue::validate` 敏感名单）。当前前端**无密封端点**可取
 * `__sealed:` 引用，故此处按明文提交，**依赖后端 MOUNT-CRED-SEAL 卡在
 * bridge 侧密封后落库**（入站收明文 → 落库密文 → 回显 `__sealed:<key>`）。
 * 该卡未落地前，带凭据创建会被后端 400 拒绝。
 */
export function buildWebDavS3Config(form: MountFormState): Record<string, unknown> {
  const next: Record<string, unknown> = { ...form.preservedConfig };
  for (const key of REMOTE_CONFIG_KNOWN_KEYS) {
    delete next[key];
  }
  if (isWebDavProvider(form.providerType)) {
    next.url = form.remoteConfig.endpoint.trim();
    if (form.remoteConfig.username.trim() !== '') next.username = form.remoteConfig.username.trim();
    if (form.remoteConfig.password !== '') next.password = form.remoteConfig.password;
    return next;
  }
  next.endpoint = form.remoteConfig.endpoint.trim();
  next.bucket = form.remoteConfig.bucket.trim();
  if (form.remoteConfig.region.trim() !== '') next.region = form.remoteConfig.region.trim();
  if (form.remoteConfig.accessKey !== '') next.access_key = form.remoteConfig.accessKey;
  if (form.remoteConfig.secretKey !== '') next.secret_key = form.remoteConfig.secretKey;
  return next;
}

/** 必填字段级校验（缺 url / bucket → 具名错误，后端已补具名错误码，前端同口径提示）。 */
export function validateWebDavS3Form(form: MountFormState): MountFormErrors {
  const errors: MountFormErrors = {};
  if (isWebDavProvider(form.providerType) || isS3Provider(form.providerType)) {
    if (normalizeWebDavS3RootPath(form.providerType, form.rootPath) === '') {
      errors.rootPath = '根路径禁止包含「..」段（防路径穿越）。';
    }
    if (!isValidHttpUrl(form.remoteConfig.endpoint)) {
      errors.endpoint = '服务地址必须是合法的 http/https URL。';
      return errors;
    }
    if (isS3Provider(form.providerType) && form.remoteConfig.bucket.trim() === '') {
      errors.bucket = 'S3 兼容来源必须填写 bucket。';
    }
  }
  return errors;
}

export function shouldConfirmRemoteAuthModeSwitch(
  drawerMode: MountDrawerMode | undefined,
  detail: ManageMountDetailRecord | undefined,
  form: MountFormState,
  nextMode: MountRemoteAuthMode,
) {
  if (drawerMode !== 'edit' || !detail || !isStructuredRemoteProvider(form.providerType)) {
    return false;
  }
  if (form.remoteConfig.authMode === nextMode) {
    return false;
  }

  const config = detail.configJson ?? {};
  if (form.remoteConfig.authMode === 'token') {
    return readConfigString(config, ['token', 'access_token', 'accessToken']) !== undefined;
  }

  return (
    readConfigString(config, ['username']) !== undefined ||
    readConfigString(config, ['password']) !== undefined ||
    readConfigString(config, ['otp_code', 'otpCode']) !== undefined
  );
}

export function buildAuthModeChangeImpact(
  detail: ManageMountDetailRecord | undefined,
  currentMode: MountRemoteAuthMode,
  nextMode: MountRemoteAuthMode | null,
) {
  if (!detail || !nextMode) {
    return undefined;
  }

  const currentLabel = currentMode === 'token' ? 'Token' : '账号密码';
  const nextLabel = nextMode === 'token' ? 'Token' : '账号密码';
  return `当前已保存的 ${currentLabel} 凭据会在下次保存时被 ${nextLabel} 覆盖。`;
}

export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** 是否含 `..` 段（路径穿越防线）。 */
export function hasParentTraversalSegment(value: string) {
  return value.trim().replace(/\\/g, '/').split('/').includes('..');
}

/**
 * AList / OpenList / RcloneRc 的 root_path 归一（`-` 前缀）。
 *
 * **含 `..` 段返回空串（拒绝，不静默剔除）**——后端 `validate_root_path` 对
 * 这些类型一律拒 `..`，静默改写成 `/a/b` 会让用户以为填的值被接受（RB-4 禁假成功）。
 *
 * 存量兼容性：后端 create 与 PATCH **都**过 `validate_root_path`
 * （`application/src/manage.rs:212` / `:362`），故存量挂载的 root_path
 * **不可能含 `..`** —— 改报错无存量风险。读路径（如切换 provider 时回填）仍
 * 用 `|| '/'` 兜底，属防御性容忍，不影响写入侧报错。
 */
export function normalizeRemoteMountPath(value: string) {
  const trimmed = value.trim().replace(/\\/g, '/');
  if (trimmed === '') {
    return '';
  }
  if (hasParentTraversalSegment(trimmed)) {
    return '';
  }

  const segments = trimmed
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.');

  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

export function supportsDirectoryBrowser(providerType: ManageMountProviderType) {
  return (
    providerType === 'local' ||
    isStructuredRemoteProvider(providerType) ||
    isWebDavProvider(providerType) ||
    isS3Provider(providerType)
  );
}

/**
 * 115 凭据缺失/失效时的统一引导文案。
 *
 * 凭据面（Pan115CredentialsSection）与目录浏览面（Pan115DirectoryBrowserSection）共用，
 * 避免同一引导在多处分叉（frontend-dupes 闸）。
 */
export const PAN115_CREDENTIAL_HINT =
  '尚未绑定 115 账号或登录态已失效，请先在「115 网盘凭据」卡片完成扫码绑定后再操作。';

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

/**
 * root_path 归一（WEBDAV-S3-ENABLE §3.2）：
 * - 两类都禁 `..` 段（对齐 AList/OpenList 既有口径）；
 * - WebDAV → `/`-prefixed（URL 路径语义）；
 * - S3 → 无前导 `/`（对象 key 前缀语义）；
 * - 空根 → `/`。
 */
export function normalizeWebDavS3RootPath(providerType: ManageMountProviderType, value: string) {
  const trimmed = value.trim().replace(/\\/g, '/');
  // §3.2：空根 → `/`（两类同）。
  if (trimmed === '') return '/';
  // §3.2：含 `..` 段 → 返回空串（调用方据此报字段级错误「禁止 .. 段」）。
  // 不静默剔除：后端会 400，静默改写会让用户以为填的值被接受（RB-4 / 不伪造）。
  if (trimmed.split('/').includes('..')) return '';
  const segments = trimmed.split('/').filter((segment) => segment !== '' && segment !== '.');
  if (segments.length === 0) return '/';
  return isS3Provider(providerType)
    ? segments.join('/')
    : `/${segments.join('/')}`;
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

export function getMountStatusLabel(status: MountHealthStatus) {
  switch (status) {
    case 'healthy':
      return '正常';
    case 'critical':
      return '异常';
    default:
      return '需关注';
  }
}

export function getMountDrawerTitle(drawerState: MountDrawerState | null, detail?: ManageMountDetailRecord) {
  if (!drawerState) {
    return '数据源';
  }

  if (drawerState.mode === 'create') {
    return '新建数据源';
  }

  if (drawerState.mode === 'edit') {
    return detail?.mount.name ? `编辑：${detail.mount.name}` : '编辑数据源';
  }

  return detail?.mount.name || '数据源详情';
}

export function getMountDrawerDescription(drawerState: MountDrawerState | null) {
  if (!drawerState) {
    return undefined;
  }

  if (drawerState.mode === 'create') {
    return '创建来源时可配置能力声明；AList / OpenList 会直接走结构化配置和目录浏览器。';
  }

  if (drawerState.mode === 'edit') {
    return '保存后会整体更新根路径、能力声明与 config_json。AList / OpenList 路径改为目录浏览器选择。';
  }

  return '查看来源详情、能力状态、关联媒体库与校验动作。';
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

export function canValidateMount(detail: ManageMountDetailRecord) {
  return canValidateMountType(detail.providerType);
}

export function canValidateMountType(providerType: ManageMountProviderType) {
  return providerType === 'local' || providerType === 'alist' || providerType === 'openlist';
}

export function formatMountReferenceSummary(target: ManageMountDetailRecord | ManageMountRecord) {
  const counts = 'mount' in target ? target.mount.referenceCounts : target.referenceCounts;
  return `媒体库绑定 ${counts.librarySourceCount} · 媒体源 ${counts.mediaSourceCount} · 旁路资源 ${counts.sidecarAssetCount}`;
}

export function hasHiddenMountReferences(target: ManageMountDetailRecord | ManageMountRecord) {
  const counts = 'mount' in target ? target.mount.referenceCounts : target.referenceCounts;
  return counts.librarySourceCount === 0 && (counts.mediaSourceCount > 0 || counts.sidecarAssetCount > 0);
}

export function buildPendingMountDeleteState(
  target: ManageMountDetailRecord | ManageMountRecord,
): PendingMountDeleteState {
  const referenceCounts = 'mount' in target ? target.mount.referenceCounts : target.referenceCounts;
  if ('mount' in target) {
    return {
      mountId: target.mount.id,
      mountName: target.mount.name,
      pathLabel: target.rootPath || target.mount.pathLabel,
      linkedLibraryCount: target.mount.linkedLibraries.length,
      librarySourceCount: referenceCounts.librarySourceCount,
      mediaSourceCount: referenceCounts.mediaSourceCount,
      sidecarAssetCount: referenceCounts.sidecarAssetCount,
    };
  }

  return {
    mountId: target.id,
    mountName: target.name,
    pathLabel: target.pathLabel,
    linkedLibraryCount: target.linkedLibraries.length,
    librarySourceCount: referenceCounts.librarySourceCount,
    mediaSourceCount: referenceCounts.mediaSourceCount,
    sidecarAssetCount: referenceCounts.sidecarAssetCount,
  };
}

export function buildMountDeleteImpact(target: PendingMountDeleteState) {
  const linkedLibrarySummary =
    target.linkedLibraryCount > 0
      ? `当前关联媒体库 ${target.linkedLibraryCount} 个。`
      : '当前没有媒体库级关联。';
  const referenceSummary = `实际引用统计：媒体库绑定 ${target.librarySourceCount} 条、媒体源 ${target.mediaSourceCount} 条、旁路资源 ${target.sidecarAssetCount} 条。`;
  const mismatchSummary =
    target.linkedLibraryCount === 0 && (target.mediaSourceCount > 0 || target.sidecarAssetCount > 0)
      ? '虽然列表里看起来没有关联媒体库，但底层媒体源或旁路资源还挂着这个数据源，所以后端会拒绝删除。'
      : '只要上面三个引用计数里还有非 0，后端就不会放行删除。';

  return [
    `根路径 / 地址：${target.pathLabel}`,
    linkedLibrarySummary,
    referenceSummary,
    mismatchSummary,
  ];
}

export function maskSensitiveConfig(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskSensitiveConfig);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (/(password|secret|token|access_key|accesskey|secret_key|secretkey)/i.test(key)) {
        return [key, '***'];
      }
      return [key, maskSensitiveConfig(entryValue)];
    }),
  );
}

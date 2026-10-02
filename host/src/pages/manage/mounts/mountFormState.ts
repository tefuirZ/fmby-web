/**
 * mounts 表单状态初始化/回填与 Create/Update payload 构建（FE-MOUNT-AGGREGATE 拆分）。
 * 纯函数，保持既有字段映射与「PATCH 不含 name」等口径不变。
 */

import type {
  CreateManageMountRequest,
  ManageMountDetailRecord,
} from '@fmby/v2-shared/contracts/manage';
import type { MountFormState } from './types';
import {
  defaultMountCapabilities,
  isS3Provider,
  isStructuredRemoteProvider,
  isWebDavProvider,
} from './providerCapabilities';
import { normalizeRemoteMountPath, normalizeWebDavS3RootPath } from './rootPath';
import {
  buildStructuredRemoteConfig,
  buildWebDavS3Config,
  createEmptyRemoteConfig,
  extractRemoteConfigState,
  parseConfigJson,
  parseOptionalJsonText,
} from './mountConfig';

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
    note: '',
    rateConfigText: '',
    visibilityRuleText: '{}',
    sidecarNfo: false,
    sidecarSubtitle: false,
    sidecarPoster: false,
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
    // DATASOURCE-CRUD-BACKFILL-UI：旧值回填（用户口径「管理员要看到旧数值」）。
    // 来源均为后端 ManagedMountSummaryDto 真实返回字段，前端不伪造。
    note: detail.mount.note ?? '',
    rateConfigText: detail.mount.rateConfig ?? '',
    visibilityRuleText: detail.mount.visibilityRule ?? '{}',
    sidecarNfo: detail.mount.sidecarNfo ?? false,
    sidecarSubtitle: detail.mount.sidecarSubtitle ?? false,
    sidecarPoster: detail.mount.sidecarPoster ?? false,
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
  // ★DATASOURCE-CRUD-BACKFILL-UI：名称不可修改（用户口径）。
  // 后端 ManagedMountUpdateRequest 虽有 name 字段但会拒；前端不得静默把新名提交，
  // 故 PATCH 体**不含 name**（表单里该字段也只读 disabled）。
  return {
    rootPath: normalizeMountRootPath(form),
    configJson: buildMountConfigObject(form),
    note: form.note,
    rateConfig: parseOptionalJsonText(form.rateConfigText),
    visibilityRule: parseOptionalJsonText(form.visibilityRuleText) ?? {},
    sidecarNfo: form.sidecarNfo,
    sidecarSubtitle: form.sidecarSubtitle,
    sidecarPoster: form.sidecarPoster,
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

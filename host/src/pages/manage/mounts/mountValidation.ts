/**
 * mounts 表单校验与鉴权方式切换影响（FE-MOUNT-AGGREGATE 拆分）。
 * 纯函数，错误文案与判定口径保持与原 formUtils 完全一致。
 */

import type {
  ManageMountDetailRecord,
} from '@fmby/v2-shared/contracts/manage';
import type {
  MountDrawerMode,
  MountFormErrors,
  MountFormState,
  MountRemoteAuthMode,
} from './types';
import {
  isStructuredRemoteProvider,
  isWebDavProvider,
  isS3Provider,
  supportsDirectoryBrowser,
} from './providerCapabilities';
import {
  hasParentTraversalSegment,
  normalizeRemoteMountPath,
  normalizeWebDavS3RootPath,
} from './rootPath';
import { SEALED_REF_INPUT_ERROR, isSealedRef, parseConfigJson, readConfigString } from './mountConfig';

export function validateMountForm(form: MountFormState): MountFormErrors {
  const errors: MountFormErrors = {};

  if (form.name.trim() === '') {
    errors.name = '数据源名称不能为空。';
  }

  if (isWebDavProvider(form.providerType) || isS3Provider(form.providerType)) {
    return { ...errors, ...validateWebDavS3Form(form) };
  }

  if (isStructuredRemoteProvider(form.providerType)) {
    collectSealedRefInputErrors(form, errors);
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

  // ★FE-MOUNT-CONFIG-UI：速率/可见性同为 JSON 文本面，非法必须在校验层拦截
  //（诚实错误），不得等保存时 JSON.parse 崩掉。
  if (form.rateConfigText.trim() !== '') {
    try {
      JSON.parse(form.rateConfigText);
    } catch {
      errors.rateConfigText = '速率配置必须是合法 JSON（如 {"limit_mb_s": 20}）。';
    }
  }
  if (form.visibilityRuleText.trim() !== '') {
    try {
      JSON.parse(form.visibilityRuleText);
    } catch {
      errors.visibilityRuleText = '可见性规则必须是合法 JSON（如 {"hidden_paths": []}）。';
    }
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
 * 敏感输入框防御：用户若把 `__sealed:` 引用粘进输入框，给出字段级错误。
 *
 * 背景（§3.3③）：Create 提交 `__sealed:` → 400 `MountConfigSealedRefOnCreate`
 * （防跨挂载凭据引用）；Update 提交引用虽合法，但用户不该手填引用——应「留空」
 * 表示不改。正常流程前端从不把引用放进输入框（引用存记忆位），此为兜底提示。
 */
function collectSealedRefInputErrors(form: MountFormState, errors: MountFormErrors) {
  const { remoteConfig } = form;
  if (isSealedRef(remoteConfig.password.trim())) errors.password = SEALED_REF_INPUT_ERROR;
  if (isSealedRef(remoteConfig.token.trim())) errors.token = SEALED_REF_INPUT_ERROR;
  if (isSealedRef(remoteConfig.accessKey.trim())) errors.accessKey = SEALED_REF_INPUT_ERROR;
  if (isSealedRef(remoteConfig.secretKey.trim())) errors.secretKey = SEALED_REF_INPUT_ERROR;
}

/** 必填字段级校验（缺 url / bucket → 具名错误，后端已补具名错误码，前端同口径提示）。 */
export function validateWebDavS3Form(form: MountFormState): MountFormErrors {
  const errors: MountFormErrors = {};
  collectSealedRefInputErrors(form, errors);
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

/**
 * mounts config_json / 凭据映射（FE-MOUNT-AGGREGATE 拆分）。
 * 含密封引用（`__sealed:`）语义、远端 config 抽取/构建与文本 JSON 解析。纯函数。
 */

import type { MountFormState, MountRemoteConfigState } from './types';
import { isWebDavProvider } from './providerCapabilities';

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

/** 后端密封引用前缀（契约 §3.3②：敏感键出站一律此形态，明文绝不回显）。 */
export const SEALED_REF_PREFIX = '__sealed:';

/** 是否后端密封引用（`__sealed:<key>`）。 */
export function isSealedRef(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.startsWith(SEALED_REF_PREFIX);
}

/**
 * 敏感键保存值（MOUNT-CRED-SEAL 语义）：
 * - 用户**重填了明文** → 用明文（Create/Update 后端都会重新密封）；
 * - 用户**留空**且有存量引用 → 原样回传引用（Update = 「不改凭据」；
 *   PATCH 是整表替换，省略该键会丢凭据，故必须回传）；
 * - 用户**误把 `__sealed:` 粘进输入框** → 视为「不改凭据」回传存量引用，
 *   绝不在 Create 场景把它原样提交（那会 400 `MountConfigSealedRefOnCreate`）。
 */
export function resolveSensitiveValue(typed: string, storedRef: string | null | undefined): string | undefined {
  if (typed.trim() !== '' && !isSealedRef(typed.trim())) {
    return typed;
  }
  if (storedRef) {
    return storedRef;
  }
  return undefined;
}

/** 编辑态是否已有存量凭据（决定输入框占位文案）。 */
export function hasStoredSealedRef(ref: string | null | undefined): boolean {
  return Boolean(ref);
}

/** 编辑态已有存量凭据时的输入框占位（MOUNT-CRED-SEAL 裁决 3）。 */
export const STORED_CREDENTIAL_PLACEHOLDER = '已配置凭据，留空则不修改';

/** 用户误把密封引用粘进输入框时的字段级报错。 */
export const SEALED_REF_INPUT_ERROR =
  '请填写明文凭据；留空表示保留已配置的凭据（不要粘贴 __sealed: 引用）。';

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
    passwordSealedRef: null,
    tokenSealedRef: null,
    accessKeySealedRef: null,
    secretKeySealedRef: null,
  };
}

export function buildStructuredRemoteConfig(form: MountFormState): Record<string, unknown> {
  const next: Record<string, unknown> = { ...form.preservedConfig };
  for (const key of REMOTE_CONFIG_KNOWN_KEYS) {
    delete next[key];
  }

  next.endpoint = form.remoteConfig.endpoint.trim();
  // MOUNT-CRED-SEAL：敏感键经 resolveSensitiveValue 处理——重填明文用明文，
  // 留空回传存量 `__sealed:` 引用（Update=不改凭据；PATCH 整表替换故不可省略）。
  if (form.remoteConfig.authMode === 'token') {
    const token = resolveSensitiveValue(form.remoteConfig.token, form.remoteConfig.tokenSealedRef);
    if (token !== undefined) {
      next.token = token;
    }
  } else {
    const username = form.remoteConfig.username.trim();
    const password = resolveSensitiveValue(form.remoteConfig.password, form.remoteConfig.passwordSealedRef);
    if (username !== '' && password !== undefined) {
      next.username = username;
      next.password = password;
    } else if (password !== undefined && isSealedRef(password)) {
      // 用户名未重填但有存量密码引用 → 仅回传引用，保留既有密码不改。
      next.password = password;
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
  const rawToken = readConfigString(configJson, ['token', 'access_token', 'accessToken']) ?? '';
  const username = readConfigString(configJson, ['username']) ?? '';
  const rawPassword = readConfigString(configJson, ['password']) ?? '';
  const otpCode = readConfigString(configJson, ['otp_code', 'otpCode']) ?? '';
  // MOUNT-CRED-SEAL：回显的 `__sealed:` 引用不进输入框（否则展示成引用串），
  // 存进记忆位供「留空则不修改」回传；只有明文才回填输入框。
  const tokenSealedRef = isSealedRef(rawToken) ? rawToken : null;
  const passwordSealedRef = isSealedRef(rawPassword) ? rawPassword : null;
  const token = tokenSealedRef ? '' : rawToken;
  const password = passwordSealedRef ? '' : rawPassword;

  const preservedConfig = Object.fromEntries(
    Object.entries(configJson).filter(
      ([key]) => !REMOTE_CONFIG_KNOWN_KEYS.includes(key as (typeof REMOTE_CONFIG_KNOWN_KEYS)[number]),
    ),
  );

  const bucket = readConfigString(configJson, ['bucket']) ?? '';
  const region = readConfigString(configJson, ['region']) ?? '';
  const rawAccessKey = readConfigString(configJson, ['access_key', 'accessKey']) ?? '';
  const rawSecretKey = readConfigString(configJson, ['secret_key', 'secretKey']) ?? '';
  const accessKeySealedRef = isSealedRef(rawAccessKey) ? rawAccessKey : null;
  const secretKeySealedRef = isSealedRef(rawSecretKey) ? rawSecretKey : null;
  const accessKey = accessKeySealedRef ? '' : rawAccessKey;
  const secretKey = secretKeySealedRef ? '' : rawSecretKey;

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
      passwordSealedRef,
      tokenSealedRef,
      accessKeySealedRef,
      secretKeySealedRef,
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
    const password = resolveSensitiveValue(form.remoteConfig.password, form.remoteConfig.passwordSealedRef);
    if (password !== undefined) next.password = password;
    return next;
  }
  next.endpoint = form.remoteConfig.endpoint.trim();
  next.bucket = form.remoteConfig.bucket.trim();
  if (form.remoteConfig.region.trim() !== '') next.region = form.remoteConfig.region.trim();
  const accessKey = resolveSensitiveValue(form.remoteConfig.accessKey, form.remoteConfig.accessKeySealedRef);
  if (accessKey !== undefined) next.access_key = accessKey;
  const secretKey = resolveSensitiveValue(form.remoteConfig.secretKey, form.remoteConfig.secretKeySealedRef);
  if (secretKey !== undefined) next.secret_key = secretKey;
  return next;
}

/**
 * 可选 JSON 文本框：空串 → `undefined`（语义=不配置，后端理解为清空/未配置），
 * 非法 JSON → 抛出由调用方呈现（不静默吞掉）。
 */
export function parseOptionalJsonText(value: string): Record<string, unknown> | undefined {
  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }
  return JSON.parse(trimmed) as Record<string, unknown>;
}

/** config_json 文本框解析：空串 → `{}`；非法 JSON 抛出（调用方按字段呈现错误）。 */
export function parseConfigJson(value: string): Record<string, unknown> {
  const trimmed = value.trim();
  if (trimmed === '') {
    return {};
  }
  return JSON.parse(trimmed) as Record<string, unknown>;
}

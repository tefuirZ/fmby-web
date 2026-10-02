/**
 * FE-MOUNT-AGGREGATE：mounts/formUtils 桶导出面 + 关键纯函数行为 characterization。
 *
 * 拆巨型文件前后都必须绿：拆后 `formUtils.ts` 只做 re-export，本测试锁定
 * ① 公共导出不删除、不改名、不改形态（typeof）；② 关键纯函数行为不变。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as formUtils from '../src/pages/manage/mounts/formUtils';

/** 拆分前的完整公共导出面（name → typeof）。拆后必须逐项仍在。 */
const EXPECTED_EXPORTS: Record<string, 'function' | 'string'> = {
  createEmptyMountForm: 'function',
  SEALED_REF_PREFIX: 'string',
  isSealedRef: 'function',
  resolveSensitiveValue: 'function',
  hasStoredSealedRef: 'function',
  STORED_CREDENTIAL_PLACEHOLDER: 'string',
  SEALED_REF_INPUT_ERROR: 'string',
  createEmptyRemoteConfig: 'function',
  buildMountFormState: 'function',
  buildCreateMountPayload: 'function',
  buildUpdateMountPayload: 'function',
  buildMountConfigObject: 'function',
  buildStructuredRemoteConfig: 'function',
  extractRemoteConfigState: 'function',
  readConfigString: 'function',
  parseOptionalJsonText: 'function',
  validateMountForm: 'function',
  validateDirectoryBrowser: 'function',
  buildWebDavS3Config: 'function',
  validateWebDavS3Form: 'function',
  shouldConfirmRemoteAuthModeSwitch: 'function',
  buildAuthModeChangeImpact: 'function',
  isValidHttpUrl: 'function',
  hasParentTraversalSegment: 'function',
  normalizeRemoteMountPath: 'function',
  supportsDirectoryBrowser: 'function',
  PAN115_CREDENTIAL_HINT: 'string',
  isStructuredRemoteProvider: 'function',
  isWebDavProvider: 'function',
  isS3Provider: 'function',
  isStructuredConfigProvider: 'function',
  normalizeWebDavS3RootPath: 'function',
  getDirectoryBrowserDescription: 'function',
  getDirectoryBrowserHint: 'function',
  getRootPathReadonlyHint: 'function',
  defaultMountCapabilities: 'function',
  getMountStatusLabel: 'function',
  getMountDrawerTitle: 'function',
  getMountDrawerDescription: 'function',
  getProviderHint: 'function',
  getRootPathPlaceholder: 'function',
  canValidateMount: 'function',
  canValidateMountType: 'function',
  formatMountReferenceSummary: 'function',
  hasHiddenMountReferences: 'function',
  buildPendingMountDeleteState: 'function',
  buildMountDeleteImpact: 'function',
  maskSensitiveConfig: 'function',
  MOUNT_FAULT_CREDENTIAL_EXPIRED: 'string',
  resolveCredentialGuidance: 'function',
  describeSecretValue: 'function',
};

test('formUtils 桶：公共导出面完整（拆分后不得删除/改名/改形态）', () => {
  const ns = formUtils as unknown as Record<string, unknown>;
  const missing: string[] = [];
  const wrongKind: string[] = [];
  for (const [name, kind] of Object.entries(EXPECTED_EXPORTS)) {
    if (!(name in ns) || ns[name] === undefined) {
      missing.push(name);
      continue;
    }
    if (typeof ns[name] !== kind) {
      wrongKind.push(`${name}: 期望 ${kind}，实为 ${typeof ns[name]}`);
    }
  }
  assert.deepEqual(missing, [], '不得有导出被删除/改名');
  assert.deepEqual(wrongKind, []);
});

test('formUtils 桶：不得出现 default 导出（保持无默认导出约定）', () => {
  assert.equal('default' in (formUtils as Record<string, unknown>), false);
});

test('行为：provider 分类与结构化判定不变', () => {
  assert.equal(formUtils.isStructuredRemoteProvider('alist'), true);
  assert.equal(formUtils.isStructuredRemoteProvider('openlist'), true);
  assert.equal(formUtils.isStructuredRemoteProvider('webdav'), false);
  assert.equal(formUtils.isWebDavProvider('webdav'), true);
  assert.equal(formUtils.isS3Provider('s3-compatible'), true);
  assert.equal(formUtils.isStructuredConfigProvider('s3-compatible'), true);
  assert.equal(formUtils.isStructuredConfigProvider('local'), false);
});

test('行为：root_path 归一（../ 拒绝、WebDAV 前缀、S3 无前缀）', () => {
  assert.equal(formUtils.normalizeRemoteMountPath('a/../b'), '');
  assert.equal(formUtils.normalizeRemoteMountPath(' /a//b/ '), '/a/b');
  assert.equal(formUtils.normalizeWebDavS3RootPath('webdav', 'a/b'), '/a/b');
  assert.equal(formUtils.normalizeWebDavS3RootPath('s3-compatible', '/a/b'), 'a/b');
  assert.equal(formUtils.normalizeWebDavS3RootPath('webdav', '..'), '');
  assert.equal(formUtils.hasParentTraversalSegment('a/../b'), true);
});

test('行为：敏感值解析（明文/留空回传引用/误粘引用）', () => {
  assert.equal(formUtils.resolveSensitiveValue('plain', '__sealed:k1'), 'plain');
  assert.equal(formUtils.resolveSensitiveValue('', '__sealed:k1'), '__sealed:k1');
  assert.equal(formUtils.resolveSensitiveValue('  ', '__sealed:k1'), '__sealed:k1');
  assert.equal(formUtils.resolveSensitiveValue('__sealed:k1', '__sealed:k1'), '__sealed:k1');
  assert.equal(formUtils.resolveSensitiveValue('', null), undefined);
  assert.equal(formUtils.isSealedRef('__sealed:x'), true);
  assert.equal(formUtils.isSealedRef('plain'), false);
});

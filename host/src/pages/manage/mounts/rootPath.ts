/**
 * mounts 根路径归一与路径穿越防线（FE-MOUNT-AGGREGATE 拆分）。纯函数。
 */

import type { ManageMountProviderType } from '@fmby/v2-shared/contracts/manage';
import { isS3Provider } from './providerCapabilities';

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

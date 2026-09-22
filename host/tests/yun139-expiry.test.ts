/**
 * 139 凭据过期引导判定（FE-PARITY-YUN139-EXPIRY-GUIDE）。
 *
 * 依据：crates/fmby-v2-domain/src/yun139_accounts.rs:19-49 四态词表
 *      （Pending / Active / AuthExpired / Disabled），AuthExpired 亦写入
 *      last_error_kind（e2e 冻结字段测试 yun139_accounts_e2e.rs:70）。
 *
 * ★关键纪律：只认后端 AuthExpired 一词；没观测到 → unknown / none，
 *   不本地扩张词表、不伪造过期结论。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCredentialExpiry,
  isPendingAuthorization,
  isDisabled,
  YUN139_AUTH_EXPIRED,
} from '../src/pages/manage/yun139/credentialExpiry';
import type { Yun139CredentialProfile } from '@fmby/v2-shared/contracts/manage/yun139';

function makeProfile(
  patch: Partial<Yun139CredentialProfile>,
): Yun139CredentialProfile {
  return {
    id: 'p-1',
    displayName: '主账号',
    accountIdentityMask: '138****8000',
    status: 'Active',
    canRefresh: true,
    authorizationExpiresAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorKind: null,
    lastErrorMessage: null,
    createdAt: 0,
    updatedAt: 0,
    ...patch,
  };
}

test('① status=AuthExpired → expired，并带后端文案', () => {
  const g = resolveCredentialExpiry(
    makeProfile({ status: 'AuthExpired', lastErrorMessage: '需要重新授权' }),
  );
  assert.equal(g.kind, 'expired');
  assert.match(g.reason ?? '', /重新扫码授权/);
  assert.equal(g.backendMessage, '需要重新授权');
});

test('② lastErrorKind=AuthExpired（status 尚未翻转）也判 expired', () => {
  const g = resolveCredentialExpiry(
    makeProfile({ status: 'Active', lastErrorKind: YUN139_AUTH_EXPIRED }),
  );
  assert.equal(g.kind, 'expired');
});

test('③ Active 且无错误 → none，不得误报过期', () => {
  const g = resolveCredentialExpiry(makeProfile({ status: 'Active' }));
  assert.equal(g.kind, 'none');
  assert.equal(g.reason, null);
});

test('④ 未知状态词（后端未来新增）→ none，不本地扩张词表', () => {
  const g = resolveCredentialExpiry(makeProfile({ status: 'SomeNewStatus' }));
  assert.equal(g.kind, 'none');
});

test('⑤ 无档案 / null → unknown（拿不到证据归 unknown）', () => {
  assert.equal(resolveCredentialExpiry(null).kind, 'unknown');
  assert.equal(resolveCredentialExpiry(undefined).kind, 'unknown');
});

test('⑥ 时间戳不作为判定依据（缺失时间戳的 Active 仍判 none）', () => {
  const g = resolveCredentialExpiry(
    makeProfile({ status: 'Active', authorizationExpiresAt: 1 }),
  );
  assert.equal(g.kind, 'none');
});

test('⑦ Pending / Disabled 辅助判定', () => {
  assert.equal(isPendingAuthorization(makeProfile({ status: 'Pending' })), true);
  assert.equal(isPendingAuthorization(makeProfile({ status: 'Active' })), false);
  assert.equal(isDisabled(makeProfile({ status: 'Disabled' })), true);
  assert.equal(isDisabled(null), false);
});

test('⑧ Disabled 不判为 expired（避免把「主动停用」误提示成「凭据过期」）', () => {
  const g = resolveCredentialExpiry(makeProfile({ status: 'Disabled' }));
  assert.equal(g.kind, 'none');
  assert.equal(isDisabled(makeProfile({ status: 'Disabled' })), true);
});

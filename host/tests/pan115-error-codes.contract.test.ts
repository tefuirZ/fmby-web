// FE-ERROR-UX-ALIGN：pan115 凭据错误新码归类对拍（RED → GREEN）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 后端 ERROBODY 大改：pan115 凭据/解封路径从旧 `credential_invalid` 分类改为
// `Coded(ErrorCode::Pan115*)` ⇒ wire 变 SCREAMING 新码（error_code/slug.rs）：
//   PAN115_COOKIE_INVALID / PAN115_CREDENTIAL_MISSING
// 前端 Pan115CredentialsSection/DirectoryBrowserSection 此前只判 `credential_invalid`
// ⇒ 新码落 getErrorMessage 兜底（message 仍是后端中文，诚实但丢失"引导重绑"归类）。
//
// 修法口径：**只按 code 归类，不硬编码后端中文文案**（文案由 ErrorBody.message 原样展示）。
// 归类 helper 抽到 shared（错误词表属共享错误面，供多组件复用）。

import test from 'node:test';
import assert from 'node:assert/strict';

const { isPan115CredentialError } = await import(
  '@fmby/v2-shared/errors/pan115Codes'
);

const err = (code: string, message = '后端中文文案'): unknown => ({
  code,
  message,
  retryable: false,
});

test('新码 PAN115_COOKIE_INVALID → 凭据错误归类（引导重绑）', () => {
  assert.equal(isPan115CredentialError(err('PAN115_COOKIE_INVALID')), true);
});

test('新码 PAN115_CREDENTIAL_MISSING → 凭据错误归类', () => {
  assert.equal(isPan115CredentialError(err('PAN115_CREDENTIAL_MISSING')), true);
});

test('旧码兼容：credential_invalid 仍归类（后端 11 类蛇形码向后兼容保证）', () => {
  assert.equal(isPan115CredentialError(err('credential_invalid')), true);
});

test('非凭据错误不误判（not_found / validation / unauthorized）', () => {
  assert.equal(isPan115CredentialError(err('not_found')), false);
  assert.equal(isPan115CredentialError(err('validation')), false);
  assert.equal(isPan115CredentialError(err('unauthorized')), false);
});

test('非 ApiError 输入安全返回 false', () => {
  assert.equal(isPan115CredentialError(null), false);
  assert.equal(isPan115CredentialError(new Error('x')), false);
  assert.equal(isPan115CredentialError('字符串错误'), false);
});

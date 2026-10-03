/**
 * Pan115 凭据错误码归类（FE-ERROR-UX-ALIGN）。
 *
 * 后端 ERROBODY 大改后，pan115 凭据/解封路径改为 `Coded(ErrorCode::Pan115*)`，
 * wire 变 SCREAMING 新码（`PAN115_COOKIE_INVALID` / `PAN115_CREDENTIAL_MISSING`，
 * 唯一真源 `crates/fmby-v2-contracts/src/error_code/slug.rs`）；既有 11 类蛇形码
 * 向后兼容不变。
 *
 * 本 helper 让 Pan115 凭据 UI 对**新旧两套码**都能归类为「凭据错误 → 引导重绑」：
 * 只按 code 识别，**不硬编码后端中文文案**（文案由 ErrorBody.message 原样展示，
 * 后端可用 coded 覆盖具体文案，前端跟随显示）。
 */

/** pan115 凭据错误码集合（新旧两套并认；后端 slug 词表见 error_code/slug.rs）。 */
const PAN115_CREDENTIAL_CODES = new Set([
  'PAN115_COOKIE_INVALID',
  'PAN115_CREDENTIAL_MISSING',
  'credential_invalid', // 旧分类蛇形码（向后兼容窗口内仍可能出现）
]);

/** 是否为 pan115 凭据错误（→ UI 引导重新绑定，而非泛化报错）。 */
export function isPan115CredentialError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && PAN115_CREDENTIAL_CODES.has(code);
}

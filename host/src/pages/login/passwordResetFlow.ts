/**
 * 密码重置提交后分流（EMAIL-CHANNEL / WEB-EMAIL-UI ③ ③a）。
 *
 * 防枚举的结构性保证：提交成功后的后续 UI **只由 delivery 决定**（外加 A 形态
 * 必需的 challenge），函数签名不接收任何「邮箱是否存在」输入——因此无论邮箱
 * 存在与否，UI 走同一分支、显示同一常量文案。
 * （常量文案见 shared/contracts/auth `PASSWORD_RESET_START_CONFIRM_MESSAGE`。）
 */

import type { PasswordResetDelivery } from '@fmby/v2-shared/contracts/auth';

export type PasswordResetAfterSubmitView =
  /** A 形态：验证码 + 新密码表单（challenge 有效）。 */
  | 'code-form'
  /** A 形态但 challenge 缺失 → 不渲染表单（提交必败），引导走邮件链接。 */
  | 'code-unavailable'
  /** B 形态：提示查收邮件点链接。 */
  | 'link-notice'
  /** C 形态：提示新密码已发送。 */
  | 'password-notice';

/**
 * 提交后的后续视图。
 *
 * ★ `code` 形态为何要看 challenge：后端以 `(session_id, email, code)` 三元组校验
 *   （bridges/password_reset.rs:339），而 `session_id` 就是 start 响应的 `challenge`。
 *   challenge 为空串（B/C 形态，或后端未回）时验证码表单**提交必败**——渲染一个
 *   必定失败的表单是死胡同，故改引导用户走邮件里的重置链接。
 *
 * @param delivery start 响应的投递形态
 * @param challenge start 响应的 challenge（A 形态回填用的 session_id）
 */
export function resetAfterSubmitView(
  delivery: PasswordResetDelivery,
  challenge = '',
): PasswordResetAfterSubmitView {
  switch (delivery) {
    case 'code':
      return challenge.trim() === '' ? 'code-unavailable' : 'code-form';
    case 'link':
      return 'link-notice';
    case 'password':
      return 'password-notice';
  }
}

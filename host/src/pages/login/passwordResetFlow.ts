/**
 * 密码重置提交后分流（EMAIL-CHANNEL / WEB-EMAIL-UI ③）。
 *
 * 防枚举的结构性保证：提交成功后的后续 UI **只由 delivery 决定**，函数签名不接收
 * 任何「邮箱是否存在」输入——因此无论邮箱存在与否，UI 走同一分支、显示同一常量文案。
 * （常量文案见 shared/contracts/auth `PASSWORD_RESET_START_CONFIRM_MESSAGE`。）
 */

import type { PasswordResetDelivery } from '@fmby/v2-shared/contracts/auth';

export type PasswordResetAfterSubmitView = 'code-form' | 'link-notice' | 'password-notice';

export function resetAfterSubmitView(
  delivery: PasswordResetDelivery,
): PasswordResetAfterSubmitView {
  switch (delivery) {
    case 'code':
      return 'code-form';
    case 'link':
      return 'link-notice';
    case 'password':
      return 'password-notice';
  }
}

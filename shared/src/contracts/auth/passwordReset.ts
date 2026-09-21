/**
 * 密码重置域类型与 Zod Schema（EMAIL-CHANNEL / WEB-EMAIL-UI ③ ③a ④）。
 *
 * 端点（docs/interfaces/webui.md §auth）：
 * - POST /api/auth/password-reset/start  → {accepted, delivery, challenge?, expires_at_ms}
 * - POST /api/auth/password-reset/complete → A 形态 {session_id,email,code,new_password?}
 *                                          B 形态 {ticket, new_password}
 *
 * 安全红线：start 恒不泄露账号是否存在（不存在也 accepted=true，delivery 照常返回）；
 * complete 错误统一文案防枚举；验证码一次性。
 */

import { z } from 'zod';

export type PasswordResetDelivery = 'code' | 'link' | 'password';

export interface PasswordResetStartRequest {
  email: string;
  session_id?: string;
}

export interface PasswordResetStartResponse {
  accepted: boolean;
  delivery: PasswordResetDelivery;
  challenge?: string;
  expires_at_ms?: number;
}

/** A 形态：验证码 + 新密码。 */
export interface PasswordResetCompleteCodeRequest {
  session_id: string;
  email: string;
  code: string;
  new_password?: string;
}

/** B 形态：链接 ticket + 新密码（重置页固定路由 /login#password-reset?ticket=...）。 */
export interface PasswordResetCompleteLinkRequest {
  ticket: string;
  new_password: string;
}

export type PasswordResetCompleteRequest =
  | PasswordResetCompleteCodeRequest
  | PasswordResetCompleteLinkRequest;

/* ---- 表单 Schema（统一收口于此，禁止页面内联 z.object） ---- */

export const passwordResetStartSchema = z.object({
  email: z.string().min(1, '请输入邮箱').email('请输入有效的邮箱地址'),
});
export type PasswordResetStartFormData = z.infer<typeof passwordResetStartSchema>;

export const passwordResetCodeSchema = z.object({
  code: z
    .string()
    .min(1, '请输入验证码')
    .regex(/^\d{4,12}$/, '验证码为 4-12 位数字'),
  newPassword: z.string().min(8, '新密码至少 8 个字符'),
});
export type PasswordResetCodeFormData = z.infer<typeof passwordResetCodeSchema>;

export const passwordResetLinkSchema = z.object({
  ticket: z.string().min(1, '缺少重置票据'),
  newPassword: z.string().min(8, '新密码至少 8 个字符'),
});
export type PasswordResetLinkFormData = z.infer<typeof passwordResetLinkSchema>;

/** 防枚举：无论邮箱是否存在，起始提交都返回同一中性提示。 */
export const PASSWORD_RESET_START_CONFIRM_MESSAGE =
  '若该邮箱已注册，我们会按当前重置方式发送相应指引，请留意收件箱（含垃圾邮件）。';

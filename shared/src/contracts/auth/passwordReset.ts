/**
 * 密码重置域类型与 Zod Schema（EMAIL-CHANNEL / WEB-EMAIL-UI ③ ③a ④）。
 *
 * 端点（docs/interfaces/webui.md §auth + docs/interfaces/api-contract-fields.json）：
 * - POST /api/auth/password-reset/start    → req {email, session_id}
 *                                          → res {accepted, delivery, challenge, expires_at_ms}
 * - POST /api/auth/password-reset/complete → req {ticket, session_id, email, code, new_password}
 *
 * wire 全 snake_case：后端 DTO 裸派生 serde（无 rename_all），与
 * docs/interfaces/api-contract-fields.json 的 requestFields 逐字一致。
 *
 * 安全红线：start 恒不泄露账号是否存在（不存在也 accepted=true，delivery 照常返回）；
 * complete 错误统一文案防枚举；验证码一次性。
 */

import { z } from 'zod';

export type PasswordResetDelivery = 'code' | 'link' | 'password';

export interface PasswordResetStartRequest {
  email: string;
  /**
   * 可选会话 id（验证码三元组之一）。后端**无格式校验**：
   * 缺省/空白时回退用邮箱本身（bridges/password_reset.rs:161-167），
   * 故前端可不传，也可前端生成——不校验格式。
   */
  session_id?: string;
}

export interface PasswordResetStartResponse {
  accepted: boolean;
  delivery: PasswordResetDelivery;
  /** A 形态回填用会话标识（= 后端实际采用的 session_id）；B/C 形态为空串。 */
  challenge?: string;
  expires_at_ms?: number;
}

/**
 * complete 请求：后端 DTO `PasswordResetEmailCompleteRequest` 五字段全 `Option`
 * + `#[serde(default)]`（state/auth.rs:206-220）。
 * 分支优先级（bridges/password_reset.rs:323）：
 *   ① ticket 非空 → B 形态（凭 ticket 换密，忽略三元组）；
 *   ② 否则 → A 形态三元组（session_id + email + code 缺一即统一文案报错）。
 */
export interface PasswordResetCompleteRequest {
  /** B 形态：邮件链接中的 ticket（优先分支）。 */
  ticket?: string;
  /** A 形态：会话 id（须与 start 响应的 challenge 一致）。 */
  session_id?: string;
  /** A 形态：邮箱。 */
  email?: string;
  /** A 形态：验证码。 */
  code?: string;
  /** 新密码（A/B 必填 ≥8；C 由服务端生成，忽略）。 */
  new_password?: string;
}

/** B 形态：链接 ticket + 新密码（重置页固定路由 /login#password-reset?ticket=...）。 */
export interface PasswordResetCompleteLinkRequest {
  ticket: string;
  new_password: string;
}

/**
 * A 形态：验证码三元组 + 新密码。
 *
 * ★ `session_id` 必须等于 start 响应回的 `challenge`——后端以
 *   (session, email, code) 三元组校验（bridges/password_reset.rs:339）。
 *   后端 challenge 为空串（B/C 形态）时 A 形态不可用，前端不应渲染验证码表单。
 */
export interface PasswordResetCompleteCodeRequest {
  session_id: string;
  email: string;
  code: string;
  new_password?: string;
}

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

/** 防枚举：无论邮箱是否存在，起始提交后都显示同一中性提示。 */
export const PASSWORD_RESET_START_CONFIRM_MESSAGE =
  '若该邮箱已注册，我们会按当前重置方式发送相应指引，请留意收件箱（含垃圾邮件）。';

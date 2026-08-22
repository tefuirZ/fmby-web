/**
 * 认证域表单 Zod Schema 收口。
 *
 * 所有跨表单使用或与认证后端接口相关的 schema 必须放在这里，
 * 不允许在页面内联 z.object（参考 docs/agent-memory.md 中的「表单 schema 收口」守则）。
 */

import { z } from 'zod';

const passwordConfirmRefine = (data: { password: string; confirmPassword: string }) =>
  data.password === data.confirmPassword;

const passwordConfirmIssue: { message: string; path: (string | number)[] } = {
  message: '两次密码不一致',
  path: ['confirmPassword'],
};

export const loginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
});
export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    code: z.string().min(1, '请输入注册码'),
    username: z.string().min(3, '用户名至少 3 个字符'),
    password: z.string().min(8, '密码至少 8 个字符'),
    confirmPassword: z.string(),
    displayName: z.string().optional(),
  })
  .refine(passwordConfirmRefine, passwordConfirmIssue);
export type RegisterFormData = z.infer<typeof registerSchema>;

export const setupSchema = z
  .object({
    username: z.string().min(3, '用户名至少 3 个字符'),
    password: z.string().min(8, '密码至少 8 个字符'),
    confirmPassword: z.string(),
    displayName: z.string().optional(),
  })
  .refine(passwordConfirmRefine, passwordConfirmIssue);
export type SetupFormData = z.infer<typeof setupSchema>;

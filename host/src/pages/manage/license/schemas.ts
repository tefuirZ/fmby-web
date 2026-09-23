/**
 * 授权页表单 schema（照 V1 `domains/manage/license/schemas.ts` 逐项对齐）。
 */

import { z } from 'zod';

export const manageLicenseActivationTokenSchema = z.object({
  activationToken: z
    .string()
    .trim()
    .min(1, '请输入 activation token')
    .max(4096, 'activation token 过长，请确认是否复制了额外内容'),
});

export type ManageLicenseActivationTokenForm = z.infer<
  typeof manageLicenseActivationTokenSchema
>;

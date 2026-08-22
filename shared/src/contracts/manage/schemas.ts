import { z } from "zod";

export const manageResetUserPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "新密码不能少于 8 个字符")
      .max(256, "新密码不能超过 256 个字符"),
    confirmPassword: z.string(),
    forceChange: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "两次输入的新密码不一致",
      });
    }
  });

export type ManageResetUserPasswordFormValues = z.infer<
  typeof manageResetUserPasswordSchema
>;

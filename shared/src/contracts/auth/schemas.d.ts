/**
 * 认证域表单 Zod Schema 收口。
 *
 * 所有跨表单使用或与认证后端接口相关的 schema 必须放在这里，
 * 不允许在页面内联 z.object（参考 docs/agent-memory.md 中的「表单 schema 收口」守则）。
 */
import { z } from 'zod';
export declare const loginSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
}, {
    username: string;
    password: string;
}>;
export type LoginFormData = z.infer<typeof loginSchema>;
export declare const registerSchema: z.ZodEffects<z.ZodObject<{
    code: z.ZodString;
    username: z.ZodString;
    password: z.ZodString;
    confirmPassword: z.ZodString;
    displayName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    username: string;
    password: string;
    confirmPassword: string;
    displayName?: string | undefined;
}, {
    code: string;
    username: string;
    password: string;
    confirmPassword: string;
    displayName?: string | undefined;
}>, {
    code: string;
    username: string;
    password: string;
    confirmPassword: string;
    displayName?: string | undefined;
}, {
    code: string;
    username: string;
    password: string;
    confirmPassword: string;
    displayName?: string | undefined;
}>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export declare const setupSchema: z.ZodEffects<z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
    confirmPassword: z.ZodString;
    displayName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
    confirmPassword: string;
    displayName?: string | undefined;
}, {
    username: string;
    password: string;
    confirmPassword: string;
    displayName?: string | undefined;
}>, {
    username: string;
    password: string;
    confirmPassword: string;
    displayName?: string | undefined;
}, {
    username: string;
    password: string;
    confirmPassword: string;
    displayName?: string | undefined;
}>;
export type SetupFormData = z.infer<typeof setupSchema>;
//# sourceMappingURL=schemas.d.ts.map
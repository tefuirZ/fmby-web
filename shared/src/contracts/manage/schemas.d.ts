import { z } from "zod";
export declare const manageResetUserPasswordSchema: z.ZodEffects<z.ZodObject<{
    newPassword: z.ZodString;
    confirmPassword: z.ZodString;
    forceChange: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    confirmPassword: string;
    newPassword: string;
    forceChange: boolean;
}, {
    confirmPassword: string;
    newPassword: string;
    forceChange?: boolean | undefined;
}>, {
    confirmPassword: string;
    newPassword: string;
    forceChange: boolean;
}, {
    confirmPassword: string;
    newPassword: string;
    forceChange?: boolean | undefined;
}>;
export type ManageResetUserPasswordFormValues = z.infer<typeof manageResetUserPasswordSchema>;
//# sourceMappingURL=schemas.d.ts.map
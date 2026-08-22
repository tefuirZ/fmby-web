/**
 * 标准化 Zod + react-hook-form 表单 hook。
 *
 * 用法：
 * ```ts
 * import { loginSchema, type LoginFormData } from '@fmby/v2-shared/contracts/auth/schemas';
 * import { useZodForm } from '@fmby/v2-shared/forms';
 *
 * const { register, handleSubmit, formState: { errors } } =
 *   useZodForm<LoginFormData>(loginSchema);
 * ```
 *
 * 强制 zodResolver，避免业务代码各自 import @hookform/resolvers/zod。
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormProps, type UseFormReturn } from 'react-hook-form';
import type { ZodTypeAny, z } from 'zod';

export function useZodForm<TSchema extends ZodTypeAny>(
  schema: TSchema,
  options?: Omit<UseFormProps<z.infer<TSchema>>, 'resolver'>,
): UseFormReturn<z.infer<TSchema>> {
  return useForm<z.infer<TSchema>>({
    ...options,
    resolver: zodResolver(schema),
  });
}

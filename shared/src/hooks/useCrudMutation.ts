import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  QueryClient,
  QueryKey,
  UseMutationOptions,
  UseMutationResult,
} from '@tanstack/react-query';

/**
 * 通用 CRUD Mutation Hook
 *
 * 封装了 manage 页面中最常见的 CRUD 模式：
 * - 执行 mutationFn
 * - 成功后批量 invalidateQueries（可选 removeQueries）
 * - 透传 onSuccess / onError / onSettled 回调
 *
 * @example
 * ```ts
 * const createMount = useCrudMutation({
 *   mutationFn: (data: CreateMountRequest) => manageApi.createMount(data),
 *   invalidateKeys: [queryKeys.manage.mounts.list()],
 *   onSuccess: () => setDrawerOpen(false),
 *   onError: (err) => setBanner({ variant: 'error', message: getErrorMessage(err) }),
 * });
 * ```
 */
export interface CrudMutationOptions<TVariables, TResult, TOnMutateResult = unknown>
  extends Omit<UseMutationOptions<TResult, Error, TVariables, TOnMutateResult>, 'mutationFn'> {
  mutationFn: (data: TVariables) => Promise<TResult>;
  /** 成功后需要 invalidate 的 QueryKey 列表 */
  invalidateKeys?: CrudMutationKeyFactory<TResult, TVariables>;
  /** 成功后需要 remove（清出缓存）的 QueryKey 列表（常用于删除操作） */
  removeKeys?: CrudMutationKeyFactory<TResult, TVariables>;
  /** 成功后需要直接写入缓存的场景，例如详情抽屉保存后立即回显最新记录 */
  updateCache?: (context: CrudMutationCacheContext<TResult, TVariables>) => void;
}

type CrudMutationKeyFactory<TResult, TVariables> =
  | QueryKey[]
  | ((result: TResult, variables: TVariables) => QueryKey[]);

interface CrudMutationCacheContext<TResult, TVariables> {
  queryClient: QueryClient;
  result: TResult;
  variables: TVariables;
}

function resolveCrudMutationKeys<TResult, TVariables>(
  keys: CrudMutationKeyFactory<TResult, TVariables> | undefined,
  result: TResult,
  variables: TVariables,
): QueryKey[] {
  return typeof keys === 'function' ? keys(result, variables) : keys ?? [];
}

export function useCrudMutation<TVariables, TResult, TOnMutateResult = unknown>(
  options: CrudMutationOptions<TVariables, TResult, TOnMutateResult>,
): UseMutationResult<TResult, Error, TVariables, TOnMutateResult> {
  const queryClient = useQueryClient();
  const { mutationFn, invalidateKeys, removeKeys, updateCache, onSuccess, ...rest } = options;

  return useMutation<TResult, Error, TVariables, TOnMutateResult>({
    mutationFn,
    onSuccess: async (result, variables, onMutateResult, context) => {
      updateCache?.({ queryClient, result, variables });
      const tasks: Promise<void>[] = [];

      for (const key of resolveCrudMutationKeys(invalidateKeys, result, variables)) {
        tasks.push(queryClient.invalidateQueries({ queryKey: key }));
      }
      for (const key of resolveCrudMutationKeys(removeKeys, result, variables)) {
        queryClient.removeQueries({ queryKey: key });
      }

      if (tasks.length > 0) {
        await Promise.all(tasks);
      }

      await onSuccess?.(result, variables, onMutateResult, context);
    },
    ...rest,
  });
}

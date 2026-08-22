/**
 * LibraryDrawer 内部类型定义
 * 保持 QueryShape / MutationShape 的抽象形式
 */

export interface QueryShape<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface MutationShape<TVars> {
  isPending: boolean;
  variables?: TVars;
  mutate: (vars: TVars) => void;
}

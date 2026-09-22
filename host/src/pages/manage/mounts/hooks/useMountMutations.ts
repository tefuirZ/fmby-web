import type React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  manageApi,
  type CreateManageMountRequest,
  type DangerousActionRequest,
  type ManageMountDirectoryBrowserResponse,
} from '@fmby/v2-shared/contracts/manage';
import { queryKeys } from '@fmby/v2-shared/query';
import type { BannerState } from '@fmby/v2-shared/ui/types';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import type { MountDrawerState, MountFormErrors, MountFormState } from '../types';
import { buildUpdateMountPayload } from '../formUtils';
import { optimisticRemoveMount, rollbackMountList } from './deleteOptimistic';

export interface UseMountMutationsCallbacks {
  setBanner: (state: BannerState | null) => void;
  setFormErrors: React.Dispatch<React.SetStateAction<MountFormErrors>>;
  setDirectoryBrowser: (value: ManageMountDirectoryBrowserResponse | null) => void;
  setDrawerState: (state: MountDrawerState | null) => void;
  clearPendingDelete: () => void;
}

export function useMountMutations({
  setBanner,
  setFormErrors,
  setDirectoryBrowser,
  setDrawerState,
  clearPendingDelete,
}: UseMountMutationsCallbacks) {
  const queryClient = useQueryClient();

  const createMountMutation = useMutation({
    mutationFn: (payload: CreateManageMountRequest) => manageApi.createMount(payload),
    onSuccess: async (detail) => {
      queryClient.setQueryData(queryKeys.manage.mounts.detail(detail.mount.id), detail);
      setFormErrors({});
      setDirectoryBrowser(null);
      setBanner({
        variant: 'success',
        title: '数据源已创建',
        description: '已同步刷新数据源列表和详情抽屉。',
      });
      setDrawerState({ mode: 'view', mountId: detail.mount.id });
      await queryClient.invalidateQueries({ queryKey: queryKeys.manage.mounts.list() });
    },
    onError: (error) => {
      setBanner({
        variant: 'error',
        title: '数据源创建失败',
        description: getErrorMessage(error),
      });
    },
  });

  const updateMountMutation = useMutation({
    mutationFn: ({ mountId, form }: { mountId: string; form: MountFormState }) =>
      manageApi.updateMount(mountId, buildUpdateMountPayload(form)),
    onSuccess: async (detail) => {
      queryClient.setQueryData(queryKeys.manage.mounts.detail(detail.mount.id), detail);
      setFormErrors({});
      setDirectoryBrowser(null);
      setBanner({
        variant: 'success',
        title: '数据源已更新',
        description: '最新配置和能力声明已经保存。',
      });
      setDrawerState({ mode: 'view', mountId: detail.mount.id });
      await queryClient.invalidateQueries({ queryKey: queryKeys.manage.mounts.list() });
    },
    onError: (error) => {
      setBanner({
        variant: 'error',
        title: '数据源更新失败',
        description: getErrorMessage(error),
      });
    },
  });

  const deleteMountMutation = useMutation({
    mutationFn: ({
      mountId,
      confirmation,
    }: {
      mountId: string;
      confirmation: DangerousActionRequest;
    }) => manageApi.deleteMount(mountId, confirmation),
    // FE-DELETE-UX-OPTIMISTIC：确认提交瞬间先从列表缓存乐观移除该数据源
    // （表格立刻少一行，按钮即进 pending），网络往返在后台完成；失败则回滚恢复并报错。
    // 后端待 w2 改为「点下去只隐藏、后台异步真删」后，onSettled 的 invalidate
    // 会重新拉取；若后端仅标记隐藏、真删尚未落地，行会回到列表（不前端假删）。
    onMutate: async ({ mountId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.manage.mounts.list() });
      const previous = queryClient.getQueryData(queryKeys.manage.mounts.list());
      queryClient.setQueryData(
        queryKeys.manage.mounts.list(),
        optimisticRemoveMount(
          queryClient.getQueryData(queryKeys.manage.mounts.list()) as
            | Parameters<typeof optimisticRemoveMount>[0]
            | undefined,
          mountId,
        ),
      );
      return { previous };
    },
    onSuccess: async (result, variables) => {
      const { mountId } = variables;
      queryClient.removeQueries({ queryKey: queryKeys.manage.mounts.detail(mountId) });
      clearPendingDelete();
      setDrawerState(null);
      setBanner({
        variant: 'success',
        title: result.message,
        description: '数据源已移除，关联媒体库资源将在后台异步清理（可能耗时）。',
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.manage.mounts.list() });
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(
          queryKeys.manage.mounts.list(),
          rollbackMountList(
            queryClient.getQueryData(queryKeys.manage.mounts.list()) as
              | Parameters<typeof rollbackMountList>[0]
              | undefined,
            context.previous as Parameters<typeof rollbackMountList>[1] | undefined,
          ),
        );
      }
      setBanner({
        variant: 'error',
        title: '数据源删除失败',
        description: getErrorMessage(error),
      });
    },
  });

  return { createMountMutation, updateMountMutation, deleteMountMutation };
}

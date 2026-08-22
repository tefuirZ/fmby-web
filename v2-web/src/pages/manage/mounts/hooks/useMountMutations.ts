import type React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  manageApi,
  type CreateManageMountRequest,
  type DangerousActionRequest,
  type ManageMountDirectoryBrowserResponse,
} from '@/domains/manage';
import { queryKeys } from '@/shared/query-keys';
import type { BannerState } from '@/shared/types/ui';
import { getErrorMessage } from '@/shared/utils/error';
import type { MountDrawerState, MountFormErrors, MountFormState } from '../types';
import { buildUpdateMountPayload } from '../formUtils';

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
    onSuccess: async (result, variables) => {
      const { mountId } = variables;
      queryClient.removeQueries({ queryKey: queryKeys.manage.mounts.detail(mountId) });
      clearPendingDelete();
      setDrawerState(null);
      setBanner({
        variant: 'success',
        title: result.message,
        description: '数据源列表已重新同步。',
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.manage.mounts.list() });
    },
    onError: (error) => {
      setBanner({
        variant: 'error',
        title: '数据源删除失败',
        description: getErrorMessage(error),
      });
    },
  });

  return { createMountMutation, updateMountMutation, deleteMountMutation };
}

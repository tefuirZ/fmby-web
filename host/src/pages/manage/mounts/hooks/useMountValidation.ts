import type React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  manageApi,
  type ManageMountProviderType,
  type ManageMountDirectoryBrowserResponse,
} from '@fmby/v2-shared/contracts/manage';
import { queryKeys } from '@fmby/v2-shared/query';
import type { BannerState } from '@fmby/v2-shared/ui/types';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import type { MountFormErrors } from '../types';
import { getMountStatusLabel, isStructuredRemoteProvider } from '../formUtils';

export interface UseMountValidationCallbacks {
  setBanner: (state: BannerState | null) => void;
  setFormErrors: React.Dispatch<React.SetStateAction<MountFormErrors>>;
  setDirectoryBrowser: (value: ManageMountDirectoryBrowserResponse | null) => void;
}

export function useMountValidation({
  setBanner,
  setFormErrors,
  setDirectoryBrowser,
}: UseMountValidationCallbacks) {
  const queryClient = useQueryClient();

  const validateMountMutation = useMutation({
    mutationFn: (mountId: string) => manageApi.validateMount(mountId),
    onSuccess: async (detail) => {
      queryClient.setQueryData(queryKeys.manage.mounts.detail(detail.mount.id), detail);
      const { healthStatus } = detail.mount;
      const isRemote = isStructuredRemoteProvider(detail.providerType);
      setBanner({
        variant: healthStatus === 'healthy' ? 'success' : healthStatus === 'critical' ? 'error' : 'warning',
        title: `来源校验完成 · 状态：${getMountStatusLabel(healthStatus)}`,
        description:
          healthStatus === 'healthy'
            ? `能力声明已同步更新。${isRemote ? '上游服务连接正常，可正常扫描和播放。' : ''}`
            : healthStatus === 'critical'
            ? `来源当前不可达或配置异常。${isRemote ? '请检查 AList / OpenList 服务地址是否可达，以及认证信息是否仍然有效。' : '请检查路径权限和磁盘挂载状态。'}`
            : `来源存在潜在问题，建议复核配置。${isRemote ? '可尝试"刷新访问"后再次校验。' : ''}`,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.manage.mounts.list() });
    },
    onError: async (error, mountId) => {
      setBanner({
        variant: 'error',
        title: '来源校验失败',
        description: getErrorMessage(error),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.manage.mounts.list() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.manage.mounts.detail(mountId) }),
      ]);
    },
  });

  const refreshMountAccessMutation = useMutation({
    mutationFn: (mountId: string) => manageApi.refreshMountAccess(mountId),
    onSuccess: async (detail) => {
      queryClient.setQueryData(queryKeys.manage.mounts.detail(detail.mount.id), detail);
      const { healthStatus } = detail.mount;
      setBanner({
        variant: healthStatus === 'healthy' ? 'success' : healthStatus === 'critical' ? 'error' : 'warning',
        title: `来源访问信息已刷新 · 状态：${getMountStatusLabel(healthStatus)}`,
        description:
          healthStatus === 'healthy'
            ? '凭据已更新，当前来源访问正常。'
            : healthStatus === 'critical'
            ? '凭据已刷新，但来源仍不可达，请检查上游服务状态或重新配置认证信息。'
            : '访问信息已刷新，但来源状态仍需关注，建议执行"校验来源"进一步确认。',
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.manage.mounts.list() });
    },
    onError: async (error, mountId) => {
      setBanner({
        variant: 'error',
        title: '刷新访问失败',
        description: getErrorMessage(error),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.manage.mounts.list() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.manage.mounts.detail(mountId) }),
      ]);
    },
  });

  const browseDirectoriesMutation = useMutation({
    mutationFn: ({
      providerType,
      configJson,
      path,
    }: {
      providerType: ManageMountProviderType;
      configJson: Record<string, unknown>;
      path?: string;
    }) => manageApi.browseMountDirectories({ providerType, configJson, path }),
    onSuccess: (response) => {
      setFormErrors((prev) => ({ ...prev, browse: undefined }));
      setDirectoryBrowser(response);
    },
    onError: (error, variables) => {
      const message = getErrorMessage(error);
      const isRemoteBrowse = variables.providerType === 'alist' || variables.providerType === 'openlist';
      const hint = isRemoteBrowse
        ? '请确认 AList / OpenList 服务地址可达，认证信息正确，且账号有远端目录访问权限。'
        : variables.providerType === 'local'
          ? '请确认当前路径存在，且 fmby 进程对该目录具备读取权限。'
          : undefined;
      const fullMessage = hint ? `${message} ${hint}` : message;
      setFormErrors((prev) => ({ ...prev, browse: fullMessage }));
      setBanner({
        variant: 'error',
        title: '目录加载失败',
        description: fullMessage,
      });
    },
  });

  return { validateMountMutation, refreshMountAccessMutation, browseDirectoriesMutation };
}

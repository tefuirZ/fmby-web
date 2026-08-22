import type { Dispatch, SetStateAction } from 'react';
import type { ManageMountDirectoryBrowserResponse, ManageMountProviderType } from '@fmby/v2-shared/contracts/manage';
import type { BannerState } from '@fmby/v2-shared/ui/types';
import type { MountDrawerState, MountFormState, MountFormErrors, MountRemoteAuthMode } from '../../../types';
import type { MountDetailQueryShape, MutationShape } from '../types';
import {
  buildCreateMountPayload,
  buildMountConfigObject,
  buildStructuredRemoteConfig,
  isStructuredRemoteProvider,
  normalizeRemoteMountPath,
  shouldConfirmRemoteAuthModeSwitch,
  validateDirectoryBrowser,
  validateMountForm,
} from '../../../formUtils';

interface UseMountDrawerHandlersProps {
  formState: MountFormState;
  setFormState: Dispatch<SetStateAction<MountFormState>>;
  formErrors: MountFormErrors;
  setFormErrors: Dispatch<SetStateAction<MountFormErrors>>;
  drawerState: MountDrawerState | null;
  currentDetail: MountDetailQueryShape['data'];
  directoryBrowser: ManageMountDirectoryBrowserResponse | null;
  setDirectoryBrowser: (value: ManageMountDirectoryBrowserResponse | null) => void;
  setPendingAuthModeChange: (value: MountRemoteAuthMode | null) => void;
  setBanner: (value: BannerState | null) => void;
  createMountMutation: MutationShape<any, any>;
  updateMountMutation: MutationShape<any, any>;
  browseDirectoriesMutation: MutationShape<any, any>;
}

export function useMountDrawerHandlers({
  formState,
  setFormState,
  setFormErrors,
  drawerState,
  currentDetail,
  directoryBrowser,
  setDirectoryBrowser,
  setPendingAuthModeChange,
  setBanner,
  createMountMutation,
  updateMountMutation,
  browseDirectoriesMutation,
}: UseMountDrawerHandlersProps) {
  const isStructuredProviderForm = isStructuredRemoteProvider(formState.providerType);

  const handleProviderTypeChange = (providerType: ManageMountProviderType) => {
    setFormErrors({});
    setDirectoryBrowser(null);
    setFormState((prev) => {
      const next = { ...prev };
      if (isStructuredRemoteProvider(prev.providerType) && !isStructuredRemoteProvider(providerType)) {
        next.configJsonText = JSON.stringify(buildStructuredRemoteConfig(prev), null, 2);
      }
      if (!isStructuredRemoteProvider(prev.providerType) && isStructuredRemoteProvider(providerType)) {
        next.rootPath = normalizeRemoteMountPath(prev.rootPath) || '/';
      }
      next.providerType = providerType;
      return next;
    });
  };

  const handleSaveMount = () => {
    const errors = validateMountForm(formState);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      setBanner({
        variant: 'error',
        title: '表单校验未通过',
        description: '请先修正必填项和配置格式，再保存当前数据源。',
      });
      return;
    }
    setBanner(null);
    if (drawerState?.mode === 'create') {
      createMountMutation.mutate(buildCreateMountPayload(formState));
      return;
    }
    if (drawerState?.mode === 'edit' && drawerState.mountId) {
      updateMountMutation.mutate({ mountId: drawerState.mountId, form: formState });
    }
  };

  const handleBrowseDirectories = (path?: string) => {
    const browseErrors = validateDirectoryBrowser(formState);
    setFormErrors((prev) => ({ ...prev, ...browseErrors }));
    if (Object.keys(browseErrors).length > 0) {
      setBanner({
        variant: 'error',
        title: '目录浏览器暂时无法使用',
        description: isStructuredProviderForm
          ? '请先补齐服务地址和认证信息，再加载目录。'
          : '请先确认当前来源支持目录浏览，且必要配置已经准备完成。',
      });
      return;
    }
    setBanner(null);
    const nextPath = path ?? directoryBrowser?.currentPath ?? formState.rootPath ?? '/';
    browseDirectoriesMutation.mutate({
      providerType: formState.providerType,
      configJson: buildMountConfigObject(formState),
      path: nextPath === '' ? '/' : nextPath,
    });
  };

  const applyRemoteAuthModeChange = (nextMode: MountRemoteAuthMode) => {
    setFormErrors((prev) => ({ ...prev, username: undefined, password: undefined, token: undefined, browse: undefined }));
    setDirectoryBrowser(null);
    setPendingAuthModeChange(null);
    setFormState((prev) => ({
      ...prev,
      remoteConfig: { ...prev.remoteConfig, authMode: nextMode },
    }));
  };

  const handleRemoteAuthModeChange = (nextMode: MountRemoteAuthMode) => {
    if (formState.remoteConfig.authMode === nextMode) return;
    if (shouldConfirmRemoteAuthModeSwitch(drawerState?.mode, currentDetail, formState, nextMode)) {
      setPendingAuthModeChange(nextMode);
      return;
    }
    applyRemoteAuthModeChange(nextMode);
  };

  return {
    handleProviderTypeChange,
    handleSaveMount,
    handleBrowseDirectories,
    handleRemoteAuthModeChange,
    applyRemoteAuthModeChange,
  };
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  manageApi,
  type CreateManageLibraryRequest,
  type DangerousActionRequest,
} from '@fmby/v2-shared/contracts/manage';
import { queryKeys } from '@fmby/v2-shared/query';
import type { BannerState } from '@fmby/v2-shared/ui/types';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import type {
  LibraryDrawerState,
  LibraryFormState,
  PendingLibraryDeleteState,
} from '../types';
import { buildUpdateLibraryPayload } from '../formUtils';

export interface UseLibraryMutationsCallbacks {
  setBanner: (state: BannerState | null) => void;
  setDrawerState: (state: LibraryDrawerState | null) => void;
  setPendingDelete: (state: PendingLibraryDeleteState | null) => void;
}

export function useLibraryMutations({
  setBanner,
  setDrawerState,
  setPendingDelete,
}: UseLibraryMutationsCallbacks) {
  const queryClient = useQueryClient();

  const createLibraryMutation = useMutation({
    mutationFn: (payload: CreateManageLibraryRequest) => manageApi.createLibrary(payload),
    onSuccess: async (detail) => {
      queryClient.setQueryData(queryKeys.manage.libraries.detail(detail.library.id), detail);
      setBanner({
        variant: 'success',
        title: '媒体库已创建',
        description: '已同步刷新列表和详情面板。',
      });
      setDrawerState({ mode: 'view', libraryId: detail.library.id });
      await queryClient.invalidateQueries({ queryKey: queryKeys.manage.libraries.list() });
    },
    onError: (error) => {
      setBanner({
        variant: 'error',
        title: '媒体库创建失败',
        description: getErrorMessage(error),
      });
    },
  });

  const updateLibraryMutation = useMutation({
    mutationFn: ({ libraryId, form }: { libraryId: string; form: LibraryFormState }) =>
      manageApi.updateLibrary(libraryId, buildUpdateLibraryPayload(form)),
    onSuccess: async (detail) => {
      queryClient.setQueryData(queryKeys.manage.libraries.detail(detail.library.id), detail);
      setBanner({
        variant: 'success',
        title: '媒体库已更新',
        description: '最新来源绑定和授权范围已经生效。',
      });
      setDrawerState({ mode: 'view', libraryId: detail.library.id });
      await queryClient.invalidateQueries({ queryKey: queryKeys.manage.libraries.list() });
    },
    onError: (error) => {
      setBanner({
        variant: 'error',
        title: '媒体库更新失败',
        description: getErrorMessage(error),
      });
    },
  });

  const deleteLibraryMutation = useMutation({
    mutationFn: ({
      libraryId,
      confirmation,
    }: {
      libraryId: string;
      confirmation: DangerousActionRequest;
    }) => manageApi.deleteLibrary(libraryId, confirmation),
    // FE-OPT-01 ② 危险操作即时反馈：确认提交瞬间先从列表缓存乐观移除该库
    // （表格立刻少一行），网络往返在后台完成；失败则回滚恢复并报错。
    onMutate: async ({ libraryId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.manage.libraries.list() });
      const previous = queryClient.getQueryData(queryKeys.manage.libraries.list());
      queryClient.setQueryData<unknown>(
        queryKeys.manage.libraries.list(),
        (old: { libraries?: { library: { id: string } }[] } | undefined) => {
          if (!old || !Array.isArray(old.libraries)) return old;
          return {
            ...old,
            libraries: old.libraries.filter((entry) => entry.library.id !== libraryId),
          };
        },
      );
      return { previous };
    },
    onSuccess: async (result, variables) => {
      const { libraryId } = variables;
      queryClient.removeQueries({ queryKey: queryKeys.manage.libraries.detail(libraryId) });
      setPendingDelete(null);
      setDrawerState(null);
      setBanner({
        variant: 'success',
        title: result.message,
        description: '媒体库列表已重新同步。',
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.manage.libraries.list() });
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.manage.libraries.list(), context.previous);
      }
      setBanner({
        variant: 'error',
        title: '媒体库删除失败',
        description: getErrorMessage(error),
      });
    },
  });

  const triggerLibraryScanMutation = useMutation({
    mutationFn: (libraryId: string) => manageApi.triggerLibraryScan(libraryId, { taskType: 'manual-refresh' }),
    onSuccess: async (result, libraryId) => {
      const createdCount = result.tasks.length;
      const skippedCount = result.skippedSourceIds.length;
      setBanner({
        variant: createdCount > 0 ? 'success' : 'info',
        title: createdCount > 0 ? '扫描任务已创建' : '当前来源正在扫描中',
        description:
          skippedCount > 0
            ? `已创建 ${createdCount} 个任务，跳过 ${skippedCount} 个重复来源。`
            : `已为当前媒体库创建 ${createdCount} 个扫描任务。`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.manage.libraries.list() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.manage.libraries.detail(libraryId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.manage.mounts.detail() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.manage.scans() }),
      ]);
    },
    onError: (error) => {
      setBanner({
        variant: 'error',
        title: '发起扫描失败',
        description: getErrorMessage(error),
      });
    },
  });

  return { createLibraryMutation, updateLibraryMutation, deleteLibraryMutation, triggerLibraryScanMutation };
}

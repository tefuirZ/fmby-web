import { useDeferredValue, useMemo } from 'react';
import type { ManageLibraryDetailRecord, ManageUserRecord } from '@fmby/v2-shared/contracts/manage';
import { matchKeyword } from '@fmby/v2-shared/search/matchKeyword';
import type { LibraryFormState } from '../../../types';

interface UseLibraryDrawerStateProps {
  currentDetail: ManageLibraryDetailRecord | undefined;
  users: ManageUserRecord[];
  formState: LibraryFormState;
  grantKeyword: string;
  triggerLibraryScanIsPending: boolean;
}

export function useLibraryDrawerState({
  currentDetail,
  users,
  formState,
  grantKeyword,
  triggerLibraryScanIsPending,
}: UseLibraryDrawerStateProps) {
  const deferredGrantKeyword = useDeferredValue(grantKeyword.trim());

  const filteredGrantUsers = useMemo(() => {
    return users.filter((user) =>
      matchKeyword(deferredGrantKeyword, user.username, user.displayName, user.roleLabel),
    );
  }, [deferredGrantKeyword, users]);

  const selectedGrantChips = useMemo(() => {
    const detailGrantLookup = new Map(
      (currentDetail?.accessGrants ?? []).map((grant) => [grant.userId, grant.displayName || grant.username]),
    );
    return formState.grantUserIds.map((userId) => {
      const matchedUser = users.find((user) => user.id === userId);
      return {
        id: userId,
        label: matchedUser?.displayName || matchedUser?.username || detailGrantLookup.get(userId) || userId,
      };
    });
  }, [currentDetail?.accessGrants, formState.grantUserIds, users]);

  const hasActiveScanTask =
    currentDetail?.recentScanTasks.some((task) => task.status === 'pending' || task.status === 'running') ?? false;

  const isTriggeringScan = triggerLibraryScanIsPending;

  return {
    filteredGrantUsers,
    selectedGrantChips,
    hasActiveScanTask,
    isTriggeringScan,
  };
}

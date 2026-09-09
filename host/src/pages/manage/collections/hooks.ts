import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  peripheralsApi,
  type ManagedCollectionWriteInput,
} from '@fmby/v2-shared/contracts/manage/peripherals';
import { queryKeys } from '@fmby/v2-shared/query';

export function useCollectionsQuery() {
  return useQuery({
    queryKey: queryKeys.manage.collections.list(),
    queryFn: () => peripheralsApi.listCollections(),
  });
}

export function useCollectionDetailQuery(id: string | null) {
  return useQuery({
    queryKey: queryKeys.manage.collections.detail(id ?? undefined),
    queryFn: () => peripheralsApi.getCollection(id as string),
    enabled: id !== null,
  });
}

interface UseCollectionMutationsOptions {
  onSuccess: (message: string) => void;
}

export function useCollectionMutations({ onSuccess }: UseCollectionMutationsOptions) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.manage.collections.all() });
  };

  const createMutation = useMutation({
    mutationFn: (input: ManagedCollectionWriteInput) =>
      peripheralsApi.createCollection(input),
    onSuccess: () => {
      invalidate();
      onSuccess('合集已创建。');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ManagedCollectionWriteInput }) =>
      peripheralsApi.updateCollection(id, input),
    onSuccess: () => {
      invalidate();
      onSuccess('合集已更新。');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => peripheralsApi.deleteCollection(id),
    onSuccess: () => {
      invalidate();
      onSuccess('合集已删除（成员一并移除）。');
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: ({ collectionId, memberId }: { collectionId: string; memberId: string }) =>
      peripheralsApi.deleteCollectionMember(collectionId, memberId),
    onSuccess: () => {
      invalidate();
      onSuccess('成员已从合集移除。');
    },
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    deleteMemberMutation,
  };
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  peripheralsApi,
  type ManagedCollectionMemberAddInput,
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

/**
 * 成员候选查询（GET member-candidates）。
 *
 * keyword 去空白后 <2 字符时**不发请求**（契约：后端必填且 ≥2，否则 400）——
 * 省一次注定失败的往返；空态由 UI 提示，不把 400 吞成空列表。
 */
export function useCollectionMemberCandidatesQuery(keyword: string) {
  const trimmed = keyword.trim();
  return useQuery({
    queryKey: queryKeys.manage.collections.memberCandidates(trimmed),
    queryFn: () => peripheralsApi.listCollectionMemberCandidates(trimmed),
    enabled: trimmed.length >= 2,
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

  const addMemberMutation = useMutation({
    mutationFn: ({ collectionId, input }: { collectionId: string; input: ManagedCollectionMemberAddInput }) =>
      peripheralsApi.addCollectionMember(collectionId, input),
    onSuccess: () => {
      invalidate();
      onSuccess('成员已加入合集。');
    },
  });

  return {
    addMemberMutation,
    createMutation,
    updateMutation,
    deleteMutation,
    deleteMemberMutation,
  };
}

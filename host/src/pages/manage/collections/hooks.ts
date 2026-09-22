import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  peripheralsApi,
  type ManagedCollectionMemberAddInput,
  type ManagedCollectionMemberRemoveInput,
  type ManagedCollectionMemberReorderInput,
  type ManagedCollectionMemberPatchInput,
  type ManagedCollectionPresetCreateInput,
  type ManagedCollectionRulesUpdateInput,
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

export function useCollectionPresetsQuery() {
  return useQuery({
    queryKey: queryKeys.manage.collections.presets(),
    queryFn: () => peripheralsApi.listCollectionPresets(),
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

  /**
   * 成员排序纯函数：把 index 处的成员与相邻成员交换一次（step=±1）。
   * 越界/相邻不动时返回原序副本（不环绕），便于单测与按钮禁用判定。
   */
  const reorderMemberMutation = useMutation({
    mutationFn: ({ collectionId, input }: { collectionId: string; input: ManagedCollectionMemberReorderInput }) =>
      peripheralsApi.reorderCollectionMembers(collectionId, input),
    onSuccess: () => {
      invalidate();
      onSuccess('成员顺序已更新。');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ collectionId, input }: { collectionId: string; input: ManagedCollectionMemberRemoveInput }) =>
      peripheralsApi.removeCollectionMember(collectionId, input),
    onSuccess: () => {
      invalidate();
      onSuccess('成员已从合集移除。');
    },
  });

  const patchMemberMutation = useMutation({
    mutationFn: ({
      collectionId,
      memberId,
      input,
    }: {
      collectionId: string;
      memberId: string;
      input: ManagedCollectionMemberPatchInput;
    }) => peripheralsApi.patchCollectionMember(collectionId, memberId, input),
    onSuccess: () => {
      invalidate();
      onSuccess('成员状态已更新。');
    },
  });

  const updateCollectionRulesMutation = useMutation({
    mutationFn: ({ collectionId, input }: { collectionId: string; input: ManagedCollectionRulesUpdateInput }) =>
      peripheralsApi.updateCollectionRules(collectionId, input),
    onSuccess: () => {
      invalidate();
      onSuccess('规则已保存。');
    },
  });

  const syncCollectionMutation = useMutation({
    mutationFn: (collectionId: string) => peripheralsApi.syncCollection(collectionId),
    onSuccess: () => {
      invalidate();
      onSuccess('合集已同步。');
    },
  });

  const createPresetCollectionMutation = useMutation({
    mutationFn: (input: ManagedCollectionPresetCreateInput) =>
      peripheralsApi.createCollectionFromPreset(input),
    onSuccess: () => {
      invalidate();
      onSuccess('已从预设创建合集。');
    },
  });

  const reorderCollectionsMutation = useMutation({
    mutationFn: (input: { collectionIds: string[] }) =>
      peripheralsApi.reorderCollections(input),
    onSuccess: () => {
      invalidate();
      onSuccess('合集顺序已保存。');
    },
  });

  return {
    addMemberMutation,
    removeMemberMutation,
    reorderMemberMutation,
    patchMemberMutation,
    updateCollectionRulesMutation,
    syncCollectionMutation,
    createPresetCollectionMutation,
    reorderCollectionsMutation,
    createMutation,
    updateMutation,
    deleteMutation,
    deleteMemberMutation,
  };
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  manageApi,
  type CreateRoleTemplateRequest,
  type DangerousActionRequest,
  type UpdateRoleTemplateRequest,
} from '@/domains/manage';
import { queryKeys } from '@/shared/query-keys';

interface UseRoleTemplateMutationsOptions {
  onSettledSuccess: (message: string) => void;
}

export function useRoleTemplateMutations({
  onSettledSuccess,
}: UseRoleTemplateMutationsOptions) {
  const queryClient = useQueryClient();

  const invalidateList = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.manage.roleTemplates.list(),
    });

  const createMutation = useMutation({
    mutationFn: (payload: CreateRoleTemplateRequest) =>
      manageApi.createRoleTemplate(payload),
    onSuccess: async () => {
      onSettledSuccess('模板已创建。');
      await invalidateList();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      templateId,
      payload,
    }: {
      templateId: string;
      payload: UpdateRoleTemplateRequest;
    }) => manageApi.updateRoleTemplate(templateId, payload),
    onSuccess: async () => {
      onSettledSuccess('模板已更新。');
      await invalidateList();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({
      templateId,
      confirmation,
    }: {
      templateId: string;
      confirmation: DangerousActionRequest;
    }) => manageApi.deleteRoleTemplate(templateId, confirmation),
    onSuccess: async () => {
      onSettledSuccess('模板已停用。');
      await invalidateList();
    },
  });

  return { createMutation, updateMutation, deleteMutation };
}

/** 用户页两个动作确认框（批量编辑 / 单账号关键动作）（V1F 拆分：ManageUsersPage → 子组件）。 */

import type { DangerousActionRequest } from '@fmby/v2-shared/contracts/manage';
import { SensitiveActionDialog } from '@fmby/v2-shared/ui';
import type { UserBatchEditFormState, PendingUserAction } from '../types';

export interface UserActionConfirmation {
  confirmAction: string;
  sessionConfirmation?: DangerousActionRequest['sessionConfirmation'];
  currentPassword?: string;
}

interface UserActionDialogsProps {
  batchEditOpen: boolean;
  onBatchEditOpenChange: (open: boolean) => void;
  selectedCount: number;
  batchEditFormState: UserBatchEditFormState;
  batchEditPending: boolean;
  onConfirmBatchEdit: (confirmation: UserActionConfirmation) => void;
  pendingAction: PendingUserAction | null;
  onPendingOpenChange: (open: boolean) => void;
  onConfirmPendingAction: (confirmation: UserActionConfirmation) => void;
  pendingActionPending: boolean;
  actionKey: string;
  actionTitle: string;
  actionLabel: string;
  actionImpact: string | string[] | undefined;
  // 批量删除
  batchDeleteOpen: boolean;
  onBatchDeleteOpenChange: (open: boolean) => void;
  softDeleteTargetCount: number;
  alreadyDisabledCount: number;
  onConfirmBatchDelete: (confirmation: UserActionConfirmation) => void;
}

export function UserActionDialogs({
  batchEditOpen,
  onBatchEditOpenChange,
  selectedCount,
  batchEditFormState,
  batchEditPending,
  onConfirmBatchEdit,
  pendingAction,
  onPendingOpenChange,
  onConfirmPendingAction,
  pendingActionPending,
  actionKey,
  actionTitle,
  actionLabel,
  actionImpact,
  batchDeleteOpen,
  onBatchDeleteOpenChange,
  softDeleteTargetCount,
  alreadyDisabledCount,
  onConfirmBatchDelete,
}: UserActionDialogsProps) {
  return (
    <>
  <SensitiveActionDialog
    open={batchEditOpen}
    actionKey="batch-update-users"
    title={`批量编辑 ${selectedCount} 个账号`}
    description="系统会只改你在上一层勾选的字段，未勾选的内容保持不动。"
    impact={[
      batchEditFormState.applyRole ? '会统一覆盖所选账号的系统角色。' : '不会动系统角色。',
      batchEditFormState.applyStatus ? '会统一调整账号状态；停用会直接吊销活跃会话。' : '不会动账号状态。',
      batchEditFormState.applySourceGrants ? '会整体替换来源路径授权；留空保存等于清空来源路径规则。' : '不会动来源路径授权。',
    ]}
    confirmLabel="确认批量编辑"
    onOpenChange={onBatchEditOpenChange}
    onConfirm={(confirmation) => onConfirmBatchEdit(confirmation)}
    pending={batchEditPending}
  />

  <SensitiveActionDialog
    open={pendingAction !== null}
    actionKey={actionKey}
    title={actionTitle}
    description="关键账号状态调整需要二次确认，避免误操作。"
    impact={actionImpact}
    confirmLabel={actionLabel}
    onOpenChange={onPendingOpenChange}
    onConfirm={(confirmation) => onConfirmPendingAction(confirmation)}
    pending={pendingActionPending}
  />
        <SensitiveActionDialog
    open={batchDeleteOpen}
    actionKey="delete-users"
    title={`批量删除 ${softDeleteTargetCount} 个账号`}
    description="当前删除语义为软删除：系统会停用所选账号，并同时吊销其活跃会话。"
    impact={[
      '当前登录账号和待激活注册申请不会进入批量删除。',
      alreadyDisabledCount > 0
        ? `另有 ${alreadyDisabledCount} 个已停用账号已经处于软删除状态，不会重复提交。`
        : '这次不会做物理删库。',
    ]}
    confirmLabel="确认批量删除"
    onOpenChange={onBatchDeleteOpenChange}
    onConfirm={(confirmation) => onConfirmBatchDelete(confirmation)}
    pending={false}
  />
    </>
  );
}

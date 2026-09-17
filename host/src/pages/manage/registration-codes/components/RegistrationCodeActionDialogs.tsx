/** 注册码页两个危险确认框（单码删除/改状态 + 批量删批次）（V1F 拆分）。 */

import { SensitiveActionDialog } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import type { DangerousActionRequest } from '@fmby/v2-shared/contracts/manage';
import type { PendingCodeAction } from '../types';
import { getCodeStatusAction } from '../formUtils';

interface RegistrationCodeActionDialogsProps {
  pendingAction: PendingCodeAction | null;
  pendingStatusAction: ReturnType<typeof getCodeStatusAction>;
  actionPending: boolean;
  actionError: unknown;
  onPendingOpenChange: (open: boolean) => void;
  onConfirmPendingAction: (confirmation: DangerousActionRequest) => void;
  batchDeleteOpen: boolean;
  batchDeleteCount: number;
  batchDeletePending: boolean;
  batchDeleteError: unknown;
  onBatchDeleteOpenChange: (open: boolean) => void;
  onConfirmBatchDelete: (confirmation: DangerousActionRequest) => void;
}

export function RegistrationCodeActionDialogs({
  pendingAction,
  pendingStatusAction,
  actionPending,
  actionError,
  onPendingOpenChange,
  onConfirmPendingAction,
  batchDeleteOpen,
  batchDeleteCount,
  batchDeletePending,
  batchDeleteError,
  onBatchDeleteOpenChange,
  onConfirmBatchDelete,
}: RegistrationCodeActionDialogsProps) {
  return (
    <>
    <SensitiveActionDialog
      open={pendingAction !== null}
      actionKey={
        pendingAction?.kind === 'delete'
          ? 'delete-registration-code'
          : 'update-registration-code-status'
      }
      title={
        pendingAction?.kind === 'delete'
          ? `删除注册码：${pendingAction.record.code}`
          : pendingAction
            ? `${pendingStatusAction?.label ?? '更新状态'}：${pendingAction.record.code}`
            : ''
      }
      description={
        pendingAction?.kind === 'delete'
          ? '删除后会直接移除这条注册码记录；如果这是批次最后一条码，该空批次也会被一并清理。'
          : '注册码状态变更会直接影响新用户的注册入口。'
      }
      impact={
        pendingAction?.kind === 'delete'
          ? [
              '仅未使用的注册码允许真删除。',
              '删除后列表会立即消失，无法再通过该码注册。',
            ]
          : pendingStatusAction?.impact
      }
      errorMessage={
        actionError ? getErrorMessage(actionError) : undefined
      }
      confirmLabel={
        pendingAction?.kind === 'delete'
          ? '确认删除'
          : pendingStatusAction?.label ?? '确认'
      }
      pending={actionPending}
      onOpenChange={onPendingOpenChange}
      onConfirm={(confirmation) => onConfirmPendingAction(confirmation)}
    />

    <SensitiveActionDialog
      open={batchDeleteOpen}
      actionKey="delete-registration-code-batches"
      title={`批量删除 ${batchDeleteCount} 个注册码批次`}
      description="系统会按批次执行真删除，批次里只要有任意一条注册码已经被使用，这一整批都会被跳过。"
      impact={[
        '仅整批删除，不支持在这里勾选批次内单条注册码做批量删。',
        '删除成功的批次会从列表和复制选择里立即移除。',
      ]}
      errorMessage={
        batchDeleteError ? getErrorMessage(batchDeleteError) : undefined
      }
      confirmLabel="确认批量删除"
      pending={batchDeletePending}
      onOpenChange={onBatchDeleteOpenChange}
      onConfirm={(confirmation) => onConfirmBatchDelete(confirmation)}
    />
    </>
  );
}

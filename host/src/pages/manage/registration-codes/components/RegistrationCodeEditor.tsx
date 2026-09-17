/** 注册码页创建区 + 编辑弹窗（V1F 拆分：ManageRegistrationCodesPage → 子组件）。 */

import type { Dispatch, SetStateAction } from 'react';
import { Dialog } from '@fmby/v2-shared/ui';
import type {
  ManageLibrariesResponse,
  RegistrationCodeBatchRecord,
  RoleTemplateRecord,
} from '@fmby/v2-shared/contracts/manage';
import { ManageSectionCard } from '../../longtail-shared/components';
import type { RegistrationCodeFormState } from '../types';
import { RegistrationCodeForm } from './RegistrationCodeForm';

interface RegistrationCodeEditorProps {
  formState: RegistrationCodeFormState;
  setFormState: Dispatch<SetStateAction<RegistrationCodeFormState>>;
  editingBatch: RegistrationCodeBatchRecord | null;
  isEditModalOpen: boolean;
  onEditModalClose: () => void;
  libraries: ManageLibrariesResponse['items'];
  librariesLoading: boolean;
  librariesError: Error | null | undefined;
  roleTemplates: RoleTemplateRecord[];
  roleTemplatesLoading: boolean;
  roleTemplatesError: Error | null | undefined;
  createPending: boolean;
  updatePending: boolean;
  editActionError: Error | null | undefined;
  onCreate: () => void;
  onUpdate: () => void;
}

export function RegistrationCodeEditor({
  formState,
  setFormState,
  editingBatch,
  isEditModalOpen,
  onEditModalClose,
  libraries,
  librariesLoading,
  librariesError,
  roleTemplates,
  roleTemplatesLoading,
  roleTemplatesError,
  createPending,
  updatePending,
  editActionError,
  onCreate,
  onUpdate,
}: RegistrationCodeEditorProps) {
  return (
    <>
      {!isEditModalOpen ? (
        <ManageSectionCard
          title="创建注册码批次"
          description="批量单次码和单码多次用统一从这里创建，后面列表按批次折叠管理。"
        >
          <RegistrationCodeForm
            mode="create"
            formState={formState}
            setFormState={setFormState}
            libraries={libraries}
            librariesLoading={librariesLoading}
            librariesError={librariesError}
            roleTemplates={roleTemplates}
            roleTemplatesLoading={roleTemplatesLoading}
            roleTemplatesError={roleTemplatesError}
            savePending={createPending}
            onSave={onCreate}
          />
        </ManageSectionCard>
      ) : null}

      <Dialog
        open={isEditModalOpen}
        eyebrow="批次编辑"
        title={editingBatch ? `编辑批次：${editingBatch.name}` : '编辑注册码批次'}
        description={
          editingBatch?.mode === 'shared-code'
            ? '共享码批次会同时更新批次名称、共享注册码和公共授权字段。'
            : '这里按批次覆盖公共字段，不再让你对同一批码一条条改到怀疑人生。'
        }
        onOpenChange={(open) => {
          if (!open) onEditModalClose();
        }}
      >
        <RegistrationCodeForm
          mode="edit"
          formState={formState}
          setFormState={setFormState}
          editingBatch={editingBatch}
          libraries={libraries}
          librariesLoading={librariesLoading}
          librariesError={librariesError}
          roleTemplates={roleTemplates}
          roleTemplatesLoading={roleTemplatesLoading}
          roleTemplatesError={roleTemplatesError}
          savePending={updatePending}
          editActionError={editActionError}
          onSave={onUpdate}
        />
      </Dialog>
    </>
  );
}

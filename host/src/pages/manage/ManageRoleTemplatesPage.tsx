import { useDeferredValue, useState } from 'react';
import {
  type CreateRoleTemplateRequest,
  type RoleTemplateRecord,
} from '@fmby/v2-shared/contracts/manage';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { SensitiveActionDialog } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { ManagePageHeader } from './longtail-shared/components';
import {
  RoleTemplateForm,
  RoleTemplateList,
  RoleTemplateMetricsBoard,
} from './role-templates/components';
import {
  useLibrariesQueryForTemplates,
  useMountsQueryForTemplates,
  useRoleTemplateMutations,
  useRoleTemplatesQuery,
} from './role-templates/hooks';
import {
  buildRoleTemplatePayload,
  createInitialFormState,
} from './role-templates/formUtils';
import type { RoleTemplateFormState } from './role-templates/types';

export function ManageRoleTemplatesPage() {
  const [formState, setFormState] = useState<RoleTemplateFormState>(
    createInitialFormState,
  );
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingRecord, setEditingRecord] = useState<RoleTemplateRecord | null>(
    null,
  );
  const [searchKeyword, setSearchKeyword] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingDeleteRecord, setPendingDeleteRecord] =
    useState<RoleTemplateRecord | null>(null);
  const deferredSearchKeyword = useDeferredValue(searchKeyword.trim().toLowerCase());

  const roleTemplatesQuery = useRoleTemplatesQuery();
  const librariesQuery = useLibrariesQueryForTemplates();
  const mountsQuery = useMountsQueryForTemplates();

  const { createMutation, updateMutation, deleteMutation } = useRoleTemplateMutations({
    onSettledSuccess: (message) => {
      setSuccessMessage(message);
      setFormState(createInitialFormState());
      setFormMode('create');
      setEditingRecord(null);
      setPendingDeleteRecord(null);
    },
  });

  if (roleTemplatesQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载模板管理"
        description="正在同步模板媒体库范围和默认会话限制。"
      />
    );
  }

  if (roleTemplatesQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="模板列表加载失败"
        description={getErrorMessage(roleTemplatesQuery.error)}
        action={
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => roleTemplatesQuery.refetch()}
          >
            重试
          </button>
        }
      />
    );
  }

  const items = roleTemplatesQuery.data?.items ?? [];
  const libraries = librariesQuery.data?.items ?? [];
  const mounts = mountsQuery.data?.items ?? [];
  const libraryNameMap = new Map(
    libraries.map((library) => [library.id, library.name]),
  );
  const mountOptions = mounts.map((mount) => ({
    id: mount.id,
    name: mount.name,
    pathLabel: mount.pathLabel,
  }));

  const filteredItems = items.filter((item) => {
    if (!deferredSearchKeyword) {
      return true;
    }
    const libraryText = item.defaultLibraries
      .map((libraryId) => libraryNameMap.get(libraryId) ?? libraryId)
      .join(' ');
    const sourceGrantText = item.sourceGrants
      .map((grant) => `${grant.mountId} ${grant.pathPrefix}`)
      .join(' ');
    return [item.code, item.name, item.description, libraryText, sourceGrantText]
      .join(' ')
      .toLowerCase()
      .includes(deferredSearchKeyword);
  });

  const payload = buildRoleTemplatePayload(formState);
  const saving = createMutation.isPending || updateMutation.isPending;
  const saveDisabled =
    saving ||
    formState.name.trim() === '' ||
    (formMode === 'create' && formState.code.trim() === '');
  const actionError =
    createMutation.error ?? updateMutation.error ?? deleteMutation.error;
  const systemCount = items.filter((item) => item.isSystem).length;
  const customCount = items.filter((item) => !item.isSystem).length;
  const scopedCount = items.filter((item) => item.defaultLibraries.length > 0).length;
  const unrestrictedCount = items.filter(
    (item) => !item.isSystem && item.defaultLibraries.length === 0,
  ).length;

  const handleSubmit = () => {
    setSuccessMessage(null);
    if (formMode === 'edit' && editingRecord) {
      updateMutation.mutate({
        templateId: editingRecord.id,
        payload: {
          name: payload.name,
          description: payload.description,
          defaultLibraries: payload.defaultLibraries,
          sourceGrants: payload.sourceGrants,
          defaultMaxSessions: payload.defaultMaxSessions,
          defaultValidDays: payload.defaultValidDays,
        },
      });
      return;
    }
    createMutation.mutate(payload as CreateRoleTemplateRequest);
  };

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="模板管理"
        description="普通用户模板按媒体库访问范围和会话数建模；后台管理员权限保持系统内置单层，不在这里继续拆等级。"
        meta={
          <span className={styles.metaText}>当前共 {items.length} 个有效模板</span>
        }
      />

      <RoleTemplateMetricsBoard
        total={items.length}
        systemCount={systemCount}
        customCount={customCount}
        scopedCount={scopedCount}
      />

      <InlineBanner
        variant="info"
        title="这里维护的是用户套餐草案，不是运行时权限组"
        description="当前这页主要用来整理默认媒体库、来源路径和会话数策略；真正登录后的系统角色仍按内置角色运行，后续再统一到模板链路。"
      />

      {successMessage ? (
        <InlineBanner
          variant="success"
          title={successMessage}
          description="模板列表已刷新。"
        />
      ) : null}

      {actionError ? (
        <InlineBanner
          variant="error"
          title="模板操作失败"
          description={getErrorMessage(actionError)}
        />
      ) : null}

      <RoleTemplateForm
        formMode={formMode}
        formState={formState}
        setFormState={setFormState}
        setFormMode={setFormMode}
        setEditingRecord={setEditingRecord}
        librariesQuery={librariesQuery}
        libraries={libraries}
        mountsQuery={mountsQuery}
        mountOptions={mountOptions}
        saveDisabled={saveDisabled}
        saving={saving}
        onSubmit={handleSubmit}
        onSourceGrantsChange={(next) =>
          setFormState((current) => ({ ...current, sourceGrants: next }))
        }
      />

      <RoleTemplateList
        items={items}
        filteredItems={filteredItems}
        unrestrictedCount={unrestrictedCount}
        searchKeyword={searchKeyword}
        setSearchKeyword={setSearchKeyword}
        libraryNameMap={libraryNameMap}
        setSuccessMessage={setSuccessMessage}
        setFormMode={setFormMode}
        setEditingRecord={setEditingRecord}
        setFormState={setFormState}
        setPendingDeleteRecord={setPendingDeleteRecord}
      />

      <SensitiveActionDialog
        open={pendingDeleteRecord !== null}
        actionKey="delete-role-template"
        title={pendingDeleteRecord ? `停用模板：${pendingDeleteRecord.name}` : ''}
        description="停用后该模板不会继续出现在模板列表和后续运营入口中。"
        impact={[
          '系统模板不允许停用。',
          '这次是软停用，不是物理删除。',
        ]}
        errorMessage={
          deleteMutation.isError ? getErrorMessage(deleteMutation.error) : undefined
        }
        confirmLabel="确认停用"
        pending={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteRecord(null);
          }
        }}
        onConfirm={(confirmation) => {
          if (!pendingDeleteRecord) {
            return;
          }
          deleteMutation.mutate({
            templateId: pendingDeleteRecord.id,
            confirmation,
          });
        }}
      />
    </div>
  );
}

export default ManageRoleTemplatesPage;

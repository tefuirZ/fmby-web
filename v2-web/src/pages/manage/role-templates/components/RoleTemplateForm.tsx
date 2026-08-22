import type { Dispatch, SetStateAction } from 'react';
import type {
  ManageLibraryRecord,
  ManageMountRecord,
  ManageSourcePathGrantInput,
  RoleTemplateRecord,
} from '@/domains/manage';
import { InlineBanner } from '@/shared/ui';
import { getErrorMessage } from '@/shared/utils/error';
import { ManageSectionCard } from '../../longtail-shared/components';
import { SourceGrantEditor } from '../../longtail-shared/source-governance-fields';
import styles from '../../longtail-shared/ManageShared.module.css';
import type { RoleTemplateFormState } from '../types';
import { createInitialFormState } from '../formUtils';

interface RoleTemplateFormProps {
  formMode: 'create' | 'edit';
  formState: RoleTemplateFormState;
  setFormState: Dispatch<SetStateAction<RoleTemplateFormState>>;
  setFormMode: Dispatch<SetStateAction<'create' | 'edit'>>;
  setEditingRecord: Dispatch<SetStateAction<RoleTemplateRecord | null>>;
  librariesQuery: {
    isPending: boolean;
    isError: boolean;
    error: unknown;
  };
  libraries: ManageLibraryRecord[];
  mountsQuery: {
    isPending: boolean;
    isError: boolean;
    error: unknown;
  };
  mountOptions: Array<Pick<ManageMountRecord, 'id' | 'name' | 'pathLabel'>>;
  saveDisabled: boolean;
  saving: boolean;
  onSubmit: () => void;
  onSourceGrantsChange: (next: ManageSourcePathGrantInput[]) => void;
}

export function RoleTemplateForm({
  formMode,
  formState,
  setFormState,
  setFormMode,
  setEditingRecord,
  librariesQuery,
  libraries,
  mountsQuery,
  mountOptions,
  saveDisabled,
  saving,
  onSubmit,
  onSourceGrantsChange,
}: RoleTemplateFormProps) {
  return (
    <ManageSectionCard
      title={formMode === 'edit' ? '编辑用户模板' : '创建用户模板'}
      description="模板默认媒体库留空表示不限制；默认会话数用于约束同一用户的并发播放数。"
      actions={
        formMode === 'edit' ? (
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              setFormMode('create');
              setEditingRecord(null);
              setFormState(createInitialFormState());
            }}
          >
            取消编辑
          </button>
        ) : null
      }
    >
      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <label className={styles.label}>
            模板编码
            <input
              className={styles.input}
              value={formState.code}
              disabled={formMode === 'edit'}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
              placeholder="例如：kids-room"
            />
          </label>
          <label className={styles.label}>
            模板名称
            <input
              className={styles.input}
              value={formState.name}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="例如：儿童房观影模板"
            />
          </label>
        </div>

        <label className={styles.label}>
          模板说明
          <textarea
            className={styles.textarea}
            value={formState.description}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="描述这个模板适合哪类用户使用。"
          />
        </label>

        <div className={styles.fieldRow}>
          <label className={styles.label}>
            默认最大会话数
            <input
              className={styles.input}
              type="number"
              min={0}
              value={formState.defaultMaxSessions}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  defaultMaxSessions: event.target.value,
                }))
              }
              placeholder="留空表示不限制"
            />
          </label>
          <label className={styles.label}>
            默认有效天数
            <input
              className={styles.input}
              type="number"
              min={0}
              value={formState.defaultValidDays}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  defaultValidDays: event.target.value,
                }))
              }
              placeholder="留空表示不覆盖"
            />
          </label>
        </div>

        <div className={styles.label}>
          默认媒体库授权
          {librariesQuery.isPending ? (
            <div className={styles.emptyInlineState}>正在加载媒体库列表…</div>
          ) : librariesQuery.isError ? (
            <InlineBanner
              variant="warning"
              title="媒体库列表加载失败"
              description={`当前无法拉取媒体库列表：${getErrorMessage(
                librariesQuery.error,
              )}`}
            />
          ) : libraries.length === 0 ? (
            <div className={styles.emptyInlineState}>
              当前还没有媒体库，先把媒体库建起来再配模板。
            </div>
          ) : (
            <div className={styles.selectionGrid}>
              {libraries.map((library) => {
                const checked = formState.defaultLibraries.includes(library.id);
                return (
                  <label
                    key={library.id}
                    className={`${styles.selectionCard} ${
                      checked ? styles.selectionCardActive : ''
                    }`}
                  >
                    <input
                      className={styles.checkbox}
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          defaultLibraries: event.target.checked
                            ? [...current.defaultLibraries, library.id]
                            : current.defaultLibraries.filter(
                                (libraryId) => libraryId !== library.id,
                              ),
                        }))
                      }
                    />
                    <div className={styles.selectionCardBody}>
                      <span className={styles.primaryText}>{library.name}</span>
                      <span className={styles.mutedText}>
                        {library.typeLabel} · {library.itemCount} 条资源
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          <span className={styles.fieldHint}>
            留空表示默认不限制媒体库范围，由后续授权策略决定实际可见内容。
          </span>
        </div>

        {mountsQuery.isPending ? (
          <div className={styles.emptyInlineState}>正在加载数据源列表…</div>
        ) : mountsQuery.isError ? (
          <InlineBanner
            variant="warning"
            title="数据源列表加载失败"
            description={getErrorMessage(mountsQuery.error)}
          />
        ) : (
          <SourceGrantEditor
            title="默认来源路径授权"
            description="给模板绑定来源路径后，后续套用这个模板的用户就更容易沿着同一套来源目录授权去收口。"
            mounts={mountOptions}
            value={formState.sourceGrants}
            onChange={onSourceGrantsChange}
            disabled={saving}
          />
        )}

        <div className={styles.buttonRow}>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={saveDisabled}
            onClick={onSubmit}
          >
            {saving ? '保存中…' : formMode === 'edit' ? '保存修改' : '创建模板'}
          </button>
        </div>
      </div>
    </ManageSectionCard>
  );
}

import type { Dispatch, SetStateAction } from 'react';
import type {
  ManageLibraryRecord,
  RegistrationCodeBatchMode,
  RegistrationCodeBatchRecord,
  RoleTemplateRecord,
} from '@fmby/v2-shared/contracts/manage';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../../longtail-shared/ManageShared.module.css';
import { ROLE_OPTIONS, BATCH_MODE_LABELS, BATCH_MODE_DESCRIPTIONS } from '../constants';
import {
  applyRoleTemplateToFormState,
  formatRoleTemplateLimit,
  getBatchModeLabel,
} from '../formUtils';
import type { RegistrationCodeFormState } from '../types';

export interface RegistrationCodeFormProps {
  mode: 'create' | 'edit';
  formState: RegistrationCodeFormState;
  setFormState: Dispatch<SetStateAction<RegistrationCodeFormState>>;
  editingBatch?: RegistrationCodeBatchRecord | null;
  libraries: ManageLibraryRecord[];
  librariesLoading: boolean;
  librariesError?: Error | null;
  roleTemplates: RoleTemplateRecord[];
  roleTemplatesLoading: boolean;
  roleTemplatesError?: Error | null;
  savePending: boolean;
  editActionError?: Error | null;
  onSave: () => void;
}

export function RegistrationCodeForm({
  mode,
  formState,
  setFormState,
  editingBatch,
  libraries,
  librariesLoading,
  librariesError,
  roleTemplates,
  roleTemplatesLoading,
  roleTemplatesError,
  savePending,
  editActionError,
  onSave,
}: RegistrationCodeFormProps) {
  const isCreateMode = mode === 'create';
  const isSharedCodeMode = formState.mode === 'shared-code';
  const singleUseCreateMode = isCreateMode && !isSharedCodeMode;

  // 停用的模板不该再被发到新注册码上，只挑 active 的进选择器
  const activeRoleTemplates = roleTemplates.filter(
    (template) => template.status === 'active',
  );
  const selectedRoleTemplate =
    activeRoleTemplates.find((template) => template.id === formState.roleTemplateId) ??
    null;
  // 没有可选模板时禁用下拉，避免只剩一个空选项让人以为加载失败
  const roleTemplateSelectDisabled =
    roleTemplatesLoading || activeRoleTemplates.length === 0;

  return (
    <>
      {!isCreateMode && editingBatch ? (
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              当前模式
              <div className={styles.readonlyField}>
                {getBatchModeLabel(editingBatch.mode)}
              </div>
            </label>
            <label className={styles.label}>
              覆盖范围
              <div className={styles.readonlyField}>
                {editingBatch.mode === 'shared-code'
                  ? '共享码批次，保存后直接更新这 1 条注册码'
                  : `整批覆盖 ${editingBatch.totalCodes} 条注册码的公共字段`}
              </div>
            </label>
          </div>
        </div>
      ) : null}

      {isCreateMode ? (
        <div className={styles.fieldGroup}>
          <div className={styles.label}>
            创建模式
            <div className={styles.selectionGrid}>
              {(['single-use-batch', 'shared-code'] as RegistrationCodeBatchMode[]).map(
                (modeOption) => (
                  <label
                    key={modeOption}
                    className={`${styles.selectionCard} ${
                      formState.mode === modeOption ? styles.selectionCardActive : ''
                    }`}
                  >
                    <input
                      className={styles.checkbox}
                      type="radio"
                      name="registration-batch-mode"
                      checked={formState.mode === modeOption}
                      onChange={() =>
                        setFormState((current) => ({
                          ...current,
                          mode: modeOption,
                          usageLimit:
                            modeOption === 'single-use-batch' ? '0' : current.usageLimit,
                        }))
                      }
                    />
                    <div className={styles.selectionCardBody}>
                      <span className={styles.primaryText}>
                        {BATCH_MODE_LABELS[modeOption]}
                      </span>
                      <span className={styles.mutedText}>
                        {BATCH_MODE_DESCRIPTIONS[modeOption]}
                      </span>
                    </div>
                  </label>
                ),
              )}
            </div>
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.label}>
              批次名称
              <input
                className={styles.input}
                value={formState.batchName}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    batchName: event.target.value,
                  }))
                }
                placeholder={
                  isSharedCodeMode
                    ? '例如：渠道长期入口码'
                    : '例如：四月新用户批次'
                }
              />
            </label>

            {singleUseCreateMode ? (
              <label className={styles.label}>
                生成数量
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  value={formState.generateCount}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      generateCount: event.target.value,
                    }))
                  }
                  placeholder="一次生成多少条"
                />
              </label>
            ) : (
              <label className={styles.label}>
                共享注册码
                <input
                  className={styles.input}
                  value={formState.code}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                  placeholder="留空则自动生成"
                />
              </label>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              批次名称
              <input
                className={styles.input}
                value={formState.batchName}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    batchName: event.target.value,
                  }))
                }
                placeholder="例如：四月新用户批次"
              />
            </label>

            {isSharedCodeMode ? (
              <label className={styles.label}>
                共享注册码
                <input
                  className={styles.input}
                  value={formState.code}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                  placeholder="请输入共享注册码"
                />
              </label>
            ) : (
              <label className={styles.label}>
                当前批次规模
                <div className={styles.readonlyField}>
                  {editingBatch?.totalCodes ?? 0} 条一次性注册码
                </div>
              </label>
            )}
          </div>
        </div>
      )}

      {!isCreateMode && editActionError ? (
        <InlineBanner
          variant="error"
          title="注册码编辑失败"
          description={getErrorMessage(editActionError)}
        />
      ) : null}

      <div className={styles.fieldGroup}>
        <div className={styles.label}>
          当前生效系统角色
          <div className={styles.selectionGrid}>
            {ROLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`${styles.selectionCard} ${
                  formState.roleTemplate === option.value
                    ? styles.selectionCardActive
                    : ''
                }`}
              >
                <input
                  className={styles.checkbox}
                  type="radio"
                  name={`registration-role-template-${mode}`}
                  checked={formState.roleTemplate === option.value}
                  onChange={() =>
                    setFormState((current) => ({
                      ...current,
                      roleTemplate: option.value,
                    }))
                  }
                />
                <div className={styles.selectionCardBody}>
                  <span className={styles.primaryText}>{option.label}</span>
                  <span className={styles.mutedText}>{option.description}</span>
                </div>
              </label>
            ))}
          </div>
          <span className={styles.fieldHint}>
            这里选定的系统角色会直接写进用这批注册码开通的账号，具体授权范围再由下面的角色模板和媒体库设置决定。
          </span>
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.label}>
            角色模板
            {/*
              value 取回查到的模板 id 兜底：模板在表单打开期间被停用时下拉里已经没有
              对应选项，直接用 formState 里的旧 id 会让下拉渲染成空白
            */}
            <select
              className={styles.select}
              disabled={roleTemplateSelectDisabled}
              value={selectedRoleTemplate?.id ?? ''}
              onChange={(event) => {
                const nextTemplate =
                  activeRoleTemplates.find(
                    (template) => template.id === event.target.value,
                  ) ?? null;
                setFormState((current) =>
                  applyRoleTemplateToFormState(current, nextTemplate),
                );
              }}
            >
              <option value="">不套用模板</option>
              {activeRoleTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <span className={styles.fieldHint}>
              选中模板会把模板里的默认媒体库授权、最大会话数和有效天数写进下面对应的字段，用这批注册码注册的账号就按这套授权开通。写入后仍可逐项调整，最终以下面填写的值为准。
            </span>
          </label>
        </div>

        {roleTemplatesLoading ? (
          <div className={styles.emptyInlineState}>正在加载角色模板…</div>
        ) : roleTemplatesError ? (
          <InlineBanner
            variant="warning"
            title="角色模板列表加载失败"
            description={`你仍然可以手工填写下面的授权字段并保存注册码，只是这次没法直接套用模板：${getErrorMessage(
              roleTemplatesError,
            )}`}
          />
        ) : activeRoleTemplates.length === 0 ? (
          <div className={styles.emptyInlineState}>
            还没有启用中的角色模板。可以先到「角色模板」页建一个常用授权组合，也可以直接在下面逐项填写这批注册码的授权。
          </div>
        ) : selectedRoleTemplate ? (
          <InlineBanner
            variant="info"
            title={`已套用模板：${selectedRoleTemplate.name}`}
            description={`默认媒体库 ${
              selectedRoleTemplate.defaultLibraries.length
            } 个，最大会话数 ${formatRoleTemplateLimit(
              selectedRoleTemplate.defaultMaxSessions,
            )}，有效天数 ${formatRoleTemplateLimit(
              selectedRoleTemplate.defaultValidDays,
            )}，均已写入下面的字段。${
              selectedRoleTemplate.sourceGrants.length > 0
                ? `模板里的 ${selectedRoleTemplate.sourceGrants.length} 条来源路径授权不随注册码下发，需要在账号建好后到用户管理里单独授予。`
                : ''
            }`}
          />
        ) : null}

        <div className={styles.fieldRow}>
          {isSharedCodeMode ? (
            <label className={styles.label}>
              最大使用次数
              <input
                className={styles.input}
                type="number"
                min={0}
                value={formState.usageLimit}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    usageLimit: event.target.value,
                  }))
                }
                placeholder="0 表示不限"
              />
              <span className={styles.fieldHint}>共享码支持 0 表示不限。</span>
            </label>
          ) : (
            <label className={styles.label}>
              最大使用次数
              <div className={styles.readonlyField}>
                批量单次码固定为 1，这里不支持单独改上限。
              </div>
            </label>
          )}
          <label className={styles.label}>
            默认最大会话数
            <input
              className={styles.input}
              type="number"
              min={0}
              value={formState.maxSessions}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  maxSessions: event.target.value,
                }))
              }
              placeholder="留空表示不覆盖"
            />
          </label>
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.label}>
            默认有效天数
            <input
              className={styles.input}
              type="number"
              min={0}
              value={formState.validDays}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  validDays: event.target.value,
                }))
              }
              placeholder="留空表示不覆盖"
            />
          </label>
          <label className={styles.label}>
            过期时间
            <input
              className={styles.input}
              type="datetime-local"
              value={formState.expiresAt}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  expiresAt: event.target.value,
                }))
              }
            />
            <span className={styles.fieldHint}>按上海时间录入。</span>
          </label>
        </div>

        <div className={styles.label}>
          默认媒体库授权
          {librariesLoading ? (
            <div className={styles.emptyInlineState}>正在加载媒体库列表…</div>
          ) : librariesError ? (
            <InlineBanner
              variant="warning"
              title="媒体库列表加载失败"
              description={`你仍然可以保存注册码，但默认媒体库选择暂时不可用：${getErrorMessage(
                librariesError,
              )}`}
            />
          ) : libraries.length === 0 ? (
            <div className={styles.emptyInlineState}>
              当前还没有可授权的媒体库，先去把媒体库建起来。
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
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.switchRow}>
            <input
              className={styles.switchInput}
              type="checkbox"
              checked={formState.allowReactivation}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  allowReactivation: event.target.checked,
                }))
              }
            />
            <div className={styles.selectionCardBody}>
              <span className={styles.primaryText}>允许重新激活</span>
              <span className={styles.mutedText}>
                注册码用户后续可按策略重新激活账号。
              </span>
            </div>
          </label>

          <label className={styles.switchRow}>
            <input
              className={styles.switchInput}
              type="checkbox"
              checked={formState.requireApproval}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  requireApproval: event.target.checked,
                }))
              }
            />
            <div className={styles.selectionCardBody}>
              <span className={styles.primaryText}>需要审批</span>
              <span className={styles.mutedText}>
                使用该注册码注册的账号进入待审核流程。
              </span>
            </div>
          </label>
        </div>

        <div className={styles.buttonRow}>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={savePending}
            onClick={onSave}
          >
            {savePending
              ? '保存中…'
              : !isCreateMode
                ? '保存修改'
                : formState.mode === 'shared-code'
                  ? '创建共享码'
                  : '创建注册码批次'}
          </button>
        </div>
      </div>
    </>
  );
}

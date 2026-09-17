/** 注册码批次的创建/编辑基础字段区（V1F 拆分：RegistrationCodeForm → 子组件）。 */

import type { Dispatch, SetStateAction } from 'react';
import type {
  RegistrationCodeBatchMode,
  RegistrationCodeBatchRecord,
} from '@fmby/v2-shared/contracts/manage';
import styles from '../../longtail-shared/ManageShared.module.css';
import { BATCH_MODE_LABELS, BATCH_MODE_DESCRIPTIONS } from '../constants';
import { getBatchModeLabel } from '../formUtils';
import type { RegistrationCodeFormState } from '../types';

interface RegistrationCodeBatchBasicsProps {
  isCreateMode: boolean;
  editingBatch?: RegistrationCodeBatchRecord | null;
  formState: RegistrationCodeFormState;
  setFormState: Dispatch<SetStateAction<RegistrationCodeFormState>>;
}

export function RegistrationCodeBatchBasics({
  isCreateMode,
  editingBatch,
  formState,
  setFormState,
}: RegistrationCodeBatchBasicsProps) {
  const isSharedCodeMode = formState.mode === 'shared-code';
  const singleUseCreateMode = isCreateMode && !isSharedCodeMode;
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
    </>
  );
}

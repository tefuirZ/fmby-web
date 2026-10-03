import { useEffect, useMemo, useState } from 'react';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import {
  manageApi,
  type DirectRegistrationSettings,
} from '@fmby/v2-shared/contracts/manage';
import { ManageSectionCard } from '../../components';
import styles from '../../longtail-shared/ManageShared.module.css';
import {
  useDirectRegistrationSettingsQuery,
  useSaveDirectRegistrationSettings,
} from '../hooks/useDirectRegistrationSettings';

/**
 * 「直接注册窗口」设置区（FE-REGISTRATION-WINDOW-UI）。
 *
 * 后端真源：`DirectRegistrationSettingsDto` @ `crates/fmby-v2-contracts/src/dto_registration.rs:17`
 * 端点：`GET/PUT /api/manage/users/direct-registration/settings`
 *      （`crates/fmby-v2-http/src/routes/manage_registration_window.rs`）
 *
 * ★时间：后端以 **epoch 毫秒** 判定（`availability_of(cfg, now_ms)`），表单用
 *   `datetime-local`（秒级）⇒ 经 `manageApi.fromDateTimeLocal/toDateTimeLocal`
 *   **显式换算**，不猜单位。
 * ★边界照后端（不自行收紧/放宽）：`start_at` 须**严格早于** `end_at`；
 *   起止**含边界放行**（`now_ms < start_at` / `now_ms > end_at` 才拒）；
 *   未配置/未启用/损坏 ⇒ 关闭（fail-closed）；名额满拒。
 * ★诚实错误：后端 `Validation` 原文直出，不吞不自动纠正。
 */
export function DirectRegistrationSection() {
  const query = useDirectRegistrationSettingsQuery();
  const saveMutation = useSaveDirectRegistrationSettings();
  const [draft, setDraft] = useState<DirectRegistrationSettings | null>(null);

  // 以服务端真值初始化/复位（PUT 是 replace ⇒ 以响应为准，不本地乐观臆造）
  useEffect(() => {
    if (query.data) setDraft(query.data);
  }, [query.data]);

  const timeFields = useMemo(
    () => ({
      startAt: manageApi.toDateTimeLocal(draft?.startAt ?? null),
      endAt: manageApi.toDateTimeLocal(draft?.endAt ?? null),
    }),
    [draft?.startAt, draft?.endAt],
  );

  const card = (body: React.ReactNode) => (
    <ManageSectionCard
      title="直接注册窗口"
      description="控制站点是否开放「直接注册」（无需邀请码）。未启用或未配置时一律关闭。"
    >
      {body}
    </ManageSectionCard>
  );

  if (query.isPending) {
    return card(
      <div className={styles.fieldHint}>正在读取直接注册设置…</div>,
    );
  }

  if (query.isError || !draft) {
    return card(
      <FeedbackState
        variant="error"
        title="无法读取直接注册设置"
        description={getErrorMessage(query.error)}
        action={
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => void query.refetch()}
          >
            重试
          </button>
        }
      />,
    );
  }

  const patch = (next: Partial<DirectRegistrationSettings>) =>
    setDraft((prev: DirectRegistrationSettings | null) =>
      prev ? { ...prev, ...next } : prev,
    );

  return card(
    <>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={draft.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        启用直接注册
      </label>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          开始时间（可选）
          <input
            type="datetime-local"
            aria-label="直接注册开始时间"
            value={timeFields.startAt}
            onChange={(e) =>
              patch({ startAt: manageApi.fromDateTimeLocal(e.target.value) })
            }
          />
        </label>
        <label className={styles.label}>
          结束时间（可选）
          <input
            type="datetime-local"
            aria-label="直接注册结束时间"
            value={timeFields.endAt}
            onChange={(e) =>
              patch({ endAt: manageApi.fromDateTimeLocal(e.target.value) })
            }
          />
        </label>
        <label className={styles.label}>
          名额上限（可选，留空 = 不限）
          <input
            type="number"
            min={0}
            aria-label="直接注册名额上限"
            placeholder="不限"
            value={draft.maxUsers ?? ''}
            onChange={(e) =>
              patch({
                maxUsers: e.target.value.trim() ? Number(e.target.value) : null,
              })
            }
          />
        </label>
        <label className={styles.label}>
          默认权限模板（启用时必填）
          <input
            type="text"
            aria-label="直接注册默认权限模板"
            placeholder="例如：viewer"
            value={draft.defaultRoleTemplate ?? ''}
            onChange={(e) =>
              patch({
                defaultRoleTemplate: e.target.value.trim()
                  ? e.target.value.trim()
                  : null,
              })
            }
          />
        </label>
        <div className={styles.fieldHint}>
          时间为空表示不限制；后端判定含边界（正好等于开始/结束时刻仍可注册）。
        </div>
      </div>

      {saveMutation.isError ? (
        <FeedbackState
          variant="error"
          title="保存失败"
          description={getErrorMessage(saveMutation.error)}
        />
      ) : null}

      <div className={styles.buttonRow}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate(draft)}
        >
          {saveMutation.isPending ? '保存中…' : '保存设置'}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={saveMutation.isPending || !query.data}
          onClick={() => setDraft(query.data ?? null)}
        >
          撤销修改
        </button>
      </div>
    </>,
  );
}

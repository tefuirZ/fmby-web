/**
 * 个人资料设置页（暗房）
 * 数据逻辑移植自旧 UI src/pages/settings/ProfileSettingsPage.tsx。
 */
import { InlineBanner, Input, Select, Textarea } from '@/shared/ui';
import { settingsApi, type UserProfileSettings } from '@/domains/settings';
import { queryKeys } from '@/shared/query-keys';
import { getErrorMessage } from '@/shared/utils/error';
import styles from './SettingsCenter.module.css';
import {
  SettingsFeedbackGate,
  SettingsPageHeader,
  SettingsSectionCard,
  StickySaveBar,
  resolveSettingsQueryState,
  useEditableSettings,
} from './components';

export function ProfileSettingsPage() {
  const settings = useEditableSettings<UserProfileSettings>({
    queryKey: queryKeys.settings.profile(),
    load: () => settingsApi.getUserProfile(),
    save: (draft) => settingsApi.saveUserProfile(draft),
    successMessage: '个人资料已保存。',
  });

  const state = resolveSettingsQueryState(settings.query, settings.draft);
  if (state !== 'ready' && state !== 'partial' && state !== 'outdated') {
    return (
      <SettingsFeedbackGate
        state={state}
        scopeLabel="个人资料"
        error={settings.query.error}
        onRetry={() => settings.query.refetch()}
      />
    );
  }

  const draft = settings.draft!;
  const patch = (partial: Partial<UserProfileSettings>) => {
    settings.setSuccess(null);
    settings.setDraft({ ...draft, ...partial });
  };

  return (
    <div className={styles.pageSections}>
      <SettingsPageHeader
        title="个人资料"
        description="管理个人基础信息、默认媒体库和对外展示内容。"
        meta="按当前分组单独保存。"
      />

      {state === 'outdated' ? (
        <InlineBanner
          variant="warning"
          title="当前展示的可能是过期数据"
          description={`刷新失败：${getErrorMessage(settings.query.error)}，正在展示上次成功加载的内容。`}
        />
      ) : null}
      {state === 'partial' ? (
        <div className={styles.softNotice}>正在后台刷新最新配置…</div>
      ) : null}

      {settings.success ? (
        <InlineBanner variant="success" title={settings.success} description="修改已生效。" />
      ) : null}

      {settings.mutation.isError ? (
        <InlineBanner
          variant="error"
          title="保存个人资料失败"
          description={getErrorMessage(settings.mutation.error)}
        />
      ) : null}

      <SettingsSectionCard title="基础信息" description="这些信息会影响账号展示与默认进入体验。">
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            用户名
            <Input value={draft.username} disabled />
            <span className={styles.fieldHint}>用户名由服务端维护，此处只读展示。</span>
          </label>
          <label className={styles.field}>
            显示名称
            <Input
              value={draft.displayName}
              onChange={(event) => patch({ displayName: event.target.value })}
            />
          </label>
          <label className={styles.field}>
            头像链接
            <Input
              value={draft.avatarUrl}
              onChange={(event) => patch({ avatarUrl: event.target.value })}
              placeholder="https://example.com/avatar.png"
            />
          </label>
          <div className={styles.field}>
            默认媒体库
            <Select
              aria-label="默认媒体库"
              value={draft.defaultLibraryId || '__none__'}
              onValueChange={(value) =>
                patch({ defaultLibraryId: value === '__none__' ? '' : value })
              }
              options={[
                { value: '__none__', label: '不指定' },
                ...draft.availableLibraries.map((library) => ({
                  value: library.value,
                  label: library.label,
                })),
              ]}
            />
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title="联系与简介" description="用于账号页和系统内展示。">
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            邮箱
            <Input
              value={draft.email}
              onChange={(event) => patch({ email: event.target.value })}
            />
          </label>
          <label className={`${styles.field} ${styles.fieldSpan}`}>
            简介
            <Textarea
              value={draft.bio}
              onChange={(event) => patch({ bio: event.target.value })}
            />
          </label>
        </div>
      </SettingsSectionCard>

      {draft.currentPasswordRequired ? (
        <SettingsSectionCard
          title="安全确认"
          description="当前站点策略要求修改个人资料时校验一次当前密码。"
        >
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              当前密码
              <Input
                type="password"
                value={draft.currentPassword}
                onChange={(event) => patch({ currentPassword: event.target.value })}
                placeholder="保存资料前输入当前密码"
                autoComplete="current-password"
              />
              <span className={styles.fieldHint}>
                只在本次保存时使用，保存成功后会自动清空。
              </span>
            </label>
          </div>
        </SettingsSectionCard>
      ) : null}

      <StickySaveBar
        dirty={settings.isDirty}
        pending={settings.mutation.isPending}
        success={settings.success}
        onReset={() => settings.reset()}
        onSave={() => settings.save()}
      />
    </div>
  );
}

export default ProfileSettingsPage;

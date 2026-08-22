/**
 * 外观设置页（暗房）
 * 数据逻辑移植自旧 UI src/pages/settings/AppearanceSettingsPage.tsx。
 */
import { InlineBanner, Select, Switch } from '@fmby/v2-shared/ui';
import { settingsApi, type UserAppearanceSettings } from '@fmby/v2-shared/contracts/settings';
import { queryKeys } from '@fmby/v2-shared/query';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './SettingsCenter.module.css';
import {
  SettingsFeedbackGate,
  SettingsPageHeader,
  SettingsSectionCard,
  StickySaveBar,
  resolveSettingsQueryState,
  useEditableSettings,
} from './components';

export function AppearanceSettingsPage() {
  const settings = useEditableSettings<UserAppearanceSettings>({
    queryKey: queryKeys.settings.appearance(),
    load: () => settingsApi.getUserAppearance(),
    save: (draft) => settingsApi.saveUserAppearance(draft),
    successMessage: '外观设置已保存。',
  });

  const state = resolveSettingsQueryState(settings.query, settings.draft);
  if (state !== 'ready' && state !== 'partial' && state !== 'outdated') {
    return (
      <SettingsFeedbackGate
        state={state}
        scopeLabel="外观设置"
        error={settings.query.error}
        onRetry={() => settings.query.refetch()}
      />
    );
  }

  const draft = settings.draft!;
  const patch = (partial: Partial<UserAppearanceSettings>) => {
    settings.setSuccess(null);
    settings.setDraft({ ...draft, ...partial });
  };

  return (
    <div className={styles.pageSections}>
      <SettingsPageHeader
        title="外观"
        description="统一控制主题、浏览密度和动效偏好，兼顾桌面端与移动端。"
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
        <InlineBanner variant="success" title={settings.success} description="界面偏好已更新。" />
      ) : null}

      {settings.mutation.isError ? (
        <InlineBanner
          variant="error"
          title="保存外观设置失败"
          description={getErrorMessage(settings.mutation.error)}
        />
      ) : null}

      <SettingsSectionCard title="视觉模式" description="主题与信息密度直接影响浏览体验。">
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            主题
            <Select
              aria-label="主题"
              value={draft.theme}
              onValueChange={(value) =>
                patch({ theme: value as UserAppearanceSettings['theme'] })
              }
              options={[
                { value: 'system', label: '跟随系统' },
                { value: 'dark', label: '深色' },
                { value: 'light', label: '浅色' },
              ]}
            />
          </div>
          <div className={styles.field}>
            海报密度
            <Select
              aria-label="海报密度"
              value={draft.posterDensity}
              onValueChange={(value) =>
                patch({
                  posterDensity: value as UserAppearanceSettings['posterDensity'],
                })
              }
              options={[
                { value: 'comfortable', label: '舒适' },
                { value: 'compact', label: '紧凑' },
              ]}
            />
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title="动效与首页模块" description="支持减少动效和模块级显隐。">
        <div className={styles.compactList}>
          <label className={styles.switchRow}>
            <Switch
              checked={draft.reducedMotion}
              onCheckedChange={(checked) => patch({ reducedMotion: checked })}
              aria-label="减少动效"
            />
            <div className={styles.switchBody}>
              <strong>减少动效</strong>
              <span className={styles.fieldHint}>降低页面切换与组件微动效。</span>
            </div>
          </label>

          <div className={styles.compactList}>
            {draft.homeSections.map((section) => (
              <label className={styles.reorderRow} key={section.id}>
                <div className={styles.switchBody}>
                  <strong>{section.label}</strong>
                  <span className={styles.fieldHint}>控制首页模块是否显示。</span>
                </div>
                <Switch
                  checked={section.enabled}
                  aria-label={`显示模块：${section.label}`}
                  onCheckedChange={(checked) =>
                    patch({
                      homeSections: draft.homeSections.map((item) =>
                        item.id === section.id ? { ...item, enabled: checked } : item,
                      ),
                    })
                  }
                />
              </label>
            ))}
          </div>
        </div>
      </SettingsSectionCard>

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

export default AppearanceSettingsPage;

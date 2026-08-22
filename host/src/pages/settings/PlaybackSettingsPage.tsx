/**
 * 播放偏好设置页（暗房）
 * 数据逻辑移植自旧 UI src/pages/settings/PlaybackSettingsPage.tsx，
 * 含本机播放器内核（PlayerEngineId）本地开关。
 */
import { useState } from 'react';
import { InlineBanner, Select, Switch } from '@/shared/ui';
import { settingsApi, type UserPlaybackSettings } from '@/domains/settings';
import {
  resolvePlayerEngineId,
  setPlayerEngineId,
  type PlayerEngineId,
} from '@/features/player';
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

interface SwitchItemProps {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function SwitchItem({ label, hint, checked, onCheckedChange }: SwitchItemProps) {
  return (
    <label className={styles.switchRow}>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
      <div className={styles.switchBody}>
        <strong>{label}</strong>
        <span className={styles.fieldHint}>{hint}</span>
      </div>
    </label>
  );
}

export function PlaybackSettingsPage() {
  const [playerEngine, setPlayerEngine] = useState<PlayerEngineId>(() =>
    resolvePlayerEngineId(),
  );
  const settings = useEditableSettings<UserPlaybackSettings>({
    queryKey: queryKeys.settings.playback(),
    load: () => settingsApi.getUserPlayback(),
    save: (draft) => settingsApi.saveUserPlayback(draft),
    successMessage: '播放偏好已保存。',
  });

  const state = resolveSettingsQueryState(settings.query, settings.draft);
  if (state !== 'ready' && state !== 'partial' && state !== 'outdated') {
    return (
      <SettingsFeedbackGate
        state={state}
        scopeLabel="播放偏好"
        error={settings.query.error}
        onRetry={() => settings.query.refetch()}
      />
    );
  }

  const draft = settings.draft!;
  const patch = (partial: Partial<UserPlaybackSettings>) => {
    settings.setSuccess(null);
    settings.setDraft({ ...draft, ...partial });
  };
  const handlePlayerEngineChange = (engineId: PlayerEngineId) => {
    setPlayerEngine(engineId);
    setPlayerEngineId(engineId);
  };

  const languageOptions = draft.availableLanguages.map((language) => ({
    value: language.value,
    label: language.label,
  }));

  return (
    <div className={styles.pageSections}>
      <SettingsPageHeader
        title="播放偏好"
        description="控制字幕、音轨和继续播放行为，不把播放器细节塞进管理中心。"
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
        <InlineBanner
          variant="success"
          title={settings.success}
          description="下次播放将按新偏好执行。"
        />
      ) : null}

      {settings.mutation.isError ? (
        <InlineBanner
          variant="error"
          title="保存播放偏好失败"
          description={getErrorMessage(settings.mutation.error)}
        />
      ) : null}

      <SettingsSectionCard title="默认轨道" description="优先设置你的字幕和音轨偏好。">
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            默认字幕语言
            <Select
              aria-label="默认字幕语言"
              value={draft.subtitleLanguage}
              onValueChange={(value) => patch({ subtitleLanguage: value })}
              options={languageOptions}
            />
          </div>
          <div className={styles.field}>
            默认音轨语言
            <Select
              aria-label="默认音轨语言"
              value={draft.audioLanguage}
              onValueChange={(value) => patch({ audioLanguage: value })}
              options={languageOptions}
            />
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title="继续播放与外部播放器" description="这些偏好会影响回放恢复体验。">
        <div className={styles.compactList}>
          <SwitchItem
            label="自动恢复播放"
            hint="下次打开同一内容时从上次进度继续。"
            checked={draft.resumePlayback}
            onCheckedChange={(checked) => patch({ resumePlayback: checked })}
          />
          <SwitchItem
            label="自动播放下一集"
            hint="剧集结束后自动衔接下一集。"
            checked={draft.autoplayNextEpisode}
            onCheckedChange={(checked) => patch({ autoplayNextEpisode: checked })}
          />
          <SwitchItem
            label="优先外部播放器"
            hint="在支持时优先跳转系统播放器。"
            checked={draft.preferExternalPlayer}
            onCheckedChange={(checked) => patch({ preferExternalPlayer: checked })}
          />
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="网页播放器内核"
        description="这是本机实验开关，立即影响当前浏览器，不改后端媒体链路。"
      >
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            播放器引擎
            <Select
              aria-label="播放器引擎"
              value={playerEngine}
              onValueChange={(value) => handlePlayerEngineChange(value as PlayerEngineId)}
              options={[
                { value: 'dplayer', label: 'DPlayer（稳定回退）' },
                { value: 'artplayer', label: 'ArtPlayer（实验）' },
              ]}
            />
          </div>
          <div className={styles.field}>
            当前策略
            <span className={styles.fieldHint}>
              {playerEngine === 'artplayer'
                ? '已在本机启用 ArtPlayer。若遇到格式兼容问题，可随时切回 DPlayer 或使用外部播放器。'
                : '当前使用 DPlayer，ArtPlayer 可作为实验内核灰度启用。'}
            </span>
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

export default PlaybackSettingsPage;

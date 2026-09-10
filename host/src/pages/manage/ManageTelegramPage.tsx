import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  isBackendUnavailableError,
  peripheralsApi,
  type TelegramBotConfigRecord,
} from '@fmby/v2-shared/contracts/manage/peripherals';
import { FeedbackState, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';

const HEALTH_LABELS: Record<string, string> = {
  ready: '就绪（长轮询运行中）',
  not_configured: '未配置',
};

const telegramStatusKey = ['manage', 'telegram-bot', 'status'] as const;
const telegramConfigKey = ['manage', 'telegram-bot', 'config'] as const;

function formatEpochMs(epochMs: number): string {
  if (!Number.isFinite(epochMs) || epochMs <= 0) {
    return '—';
  }
  return new Date(epochMs).toLocaleString('zh-CN', { hour12: false });
}

function chatIdsToText(ids: string[]): string {
  return ids.join('\n');
}

function parseChatIds(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function configToDraft(config: TelegramBotConfigRecord) {
  return {
    enabled: config.enabled,
    apiBase: config.apiBase ?? '',
    allowedChatIdsText: chatIdsToText(config.allowedChatIds),
  };
}

export function ManageTelegramPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<{
    enabled: boolean;
    apiBase: string;
    allowedChatIdsText: string;
  } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: telegramStatusKey,
    queryFn: async () => {
      try {
        return await peripheralsApi.getTelegramBotStatus();
      } catch (err) {
        if (isBackendUnavailableError(err)) {
          return null;
        }
        throw err;
      }
    },
  });

  const configQuery = useQuery({
    queryKey: telegramConfigKey,
    queryFn: async () => {
      try {
        return await peripheralsApi.getTelegramBotConfig();
      } catch (err) {
        if (isBackendUnavailableError(err)) {
          return null;
        }
        throw err;
      }
    },
  });

  useEffect(() => {
    if (configQuery.data) {
      setDraft(configToDraft(configQuery.data));
    }
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!draft) {
        throw new Error('配置草稿尚未就绪');
      }
      return peripheralsApi.putTelegramBotConfig({
        enabled: draft.enabled,
        apiBase: draft.apiBase.trim() === '' ? null : draft.apiBase.trim(),
        allowedChatIds: parseChatIds(draft.allowedChatIdsText),
      });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(telegramConfigKey, saved);
      setDraft(configToDraft(saved));
      setBanner('配置已写入。进程重启后长轮询 worker 才会按新值装配。');
      void queryClient.invalidateQueries({ queryKey: telegramStatusKey });
    },
  });

  if (statusQuery.isPending || configQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在读取 Telegram Bot"
        description="正在拉取运行状态与配置草稿。"
      />
    );
  }

  if (statusQuery.isError || configQuery.isError) {
    const error = statusQuery.error ?? configQuery.error;
    return (
      <FeedbackState
        variant="error"
        title="Telegram Bot 读取失败"
        description={getErrorMessage(error)}
        action={
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => {
              void statusQuery.refetch();
              void configQuery.refetch();
            }}
          >
            重试
          </button>
        }
      />
    );
  }

  const status = statusQuery.data;
  const configUnavailable = configQuery.data === null;

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="Telegram Bot 配置"
        description="启用开关、自定义 API 基址与允许的 chat id。Bot Token 走密钥链，本页不展示明文。"
        meta={
          status ? (
            <span className={styles.metaText}>状态生成时间：{formatEpochMs(status.generatedAt)}</span>
          ) : (
            <span className={styles.metaText}>运行状态端点未装配，仅保留配置草稿入口。</span>
          )
        }
        actions={
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              void statusQuery.refetch();
              void configQuery.refetch();
            }}
          >
            刷新
          </button>
        }
      />

      {status ? (
        <ManageSectionCard title="运行状态" description="健康度由服务端按配置与长轮询 worker 装配情况判定。">
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>
                <StatusBadge
                  label={HEALTH_LABELS[status.health] ?? status.health}
                  variant={status.health === 'ready' ? 'success' : 'warning'}
                />
              </div>
              <div className={styles.metricLabel}>健康度</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>
                <StatusBadge
                  label={status.enabled ? '已启用' : '未启用'}
                  variant={status.enabled ? 'success' : 'neutral'}
                />
              </div>
              <div className={styles.metricLabel}>功能开关</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>
                <StatusBadge
                  label={status.configured ? '已配置' : '未配置'}
                  variant={status.configured ? 'success' : 'danger'}
                />
              </div>
              <div className={styles.metricLabel}>Token 配置</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{status.allowedChatCount}</div>
              <div className={styles.metricLabel}>允许的会话数</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>
                <StatusBadge
                  label={status.customApiBase ? '自定义' : '官方默认'}
                  variant={status.customApiBase ? 'info' : 'neutral'}
                />
              </div>
              <div className={styles.metricLabel}>API 地址来源</div>
            </div>
          </div>
        </ManageSectionCard>
      ) : (
        <ManageSectionCard title="运行状态未装配" description="GET /api/manage/telegram-bot/status 当前不可用。">
          <InlineBanner
            variant="info"
            title="状态端点 fail-closed"
            description="后端未返回运行快照。本页不伪造 ready/未配置数据。"
          />
        </ManageSectionCard>
      )}

      {configUnavailable || !draft ? (
        <ManageSectionCard
          title="配置端口未装配"
          description="GET/PUT /api/manage/telegram-bot/config 由本卡冻结，后端写端口另行开卡。"
        >
          <InlineBanner
            variant="info"
            title="等待后端装配"
            description="配置端点尚未提供。页面不以空表单冒充已保存配置，也不把 Token 明文写进本页。"
          />
          <button className={styles.secondaryButton} type="button" onClick={() => void configQuery.refetch()}>
            重新检测
          </button>
        </ManageSectionCard>
      ) : (
        <ManageSectionCard
          title="Bot 配置"
          description="allowedChatIds 一行一个或逗号分隔。自定义 apiBase 留空表示官方默认。"
        >
          {banner ? <InlineBanner variant="success" title={banner} /> : null}
          {saveMutation.isError ? (
            <InlineBanner
              variant="error"
              title="保存失败"
              description={getErrorMessage(saveMutation.error)}
            />
          ) : null}
          <form
            className={styles.fieldGroup}
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate();
            }}
          >
            <label className={styles.checkboxRow}>
              <input
                className={styles.checkbox}
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, enabled: event.target.checked } : current,
                  )
                }
              />
              <span>启用 Telegram Bot</span>
            </label>
            <label className={styles.label}>
              自定义 API 基址（apiBase）
              <input
                className={styles.input}
                value={draft.apiBase}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, apiBase: event.target.value } : current,
                  )
                }
                placeholder="https://api.telegram.org（留空=官方默认）"
              />
            </label>
            <label className={styles.label}>
              允许的 chat id（allowedChatIds）
              <textarea
                className={styles.textarea}
                rows={6}
                value={draft.allowedChatIdsText}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, allowedChatIdsText: event.target.value } : current,
                  )
                }
                placeholder={'10086\n20088'}
              />
            </label>
            <div className={styles.buttonRow}>
              <button className={styles.primaryButton} type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? '保存中…' : '保存配置'}
              </button>
            </div>
          </form>
        </ManageSectionCard>
      )}
    </div>
  );
}

export default ManageTelegramPage;

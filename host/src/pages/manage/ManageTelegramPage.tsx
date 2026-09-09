import { useQuery } from '@tanstack/react-query';
import { peripheralsApi } from '@fmby/v2-shared/contracts/manage/peripherals';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';

const HEALTH_LABELS: Record<string, string> = {
  ready: '就绪（长轮询运行中）',
  not_configured: '未配置',
};

function formatEpochMs(epochMs: number): string {
  if (!Number.isFinite(epochMs) || epochMs <= 0) {
    return '—';
  }
  return new Date(epochMs).toLocaleString('zh-CN', { hour12: false });
}

export function ManageTelegramPage() {
  const statusQuery = useQuery({
    queryKey: queryKeys.manage.telegramBot.status(),
    queryFn: () => peripheralsApi.getTelegramBotStatus(),
  });

  if (statusQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在读取 Telegram Bot 状态"
        description="正在从服务端拉取 Bot 配置摘要。"
      />
    );
  }

  if (statusQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="Telegram Bot 状态读取失败"
        description={getErrorMessage(statusQuery.error)}
        action={
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => statusQuery.refetch()}
          >
            重试
          </button>
        }
      />
    );
  }

  const status = statusQuery.data;

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="Telegram Bot 状态"
        description="Bot 配置与运行形态的只读摘要；Bot Token 与 API 地址属于敏感配置，只在站点设置中维护，本页不展示明文。"
        meta={
          <span className={styles.metaText}>
            状态生成时间：{formatEpochMs(status.generatedAt)}
          </span>
        }
        actions={
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => statusQuery.refetch()}
          >
            刷新状态
          </button>
        }
      />

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
        </div>
      </ManageSectionCard>

      <ManageSectionCard title="连接形态" description="v2 仅支持长轮询模式；自定义 API 地址用于自建 Bot API 网络的场景。">
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>{status.mode}</div>
            <div className={styles.metricLabel}>运行模式</div>
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
        {!status.configured ? (
          <div className={styles.emptyInlineState}>
            Bot 尚未配置：请在站点设置里填写 Bot Token 与允许的会话后，再回到本页确认状态。
          </div>
        ) : null}
      </ManageSectionCard>
    </div>
  );
}

export default ManageTelegramPage;

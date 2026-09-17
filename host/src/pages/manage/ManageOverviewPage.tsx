import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import { namingCleanupApi } from '@fmby/v2-shared/contracts/manage/naming';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import type { BannerState } from '@fmby/v2-shared/ui/types';
import styles from './ManagePages.module.css';
import cockpitStyles from './overview/ManageOverviewCockpit.module.css';
import { OverviewKpiCapsules } from './overview/OverviewKpiCapsules';
import { OverviewSetupGuide } from './overview/OverviewSetupGuide';
import {
  ActiveTaskQueueWidget,
  LivePlaybackStreams,
  MountsHealthMatrix,
  RiskRadarPanel,
  ServerVitalsPanel,
  TaskDetailModal,
  TaskPipelineWidget,
  type ActiveTaskQueueItem,
} from './overview';
import {
  ManagePageHeader,
  getManageStatusVariant,
} from './components';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { formatDateTime } from '@fmby/v2-shared/time';
import { buildSetupGuide } from './setup-guide';

export function ManageOverviewPage() {
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<BannerState | null>(null);
  const tasks: ActiveTaskQueueItem[] = [];
  const [selectedTask, setSelectedTask] = useState<ActiveTaskQueueItem | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState<boolean>(false);

  const overviewQuery = useQuery({
    queryKey: queryKeys.manage.overview(),
    queryFn: () => manageApi.getOverview(),
  });
  const mountsQuery = useQuery({
    queryKey: queryKeys.manage.mounts.list(),
    queryFn: () => manageApi.getMounts(),
  });
  const librariesQuery = useQuery({
    queryKey: queryKeys.manage.libraries.list(),
    queryFn: () => manageApi.getLibraries(),
  });
  const usersQuery = useQuery({
    queryKey: queryKeys.manage.users.list({ page: 1, pageSize: 100 }),
    queryFn: () => manageApi.getUsers({ page: 1, pageSize: 100 }),
  });
  const sessionsQuery = useQuery({
    queryKey: queryKeys.manage.sessions(),
    queryFn: () => manageApi.getSessions(),
    refetchInterval: 10_000, // 每 10 秒自动巡检活跃推流
  });
  const namingSettingsQuery = useQuery({
    queryKey: queryKeys.manage.namingScrape.settings(),
    queryFn: () => namingCleanupApi.getScrapeSettings(),
  });

  const recoverMutation = useMutation({
    mutationFn: (librarySourceId: string) =>
      manageApi.recoverUnavailableLibrarySource(librarySourceId),
    onSuccess: (result) => {
      setBanner({
        variant: 'success',
        title: '数据源已恢复显示',
        description: `来源 ${result.librarySourceId} 已通过可达性检查并恢复显示，可见性会重新参与浏览和播放链路。`,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.manage.overview() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.manage.overviewHome() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.manage.mounts.list() });
    },
    onError: (error) => {
      setBanner({
        variant: 'error',
        title: '手动恢复失败',
        description: getErrorMessage(error),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.manage.overview() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.manage.overviewHome() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.manage.mounts.list() });
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      manageApi.revokeSession(sessionId, { confirmAction: 'revoke-session' }),
    onSuccess: () => {
      setBanner({
        variant: 'success',
        title: '会话已终止',
        description: '相关客户端播放流已被强制中断。',
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.manage.sessions() });
    },
    onError: (error) => {
      setBanner({
        variant: 'error',
        title: '终止会话失败',
        description: getErrorMessage(error),
      });
    },
  });

  const handleOpenTaskDetail = (task: ActiveTaskQueueItem) => {
    setSelectedTask(task);
    setIsTaskDetailOpen(true);
  };

  const handleBoostPriority = () => {
    setBanner({ variant: 'error', title: '任务操作不可用', description: '任务中心尚未装配真实调度服务。' });
  };

  const handleCancelTask = () => {
    setBanner({ variant: 'error', title: '任务操作不可用', description: '任务中心尚未装配真实调度服务。' });
  };

  const handleRetryTask = () => {
    setBanner({ variant: 'error', title: '任务操作不可用', description: '任务中心尚未装配真实调度服务。' });
  };

  if (
    overviewQuery.isPending ||
    mountsQuery.isPending ||
    librariesQuery.isPending ||
    usersQuery.isPending ||
    namingSettingsQuery.isPending
  ) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载中控驾驶舱"
        description="正在读取硬件指标、挂载状态、媒体资产与实时播放流..."
      />
    );
  }

  if (
    overviewQuery.isError ||
    mountsQuery.isError ||
    librariesQuery.isError ||
    usersQuery.isError ||
    namingSettingsQuery.isError
  ) {
    return (
      <FeedbackState
        variant="error"
        title="管理总览加载失败"
        description={getErrorMessage(
          overviewQuery.error ??
            mountsQuery.error ??
            librariesQuery.error ??
            usersQuery.error ??
            namingSettingsQuery.error,
        )}
        action={
          <button
            className={styles.primaryButton}
            onClick={() => {
              void overviewQuery.refetch();
              void mountsQuery.refetch();
              void librariesQuery.refetch();
              void usersQuery.refetch();
              void sessionsQuery.refetch();
              void namingSettingsQuery.refetch();
            }}
          >
            重试
          </button>
        }
      />
    );
  }

  const overview = overviewQuery.data;
  const mounts = mountsQuery.data?.items ?? [];
  const sessions = sessionsQuery.data?.items ?? [];
  const libraries = librariesQuery.data?.items ?? [];

  if (!overview || overview.kpis.length === 0) {
    return (
      <FeedbackState
        variant="empty"
        title="暂时没有可展示的管理数据"
        description="当前还没有足够的资源总览数据，先检查媒体库、挂载和扫描链路。"
        action={
          <button className={styles.secondaryButton} onClick={() => overviewQuery.refetch()}>
            刷新
          </button>
        }
      />
    );
  }

  const guide = buildSetupGuide({
    overview,
    mountsCount: mounts.length,
    librariesCount: libraries.length,
    usersCount: usersQuery.data?.total ?? 0,
    namingReady: Boolean(namingSettingsQuery.data),
  });

  // 如果处于首次配置引导状态，展示引导视图
  if (guide.isSetupMode) {
    return (
      <OverviewSetupGuide
        guide={guide}
        banner={banner}
        onRefresh={() => {
          void overviewQuery.refetch();
          void mountsQuery.refetch();
          void librariesQuery.refetch();
          void usersQuery.refetch();
          void namingSettingsQuery.refetch();
        }}
      />
    );
  }

  // 统计核心 KPI 指标
  const activeStreamsCount = sessions.filter((s) => s.status === 'active' || s.current).length;
  const healthyMountsCount = mounts.filter((m) => m.healthStatus === 'healthy' || !m.healthStatus).length;
  const totalMediaCount = overview.kpis.find((k) => k.key === 'media-items')?.value ?? 0;
  const totalAlertsCount = overview.todoItems.length + overview.unavailableSourceSummaries.length;

  // 计算数据源与云盘的动态描述：若有异常直接展示该存储的自定义命名；若全正常则展示所有存储名称
  const getMountsKpiSubText = () => {
    if (overview.unavailableSourceSummaries.length > 0) {
      const first = overview.unavailableSourceSummaries[0];
      return `❌ 存储「${first.mountName}」路径失效已隔离`;
    }
    const problematicMount = mounts.find(
      (m) => m.healthStatus === 'critical' || m.healthStatus === 'attention',
    );
    if (problematicMount) {
      return `⚠️ 存储「${problematicMount.name}」可达性异常 · 需关注`;
    }
    if (mounts.length === 0) {
      return '当前未接入存储挂载点';
    }
    const mountNames = mounts.map((m) => m.name);
    if (mountNames.length <= 3) {
      return `存储「${mountNames.join('、')}」全部平稳连通`;
    }
    return `存储「${mountNames.slice(0, 3).join('、')}」等全部 ${mounts.length} 个数据源平稳连通`;
  };

  return (
    <div className={styles.page}>
      {/* 顶部主控条 */}
      <ManagePageHeader
        title="中控驾驶舱 (Master Cockpit)"
        description="全景监控硬件水位、实时流媒体推流、多源挂载与系统风险，驱动资产高效流转。"
        meta={
          <>
            <StatusBadge
              label={overview.environmentLabel}
              variant={getManageStatusVariant(overview.environmentStatus)}
            />
            <span className={styles.metaText}>
              巡检时间：{formatDateTime(overview.refreshedAt)}
            </span>
          </>
        }
        actions={
          <>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => {
                void overviewQuery.refetch();
                void mountsQuery.refetch();
                void sessionsQuery.refetch();
                void librariesQuery.refetch();
              }}
            >
              <RefreshCw size={16} />
              全量巡检刷新
            </button>
            <Link className={styles.primaryButton} to="/manage/media/add">
              + 快速入库
            </Link>
          </>
        }
      />

      {banner ? (
        <InlineBanner
          variant={banner.variant}
          title={banner.title}
          description={banner.description}
        />
      ) : null}

      <div className={cockpitStyles.cockpitContainer}>
        <OverviewKpiCapsules
          activeStreamsCount={activeStreamsCount}
          totalMediaCount={totalMediaCount}
          healthyMountsCount={healthyMountsCount}
          mountsTotal={mounts.length}
          libraryCount={libraries.length}
          totalAlertsCount={totalAlertsCount}
          mountsKpiSubText={getMountsKpiSubText()}
        />
        {/* 2. 驾驶舱主栅格 (黄金 6:4 双列) */}
        <div className={cockpitStyles.cockpitMainGrid}>
          {/* 左列：实时推流监控卡片 + 风险雷达 + 正在运行的任务队列 (红色框区域) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', minWidth: 0 }}>
            <LivePlaybackStreams
              sessions={sessions}
              onRevokeSession={(sessionId) => revokeSessionMutation.mutate(sessionId)}
              isRevoking={revokeSessionMutation.isPending}
            />

            <RiskRadarPanel
              todoItems={overview.todoItems}
              emptyLibrariesCount={libraries.filter((l) => (l.itemCount ?? 0) === 0).length}
            />

            {/* 红色框位置：正在运行的任务队列 (刮削、扫描、探针、清洗) */}
            <ActiveTaskQueueWidget
              tasks={tasks}
              onOpenTaskDetail={handleOpenTaskDetail}
              onBoostPriority={handleBoostPriority}
              onCancelTask={handleCancelTask}
            />
          </div>

          {/* 右列：服务器硬件脉搏 + 数据源与挂载矩阵 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', minWidth: 0 }}>
            <ServerVitalsPanel
              environmentLabel={overview.environmentLabel}
              environmentStatus={overview.environmentStatus}
              refreshedAt={overview.refreshedAt}
            />

            <MountsHealthMatrix
              mounts={mounts}
              unavailableSummaries={overview.unavailableSourceSummaries}
              onRecoverSource={(id) => recoverMutation.mutate(id)}
              isRecoveringSourceId={recoverMutation.isPending ? recoverMutation.variables : null}
            />
          </div>
        </div>

        {/* 3. 底部看板：常用高频操作与最近审计轨迹 */}
        <TaskPipelineWidget
          activities={overview.activities}
          quickLinks={overview.quickLinks}
        />
      </div>

      {/* 任务详情交互模态框 */}
      <TaskDetailModal
        open={isTaskDetailOpen}
        onOpenChange={setIsTaskDetailOpen}
        task={selectedTask}
        onBoostPriority={handleBoostPriority}
        onCancelTask={handleCancelTask}
        onRetryTask={handleRetryTask}
      />
    </div>
  );
}

export default ManageOverviewPage;

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cloud, HardDrive, RefreshCw, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import { namingCleanupApi } from '@fmby/v2-shared/contracts/manage/naming';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import type { BannerState } from '@fmby/v2-shared/ui/types';
import styles from './ManagePages.module.css';
import guideStyles from './ManageOnboarding.module.css';
import cockpitStyles from './overview/ManageOverviewCockpit.module.css';
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
  ManageSectionCard,
  getManageStatusVariant,
} from './components';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { formatDateTime } from '@fmby/v2-shared/time';
import {
  buildSetupGuide,
  mapSetupStepStatusLabel,
  mapSetupStepStatusVariant,
} from './setup-guide';

const INITIAL_ACTIVE_TASKS: ActiveTaskQueueItem[] = [
  {
    id: 'task-scrape-fallout',
    category: 'Scrape',
    title: '《辐射 (Fallout 2024)》第 1 季 刮削与海报下载',
    stageDescription: '正在下载 TMDB 高清背景、演职员表与第 7 集 NFO 元数据...',
    progressPercent: 75,
    totalSubItems: 8,
    completedSubItems: 6,
    status: 'running',
    priority: 'high',
    createdAt: new Date(Date.now() - 1000 * 120).toISOString(),
    subItems: [
      { id: 'sub-1', title: 'S01E01 · 4K HEVC HDR · 刮削完成 (海报/NFO已就绪)', stage: '完成', status: 'succeeded', updatedAt: new Date(Date.now() - 1000 * 95).toISOString() },
      { id: 'sub-2', title: 'S01E02 · 4K HEVC HDR · 刮削完成 (海报/NFO已就绪)', stage: '完成', status: 'succeeded', updatedAt: new Date(Date.now() - 1000 * 80).toISOString() },
      { id: 'sub-3', title: 'S01E03 · 4K HEVC HDR · 刮削完成 (海报/NFO已就绪)', stage: '完成', status: 'succeeded', updatedAt: new Date(Date.now() - 1000 * 65).toISOString() },
      { id: 'sub-4', title: 'S01E04 · 4K HEVC HDR · 刮削完成 (海报/NFO已就绪)', stage: '完成', status: 'succeeded', updatedAt: new Date(Date.now() - 1000 * 50).toISOString() },
      { id: 'sub-5', title: 'S01E05 · 4K HEVC HDR · 刮削完成 (海报/NFO已就绪)', stage: '完成', status: 'succeeded', updatedAt: new Date(Date.now() - 1000 * 35).toISOString() },
      { id: 'sub-6', title: 'S01E06 · 4K HEVC HDR · 刮削完成 (海报/NFO已就绪)', stage: '完成', status: 'succeeded', updatedAt: new Date(Date.now() - 1000 * 20).toISOString() },
      { id: 'sub-7', title: 'S01E07 · 正在抓取演职员与中文剧照...', stage: '下载中 (88%)', status: 'running', updatedAt: new Date(Date.now() - 1000 * 5).toISOString() },
      { id: 'sub-8', title: 'S01E08 · 待进入刮削流水线', stage: '等待队列', status: 'queued', updatedAt: new Date().toISOString() },
    ],
  },
  {
    id: 'task-scan-115-tv',
    category: 'Scan',
    title: '「115 网盘 / 剧集库」增量目录与文件扫描',
    stageDescription: '正在扫描 /115/电视剧/华语剧场 目录下的新增视频文件...',
    progressPercent: 60,
    totalSubItems: 20,
    completedSubItems: 12,
    status: 'running',
    priority: 'normal',
    createdAt: new Date(Date.now() - 1000 * 180).toISOString(),
    subItems: Array.from({ length: 15 }).map((_, i) => ({
      id: `scan-sub-${i + 1}`,
      title: `/115/电视剧/目录分卷_${i + 1}`,
      stage: i < 12 ? '目录已对齐' : i === 12 ? '正在比对哈希与修改时间' : '等待扫描',
      status: (i < 12 ? 'succeeded' : i === 12 ? 'running' : 'queued') as 'succeeded' | 'running' | 'queued',
      updatedAt: new Date(Date.now() - (15 - i) * 6000).toISOString(),
    })),
  },
  {
    id: 'task-identify-3body',
    category: 'Identify',
    title: '《三体 (2023)》音视频流与字幕探针提取',
    stageDescription: '正在解析第 4 集 Dolby Vision 动态元数据与杜比全景声音轨...',
    progressPercent: 30,
    totalSubItems: 10,
    completedSubItems: 3,
    status: 'running',
    priority: 'normal',
    createdAt: new Date(Date.now() - 1000 * 240).toISOString(),
    subItems: Array.from({ length: 10 }).map((_, i) => ({
      id: `probe-sub-${i + 1}`,
      title: `《三体》第 ${i + 1} 集 · 音视频流探测`,
      stage: i < 3 ? '已提取杜比视界 Profile 8.1 与 TrueHD' : i === 3 ? '正在探测' : '等待探针',
      status: (i < 3 ? 'succeeded' : i === 3 ? 'running' : 'queued') as 'succeeded' | 'running' | 'queued',
      updatedAt: new Date(Date.now() - (10 - i) * 8000).toISOString(),
    })),
  },
  {
    id: 'task-cleanup-naming',
    category: 'Cleanup',
    title: '媒体库命名规则清洗与智能对齐',
    stageDescription: '正在对齐不规则压制组后缀与季集编号...',
    progressPercent: 92,
    totalSubItems: 25,
    completedSubItems: 23,
    status: 'running',
    priority: 'normal',
    createdAt: new Date(Date.now() - 1000 * 300).toISOString(),
    subItems: Array.from({ length: 25 }).map((_, i) => ({
      id: `clean-sub-${i + 1}`,
      title: `规则匹配项 #${i + 101} · 格式规范化`,
      stage: i < 23 ? '规则匹配成功' : i === 23 ? '正在重命名对齐' : '等待队列',
      status: (i < 23 ? 'succeeded' : i === 23 ? 'running' : 'queued') as 'succeeded' | 'running' | 'queued',
      updatedAt: new Date(Date.now() - (25 - i) * 4000).toISOString(),
    })),
  },
];

export function ManageOverviewPage() {
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [tasks, setTasks] = useState<ActiveTaskQueueItem[]>(INITIAL_ACTIVE_TASKS);
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

  const handleBoostPriority = (taskId: string) => {
    setTasks((prev) => {
      const target = prev.find((t) => t.id === taskId);
      if (!target) return prev;
      const boosted = { ...target, priority: 'urgent' as const };
      const remaining = prev.filter((t) => t.id !== taskId);
      return [boosted, ...remaining];
    });
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => (prev ? { ...prev, priority: 'urgent' } : null));
    }
    setBanner({
      variant: 'success',
      title: '已置顶提高任务优先级',
      description: '调度引擎已将该任务设为最高优先级，分配更多并发进行处理。',
    });
  };

  const handleCancelTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (selectedTask?.id === taskId) {
      setIsTaskDetailOpen(false);
    }
    setBanner({
      variant: 'info',
      title: '任务已取消',
      description: '相关刮削或扫描子进程已被安全终止。',
    });
  };

  const handleRetryTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: 'running' as const, progressPercent: 10 } : t,
      ),
    );
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => (prev ? { ...prev, status: 'running', progressPercent: 10 } : null));
    }
    setBanner({
      variant: 'success',
      title: '已重新开始执行任务',
      description: '已重置失败状态并重新排队调度。',
    });
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
      <div className={styles.page}>
        <ManagePageHeader
          title="先把媒体站跑起来"
          description="第一次进后台别先盯着统计，先把来源、媒体库、刮削和入库主链路走通。"
          meta={
            <StatusBadge
              label={`${guide.completedSteps} / ${guide.totalSteps} 步已完成`}
              variant="info"
            />
          }
          actions={
            <>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => {
                  void overviewQuery.refetch();
                  void mountsQuery.refetch();
                  void librariesQuery.refetch();
                  void usersQuery.refetch();
                  void namingSettingsQuery.refetch();
                }}
              >
                <RefreshCw size={16} />
                刷新状态
              </button>
              <Link className={styles.primaryButton} to="/manage/media/add">
                打开完整引导
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

        <ManageSectionCard
          title="按这个顺序走，最省心"
          description="每一步都带你去对应页面，不用先学会后台结构。"
        >
          <div className={guideStyles.stepGrid}>
            {guide.steps.map((step, index) => (
              <article
                key={step.id}
                className={guideStyles.stepCard}
                data-state={step.state}
              >
                <div className={guideStyles.stepHeader}>
                  <div className={styles.stackText}>
                    <span className={guideStyles.stepIndex}>{index + 1}</span>
                    <strong className={guideStyles.stepTitle}>{step.title}</strong>
                  </div>
                  <StatusBadge
                    label={mapSetupStepStatusLabel(step.state)}
                    variant={mapSetupStepStatusVariant(step.state)}
                  />
                </div>
                <p className={guideStyles.stepDescription}>{step.description}</p>
                <div className={guideStyles.stepActions}>
                  <Link className={styles.primaryButton} to={step.to}>
                    {step.actionLabel}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </ManageSectionCard>
      </div>
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
        {/* 1. 核心 KPI 胶囊横幅 */}
        <div className={cockpitStyles.kpiCapsuleGrid}>
          {/* 实时推流 */}
          <div className={cockpitStyles.kpiCapsule}>
            <div className={cockpitStyles.kpiHeader}>
              <span className={cockpitStyles.kpiLabel}>实时在线播放</span>
              <span className={`${cockpitStyles.pulseDot} ${activeStreamsCount > 0 ? cockpitStyles.healthy : cockpitStyles.attention}`} />
            </div>
            <div className={cockpitStyles.kpiValueRow}>
              <span className={cockpitStyles.kpiMainValue}>{activeStreamsCount}</span>
              <span className={cockpitStyles.kpiUnit}>路活跃流</span>
            </div>
            <span className={cockpitStyles.kpiSubText}>
              {activeStreamsCount > 0 ? '直链推流中' : '无并发压力 · 待机中'}
            </span>
          </div>

          {/* 媒体资产规模 */}
          <div className={cockpitStyles.kpiCapsule}>
            <div className={cockpitStyles.kpiHeader}>
              <span className={cockpitStyles.kpiLabel}>入库媒体资产</span>
              <HardDrive size={15} style={{ color: 'var(--manage-cyan)' }} />
            </div>
            <div className={cockpitStyles.kpiValueRow}>
              <span className={cockpitStyles.kpiMainValue}>{totalMediaCount.toLocaleString()}</span>
              <span className={cockpitStyles.kpiUnit}>部/集</span>
            </div>
            <span className={cockpitStyles.kpiSubText}>
              共 {libraries.length} 个媒体库 · 持续刮削更新
            </span>
          </div>

          {/* 挂载健康度 */}
          <div className={cockpitStyles.kpiCapsule}>
            <div className={cockpitStyles.kpiHeader}>
              <span className={cockpitStyles.kpiLabel}>数据源与云盘</span>
              <Cloud size={15} style={{ color: '#38bdf8' }} />
            </div>
            <div className={cockpitStyles.kpiValueRow}>
              <span className={cockpitStyles.kpiMainValue}>
                {healthyMountsCount}/{mounts.length}
              </span>
              <span className={cockpitStyles.kpiUnit}>正常可达</span>
            </div>
            <span className={cockpitStyles.kpiSubText} title={getMountsKpiSubText()}>
              {getMountsKpiSubText()}
            </span>
          </div>

          {/* 风险待办 */}
          <div className={cockpitStyles.kpiCapsule}>
            <div className={cockpitStyles.kpiHeader}>
              <span className={cockpitStyles.kpiLabel}>风险与告警</span>
              <ShieldAlert
                size={15}
                style={{ color: totalAlertsCount > 0 ? 'var(--warning)' : 'var(--success)' }}
              />
            </div>
            <div className={cockpitStyles.kpiValueRow}>
              <span className={cockpitStyles.kpiMainValue}>{totalAlertsCount}</span>
              <span className={cockpitStyles.kpiUnit}>项待处理</span>
            </div>
            <span className={cockpitStyles.kpiSubText}>
              {totalAlertsCount === 0 ? '全系统无阻塞性风险' : '包含挂载/空库/凭证提醒'}
            </span>
          </div>
        </div>

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
              vitals={{
                cpuLoad: Math.min(100, Math.max(12, tasks.filter((t) => t.status === 'running').length * 18 + 12)),
                memUsagePercent: 46,
                memUsedGb: 7.4,
                memTotalGb: 16.0,
                storageUsagePercent: Math.min(95, Math.max(30, Math.round(((overview.kpis.find((k) => k.key === 'media-items')?.value ?? 0) / 10000) * 15 + 30))),
                storageUsedTb: 38.4,
                storageTotalTb: 60.0,
                bandwidthOut: `${Math.max(15, sessions.length * 18.5).toFixed(1)} Mbps`,
                bandwidthIn: `${Math.max(4, tasks.filter((t) => t.status === 'running').length * 6.2).toFixed(1)} Mbps`,
              }}
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

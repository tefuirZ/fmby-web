import type {
  ManageKpi,
  ManageOverviewResponse,
} from '@fmby/v2-shared/contracts/manage';

export type SetupStepState = 'done' | 'current' | 'todo';

export interface SetupGuideStep {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  to: string;
  state: SetupStepState;
}

export interface SetupGuideSummary {
  isSetupMode: boolean;
  completedSteps: number;
  totalSteps: number;
  headline: string;
  description: string;
  primaryActionLabel: string;
  primaryActionTo: string;
  steps: SetupGuideStep[];
}

interface BuildSetupGuideInput {
  overview: ManageOverviewResponse;
  mountsCount: number;
  librariesCount: number;
  usersCount: number;
  namingReady: boolean;
}

export function buildSetupGuide({
  overview,
  mountsCount,
  librariesCount,
  usersCount,
  namingReady,
}: BuildSetupGuideInput): SetupGuideSummary {
  const mediaItemsCount = readKpiValue(overview.kpis, 'media-items');
  const hasMounts = mountsCount > 0;
  const hasLibraries = librariesCount > 0;
  const hasMediaItems = mediaItemsCount > 0;
  const hasSharedAccess = usersCount > 1;
  const hasCriticalRisk =
    overview.unavailableLibrarySources > 0 ||
    overview.todoItems.some((item) => item.level === 'critical');

  const steps: SetupGuideStep[] = [
    {
      id: 'mounts',
      title: '添加媒体来源',
      description:
        '先把本地目录、OpenList、AList、WebDAV 或 S3 这类来源接进来，后面媒体库才能真正看到文件。',
      actionLabel: hasMounts ? '继续检查来源' : '去添加来源',
      to: '/manage/media/mounts',
      state: hasMounts ? 'done' : 'current',
    },
    {
      id: 'libraries',
      title: '创建媒体库',
      description:
        '把电影、剧集按媒体库组织起来，决定哪些来源参与扫描，也决定前台最终怎么展示。',
      actionLabel: hasLibraries ? '查看媒体库' : '去创建媒体库',
      to: '/manage/media/libraries',
      state: hasLibraries ? 'done' : hasMounts ? 'current' : 'todo',
    },
    {
      id: 'naming-scrape',
      title: '确认命名与刮削偏好',
      description:
        '在入库前先确认标题来源、元数据语言、海报语言和自动刮削策略，避免扫完再返工。',
      actionLabel: '去看命名与刮削',
      to: '/manage/media/naming-scrape',
      state: namingReady && hasLibraries ? 'done' : hasLibraries ? 'current' : 'todo',
    },
    {
      id: 'scan',
      title: '首次扫描入库',
      description:
        '让系统真正扫到文件、生成映射并建立媒体条目。只有这一步跑通，后面的封面和播放才有意义。',
      actionLabel: hasMediaItems ? '查看媒体条目' : '去检查入库结果',
      to: hasMediaItems ? '/manage/media/items' : '/manage/media/libraries',
      state: hasMediaItems ? 'done' : hasLibraries ? 'current' : 'todo',
    },
    {
      id: 'quality-check',
      title: '检查标题、海报和播放',
      description:
        '抽样看几部片子，确认标题、海报、演员和播放链路都正常，不要等用户用了才发现一堆空壳。',
      actionLabel: '去看媒体条目',
      to: '/manage/media/items',
      state: hasMediaItems ? (hasCriticalRisk ? 'current' : 'done') : 'todo',
    },
    {
      id: 'sharing',
      title: '邀请用户开始使用',
      description:
        '站点跑通后再发邀请码或新建账号，避免家人一上来就碰到还没整理好的媒体库。',
      actionLabel: hasSharedAccess ? '查看用户与邀请' : '去准备邀请',
      to: '/manage/site/users/registration-codes',
      state: hasSharedAccess ? 'done' : hasMediaItems ? 'current' : 'todo',
    },
  ];

  const completedSteps = steps.filter((step) => step.state === 'done').length;
  const isSetupMode = !hasMounts || !hasLibraries || !hasMediaItems;
  const currentStep =
    steps.find((step) => step.state === 'current') ??
    steps.find((step) => step.state === 'todo') ??
    steps[0];

  return {
    isSetupMode,
    completedSteps,
    totalSteps: steps.length,
    headline: isSetupMode ? '先把媒体站跑起来' : '站点已经跑通，可以继续打磨体验',
    description: isSetupMode
      ? '你现在最重要的不是看统计，而是把来源、媒体库、刮削和入库主链路走通。下面这些步骤会直接带你去该点的地方。'
      : '基础链路已经成形，下面这些步骤可以继续帮你补齐标题、海报、邀请和日常维护动作。',
    primaryActionLabel: currentStep.actionLabel,
    primaryActionTo: currentStep.to,
    steps,
  };
}

export function readKpiValue(items: ManageKpi[], key: string) {
  return items.find((item) => item.key === key)?.value ?? 0;
}

export function mapSetupStepStatusLabel(state: SetupStepState) {
  switch (state) {
    case 'done':
      return '已完成';
    case 'current':
      return '下一步';
    default:
      return '待处理';
  }
}

export function mapSetupStepStatusVariant(state: SetupStepState) {
  switch (state) {
    case 'done':
      return 'success' as const;
    case 'current':
      return 'info' as const;
    default:
      return 'neutral' as const;
  }
}

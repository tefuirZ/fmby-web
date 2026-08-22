import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { manageApi } from '@/domains/manage';
import { namingCleanupApi } from '@/domains/manage/naming';
import { queryKeys } from '@/shared/query-keys';
import { FeedbackState } from '@/shared/ui';
import { StatusBadge } from '@/shared/ui';
import { getErrorMessage } from '@/shared/utils/error';
import styles from './ManagePages.module.css';
import guideStyles from './ManageOnboarding.module.css';
import { ManagePageHeader, ManageSectionCard } from './components';
import {
  buildSetupGuide,
  mapSetupStepStatusLabel,
  mapSetupStepStatusVariant,
  readKpiValue,
} from './setup-guide';

export function ManageAddMediaPage() {
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
  const namingSettingsQuery = useQuery({
    queryKey: queryKeys.manage.namingScrape.settings(),
    queryFn: () => namingCleanupApi.getScrapeSettings(),
  });

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
        title="正在准备添加媒体向导"
        description="正在读取来源、媒体库、刮削偏好和当前站点状态。"
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
        title="添加媒体向导加载失败"
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
            type="button"
            onClick={() => {
              void overviewQuery.refetch();
              void mountsQuery.refetch();
              void librariesQuery.refetch();
              void usersQuery.refetch();
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
  if (!overview) {
    return (
      <FeedbackState
        variant="empty"
        title="暂时还拿不到站点引导信息"
        description="等管理首页返回基础状态后，这里会继续补齐添加媒体向导。"
      />
    );
  }
  const mounts = mountsQuery.data?.items ?? [];
  const libraries = librariesQuery.data?.items ?? [];
  const users = usersQuery.data?.items ?? [];
  const guide = buildSetupGuide({
    overview,
    mountsCount: mounts.length,
    librariesCount: libraries.length,
    usersCount: usersQuery.data?.total ?? users.length,
    namingReady: Boolean(namingSettingsQuery.data),
  });
  const mediaItemsCount = readKpiValue(overview.kpis, 'media-items');

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="添加媒体"
        description="这里不跟你谈一堆系统术语，只带你把媒体接进来、扫出来、刮完整。"
        actions={
          <>
            <Link className={styles.secondaryButton} to="/manage/media/mounts">
              管理媒体来源
            </Link>
            <Link className={styles.primaryButton} to={guide.primaryActionTo}>
              {guide.primaryActionLabel}
            </Link>
          </>
        }
      />

      <div className={guideStyles.heroGrid}>
        <section className={guideStyles.heroCard}>
          <div className={styles.stackText}>
            <span className={styles.eyebrow}>快速上手</span>
            <h2 className={guideStyles.heroTitle}>{guide.headline}</h2>
            <p className={guideStyles.heroDescription}>{guide.description}</p>
          </div>

          <div className={guideStyles.heroStats}>
            <div className={guideStyles.heroStat}>
              <span className={guideStyles.heroStatLabel}>已完成步骤</span>
              <strong className={guideStyles.heroStatValue}>
                {guide.completedSteps} / {guide.totalSteps}
              </strong>
            </div>
            <div className={guideStyles.heroStat}>
              <span className={guideStyles.heroStatLabel}>媒体来源</span>
              <strong className={guideStyles.heroStatValue}>{mounts.length}</strong>
            </div>
            <div className={guideStyles.heroStat}>
              <span className={guideStyles.heroStatLabel}>已入库媒体</span>
              <strong className={guideStyles.heroStatValue}>{mediaItemsCount}</strong>
            </div>
          </div>
        </section>

        <section className={guideStyles.summaryCard}>
          <div className={styles.stackText}>
            <strong>常用入口</strong>
            <span className={styles.mutedText}>
              把最容易迷路的入口直接摆在这里，别让人先学后台结构再开始干活。
            </span>
          </div>
          <div className={guideStyles.jumpGrid}>
            <Link className={styles.quickLinkCard} to="/manage/media/mounts">
              <strong>媒体来源</strong>
              <span className={styles.mutedText}>接入本地目录、OpenList、WebDAV 或 S3。</span>
            </Link>
            <Link className={styles.quickLinkCard} to="/manage/media/libraries">
              <strong>媒体库</strong>
              <span className={styles.mutedText}>决定电影库、剧集库怎么组织和绑定。</span>
            </Link>
            <Link className={styles.quickLinkCard} to="/manage/media/naming-scrape">
              <strong>命名与刮削</strong>
              <span className={styles.mutedText}>设置标题来源、语言和海报偏好。</span>
            </Link>
            <Link className={styles.quickLinkCard} to="/manage/site/settings">
              <strong>站点设置</strong>
              <span className={styles.mutedText}>把注册、登录安全和会话放在一页看完。</span>
            </Link>
          </div>
        </section>
      </div>

      <ManageSectionCard
        title="按这个顺序走，最省心"
        description="每一步都带你去对应页面，避免新手在导航里盲翻。"
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

      <div className={styles.twoColumn}>
        <ManageSectionCard
          title="推荐做法"
          description="先把体验跑顺，再去折腾更细的高级项。"
        >
          <div className={guideStyles.tipList}>
            <div className={guideStyles.tipItem}>
              <div className={guideStyles.tipTitle}>先接来源，再想高级参数</div>
              <p className={guideStyles.tipDescription}>
                来源连不上、路径不对、权限不够的时候，后面再多元数据设置都是白搭。
              </p>
            </div>
            <div className={guideStyles.tipItem}>
              <div className={guideStyles.tipTitle}>先抽样检查几部片</div>
              <p className={guideStyles.tipDescription}>
                拿《甄嬛传》《变形金刚》这类你熟悉的片子做样本，标题、海报、演员一眼就能看出对不对。
              </p>
            </div>
            <div className={guideStyles.tipItem}>
              <div className={guideStyles.tipTitle}>先自己播通，再邀请别人</div>
              <p className={guideStyles.tipDescription}>
                先确认封面、详情页和播放链路都正常，再发邀请码，省得家人上来就踩坑。
              </p>
            </div>
          </div>
        </ManageSectionCard>

        <ManageSectionCard
          title="哪里坏了先看哪里"
          description="等站点开始跑起来，重点就从搭建切到排障。"
        >
          <div className={guideStyles.tipList}>
            <div className={guideStyles.tipItem}>
              <div className={guideStyles.tipTitle}>媒体来源异常</div>
              <p className={guideStyles.tipDescription}>
                先去看媒体来源状态和最近校验时间，别一上来怀疑刮削器。
              </p>
            </div>
            <div className={guideStyles.tipItem}>
              <div className={guideStyles.tipTitle}>入库为空</div>
              <p className={guideStyles.tipDescription}>
                优先检查媒体库绑定和路径，再看扫描任务，不要只盯着前台空页面发呆。
              </p>
            </div>
            <div className={guideStyles.tipItem}>
              <div className={guideStyles.tipTitle}>海报或标题不对</div>
              <p className={guideStyles.tipDescription}>
                先去命名与刮削页确认标题来源、元数据语言和海报语言，再决定要不要强制重刮。
              </p>
            </div>
          </div>
        </ManageSectionCard>
      </div>
    </div>
  );
}

export default ManageAddMediaPage;

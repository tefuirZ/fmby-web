import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { browseApi, type BrowseHero, type MediaCardSummary } from '@/domains/browse';
import { manageApi } from '@/domains/manage';
import { useDelayedTrigger, useViewportTrigger } from '@/shared/hooks';
import { queryKeys } from '@/shared/query-keys';
import { useSession } from '@/shared/session/SessionProvider';
import { FeedbackState, InlineBanner } from '@/shared/ui';
import { getErrorMessage } from '@/shared/utils/error';
import styles from './styles/shared.module.css';
import {
  BrowseLoadingState,
  BrowseRail,
  BrowseSection,
  HeroSpotlight,
  LandscapeMediaCard,
  LibraryShowcaseCard,
  PosterMediaCard,
  buildMediaMeta,
} from './components';

export function HomePage() {
  const { hasCapability, user } = useSession();
  const isAdmin = hasCapability('manage:access');

  const homeDataQuery = useQuery({
    queryKey: queryKeys.browse.home(),
    queryFn: () => browseApi.getHomeData({ hot: 8, recentlyAdded: 14, continueWatching: 12 }),
    staleTime: 60_000,
  });

  const hotItems = homeDataQuery.data?.hotItems ?? [];
  const continueItems = homeDataQuery.data?.continueWatching ?? [];
  const addedItems = homeDataQuery.data?.recentlyAdded ?? [];
  const hasPrimaryRows = continueItems.length > 0 || addedItems.length > 0 || Boolean(homeDataQuery.data?.hero);
  const shouldDelayLibraries = !homeDataQuery.isPending && !hasPrimaryRows;
  const shouldEnableAdminReminder = isAdmin && !homeDataQuery.isPending;
  const delayedLibrariesTrigger = useDelayedTrigger({
    delayMs: 1_200,
    enabled: shouldDelayLibraries,
  });
  const delayedAdminReminderTrigger = useDelayedTrigger({
    delayMs: 900,
    enabled: shouldEnableAdminReminder,
  });
  const { ref: librariesSectionRef, isTriggered: librariesSectionVisible } =
    useViewportTrigger<HTMLDivElement>({
      rootMargin: '320px 0px',
      threshold: 0.15,
    });
  const shouldLoadLibraries = librariesSectionVisible || delayedLibrariesTrigger;

  const librariesQuery = useQuery({
    queryKey: queryKeys.browse.librariesHome(),
    queryFn: () => browseApi.getLibraries(),
    enabled: shouldLoadLibraries,
    staleTime: 5 * 60_000,
  });
  const overviewQuery = useQuery({
    queryKey: queryKeys.manage.overviewHome(),
    queryFn: () => manageApi.getOverview(),
    enabled: delayedAdminReminderTrigger,
    staleTime: 60_000,
  });
  const heroSlides = useMemo(
    () => buildHomeHeroSlides(homeDataQuery.data?.hero ?? null, hotItems, addedItems, continueItems),
    [addedItems, continueItems, homeDataQuery.data?.hero, hotItems],
  );

  if (homeDataQuery.isPending) {
    return <BrowseLoadingState />;
  }

  const libraries = librariesQuery.data ?? [];

  const fallbackHero = heroSlides[0] ?? null;

  const hasHomeContent =
    Boolean(fallbackHero) ||
    continueItems.length > 0 ||
    addedItems.length > 0;
  const showFullEmptyState =
    !homeDataQuery.isError &&
    !hasHomeContent &&
    librariesQuery.isSuccess &&
    libraries.length === 0;

  if (homeDataQuery.isError && shouldLoadLibraries && librariesQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="首页暂时打不开"
        description={getErrorMessage(homeDataQuery.error ?? librariesQuery.error)}
        action={
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => {
              void homeDataQuery.refetch();
              void librariesQuery.refetch();
            }}
          >
            重试
          </button>
        }
      />
    );
  }

  if (showFullEmptyState) {
    return (
      <FeedbackState
        variant="empty"
        title="还没有可以浏览的内容"
        description={
          isAdmin
            ? '先去完善数据源和媒体库，放映厅就会在这里开始变得热闹。'
            : '当前还没有可展示的内容，稍后再来看看。'
        }
        action={
          <Link
            className={styles.primaryButton}
            to={isAdmin ? '/manage/media/mounts' : '/libraries'}
          >
            {isAdmin ? '去完善数据源' : '去看看媒体库'}
          </Link>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      {homeDataQuery.isError ? (
        <InlineBanner
          variant="error"
          title="首页核心内容加载失败"
          description={getErrorMessage(homeDataQuery.error)}
          actions={
            <div className={styles.buttonRow}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => homeDataQuery.refetch()}
              >
                重试
              </button>
            </div>
          }
        />
      ) : null}

      {fallbackHero ? (
        <HeroSpotlight
          hero={fallbackHero}
          slides={heroSlides}
          adminReminder={
            !isAdmin ? undefined : !delayedAdminReminderTrigger ? undefined : overviewQuery.isPending ? (
              <InlineBanner
                variant="info"
                title="正在同步管理提醒"
                description="先把首页首屏内容稳住，管理提醒会在后台补上。"
                actions={
                  <div className={styles.buttonRow}>
                    <Link className={styles.secondaryButton} to="/manage">
                      进入管理中心
                    </Link>
                  </div>
                }
              />
            ) : overviewQuery.isError ? (
              <InlineBanner
                variant="warning"
                title="管理提醒加载失败"
                description={getErrorMessage(overviewQuery.error)}
                actions={
                  <div className={styles.buttonRow}>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={() => overviewQuery.refetch()}
                    >
                      重试
                    </button>
                    <Link className={styles.secondaryButton} to="/manage">
                      进入管理中心
                    </Link>
                  </div>
                }
              />
            ) : overviewQuery.data && overviewQuery.data.todoItems.length > 0 ? (
              <InlineBanner
                variant={
                  overviewQuery.data.todoItems.some((item) => item.level === 'critical')
                    ? 'warning'
                    : 'info'
                }
                title={overviewQuery.data.todoItems[0]?.title ?? '管理中心有新的提醒'}
                description={overviewQuery.data.todoItems[0]?.description}
                actions={
                  <div className={styles.buttonRow}>
                    <Link className={styles.secondaryButton} to="/manage">
                      进入管理中心
                    </Link>
                  </div>
                }
              />
            ) : isAdmin ? (
              <InlineBanner
                variant="info"
                title="管理中心今天一切正常"
                description="你可以先继续看片，需要处理站点事务时再进入管理中心。"
                actions={
                  <div className={styles.buttonRow}>
                    <Link className={styles.secondaryButton} to="/manage">
                      打开管理中心
                    </Link>
                  </div>
                }
              />
            ) : undefined
          }
        />
      ) : null}

      <BrowseSection
        title={`${user?.display_name ?? user?.name ?? '你'}的继续观看`}
        description="只保留没看完的内容，顺着进度条直接续上。"
        action={<Link to="/history">查看全部</Link>}
        variant="shelf"
      >
        {homeDataQuery.isError ? (
          <InlineBanner
            variant="error"
            title="继续观看加载失败"
            description={getErrorMessage(homeDataQuery.error)}
            actions={
              <div className={styles.buttonRow}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => homeDataQuery.refetch()}
                >
                  重试
                </button>
              </div>
            }
          />
        ) : continueItems.length === 0 ? (
          <div className={styles.emptyGrid}>
            暂时没有未看完的内容，看点新东西后会自动出现在这里。
          </div>
        ) : (
          <BrowseRail itemClassName={styles.continueRailItem}>
            {continueItems.map((item) => (
              <LandscapeMediaCard key={item.id} item={item} />
            ))}
          </BrowseRail>
        )}
      </BrowseSection>

      <BrowseSection
        title="最近入库"
        description="先扫一眼最近刚进库的片子，挑到就直接进。"
        action={<Link to="/libraries">浏览媒体库</Link>}
      >
        {homeDataQuery.isError ? (
          <InlineBanner
            variant="error"
            title="最近入库加载失败"
            description={getErrorMessage(homeDataQuery.error)}
          />
        ) : addedItems.length === 0 ? (
          <div className={styles.emptyGrid}>最近没有新的入库内容。</div>
        ) : (
          <BrowseRail itemClassName={styles.posterRailItem}>
            {addedItems.map((item) => (
              <PosterMediaCard key={item.id} item={item} />
            ))}
          </BrowseRail>
        )}
      </BrowseSection>

      <div ref={librariesSectionRef}>
        <BrowseSection
          title="媒体库入口"
          description="电影、剧集、音乐都做成一排横向入口卡，进库更顺手。"
          action={<Link to="/libraries">查看全部媒体库</Link>}
        >
          {!shouldLoadLibraries ? (
            <div className={styles.emptyGrid}>
              {shouldDelayLibraries
                ? '正在准备媒体库入口，马上就会补上。'
                : '继续往下滑到这里时，再展开媒体库入口。'}
            </div>
          ) : librariesQuery.isPending ? (
            <div className={styles.emptyGrid}>正在加载媒体库入口...</div>
          ) : librariesQuery.isError ? (
            <InlineBanner
              variant="error"
              title="媒体库列表加载失败"
              description={getErrorMessage(librariesQuery.error)}
              actions={
                <div className={styles.buttonRow}>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => librariesQuery.refetch()}
                  >
                    重试
                  </button>
                </div>
              }
            />
          ) : libraries.length === 0 ? (
            <div className={styles.emptyGrid}>还没有可展示的媒体库。</div>
          ) : (
            <BrowseRail itemClassName={styles.libraryRailItem}>
              {libraries.map((library) => (
                <LibraryShowcaseCard key={library.id} library={library} />
              ))}
            </BrowseRail>
          )}
        </BrowseSection>
      </div>
    </div>
  );
}

function buildHomeHeroSlides(
  primaryHero: BrowseHero | null,
  hotItems: MediaCardSummary[],
  addedItems: MediaCardSummary[],
  continueItems: MediaCardSummary[],
): BrowseHero[] {
  const slides: BrowseHero[] = [];
  const seen = new Set<string>();

  const pushHero = (hero: BrowseHero | null) => {
    if (!hero || seen.has(hero.item.id)) {
      return;
    }
    seen.add(hero.item.id);
    slides.push(hero);
  };

  const pushItem = (item: MediaCardSummary, source: 'resume' | 'hot') => {
    if (seen.has(item.id)) {
      return;
    }
    seen.add(item.id);
    slides.push(buildHomeHeroFromItem(item, source));
  };

  hotItems.forEach((item) => pushItem(item, 'hot'));
  pushHero(primaryHero);
  addedItems.forEach((item) => pushItem(item, 'hot'));
  continueItems.slice(0, 2).forEach((item) => pushItem(item, 'resume'));

  const limitedSlides = slides.slice(0, 6);
  const visualSlides = limitedSlides.filter((slide) => hasHeroArtwork(slide.item));
  return visualSlides.length > 0 ? visualSlides : limitedSlides;
}

function hasHeroArtwork(item: MediaCardSummary) {
  return Boolean(
    item.artwork.bannerUrl ??
      item.artwork.backdropUrl ??
      item.artwork.thumbUrl ??
      item.artwork.posterUrl,
  );
}

function buildHomeHeroFromItem(item: MediaCardSummary, source: 'resume' | 'hot'): BrowseHero {
  const primaryPlaybackTargetId = item.availabilityNotice
    ? undefined
    : item.playbackTargetId ?? (item.hasPlayableSource ? item.id : undefined);

  return {
    item,
    description:
      item.description ??
      (source === 'resume'
        ? '上次看到这里，打开就能继续接上。'
        : '最近大家都在看，先放进热播轮播里占个好位置。'),
    meta: buildMediaMeta(item),
    primaryActionLabel: primaryPlaybackTargetId
      ? item.progress
        ? '继续播放'
        : '立即播放'
      : '查看详情',
    primaryActionTo: primaryPlaybackTargetId ? `/play/${primaryPlaybackTargetId}` : `/item/${item.id}`,
    secondaryActionLabel: primaryPlaybackTargetId ? '查看详情' : undefined,
    secondaryActionTo: primaryPlaybackTargetId ? `/item/${item.id}` : undefined,
  };
}

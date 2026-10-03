import { Link } from 'react-router';
import { useSession } from '@/session/SessionProvider';
import { useHome } from '@fmby/v2-shared/viewmodels';
import { FeedbackState, InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './styles/shared.module.css';
import {
  BrowseLoadingState,
  BrowseRail,
  BrowseSection,
  HeroSpotlight,
  LandscapeMediaCard,
  LibraryShowcaseCard,
  PosterMediaCard,
} from './components';

export function HomePage() {
  const { hasCapability, user } = useSession();
  const isAdmin = hasCapability('manage:access');

  // WEB-B1：首页取数、门控加载、hero 派生、管理提醒状态全部上移至 viewmodel。
  const {
    data,
    state,
    error,
    actions,
    librariesSectionRef,
  } = useHome({ isAdmin });
  const {
    heroSlides,
    continueItems,
    addedItems,
    libraries,
    librariesState,
    librariesError,
    hasHomeContent,
    overview,
    adminReminder,
    hasPrimaryError,
  } = data;
  const shouldLoadLibraries = actions.shouldRenderLibrariesSection;

  // 管理提醒 payload（overview 为 viewmodel 透出的管理概览；此处只做展示取值）。
  const todoItems = (overview as { todoItems?: Array<{ level?: string; title?: string; description?: string }> } | undefined)
    ?.todoItems ?? [];
  const hasTodoItems = todoItems.length > 0;

  if (state === 'loading') {
    return <BrowseLoadingState />;
  }

  const fallbackHero = heroSlides[0] ?? null;

  if (state === 'error' || state === 'forbidden') {
    return (
      <FeedbackState
        variant="error"
        title={state === 'forbidden' ? '没有访问首页内容的权限' : '首页暂时打不开'}
        description={getErrorMessage(error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={actions.retry}>
            重试
          </button>
        }
      />
    );
  }

  if (state === 'empty') {
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
      {hasPrimaryError ? (
        <InlineBanner
          variant="error"
          title="首页核心内容加载失败"
          description={getErrorMessage(error)}
          actions={
            <div className={styles.buttonRow}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={actions.refresh}
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
            adminReminder === 'hidden' ? undefined : adminReminder === 'pending' ? (
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
            ) : adminReminder === 'error' ? (
              <InlineBanner
                variant="warning"
                title="管理提醒加载失败"
                description={getErrorMessage(error)}
                actions={
                  <div className={styles.buttonRow}>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={actions.retryOverview}
                    >
                      重试
                    </button>
                    <Link className={styles.secondaryButton} to="/manage">
                      进入管理中心
                    </Link>
                  </div>
                }
              />
            ) : adminReminder === 'ready' && hasTodoItems ? (
              <InlineBanner
                variant={
                  todoItems.some((item) => item.level === 'critical')
                    ? 'warning'
                    : 'info'
                }
                title={todoItems[0]?.title ?? '管理中心有新的提醒'}
                description={todoItems[0]?.description}
                actions={
                  <div className={styles.buttonRow}>
                    <Link className={styles.secondaryButton} to="/manage">
                      进入管理中心
                    </Link>
                  </div>
                }
              />
            ) : adminReminder === 'empty' ? (
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
        {hasPrimaryError ? (
          <InlineBanner
            variant="error"
            title="继续观看加载失败"
            description={getErrorMessage(error)}
            actions={
              <div className={styles.buttonRow}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={actions.refresh}
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
        {hasPrimaryError ? (
          <InlineBanner
            variant="error"
            title="最近入库加载失败"
            description={getErrorMessage(error)}
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
              {!hasHomeContent
                ? '正在准备媒体库入口，马上就会补上。'
                : '继续往下滑到这里时，再展开媒体库入口。'}
            </div>
          ) : librariesState === 'loading' ? (
            <div className={styles.emptyGrid}>正在加载媒体库入口...</div>
          ) : librariesState === 'error' || librariesState === 'forbidden' ? (
            <InlineBanner
              variant="error"
              title={librariesState === 'forbidden' ? '没有访问媒体库的权限' : '媒体库列表加载失败'}
              description={getErrorMessage(librariesError)}
              actions={
                <div className={styles.buttonRow}>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={actions.retry}
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

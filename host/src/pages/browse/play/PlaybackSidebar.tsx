/** 播放页侧栏抽屉：剧集队列 / 相关推荐（V1F 拆分：PlayPage → 子组件）。 */

import type { RefObject } from 'react';
import { HoverScrollArea } from '@fmby/v2-shared/ui';
import type { MediaCardSummary } from '@fmby/v2-shared/contracts/browse';
import styles from '../PlayPage.module.css';
import {
  DeferredSidebarPrompt,
  EpisodeQueueItem,
  SidebarMediaCard,
  SidebarSection,
} from './PlayPanels';

interface PlaybackSidebarProps {
  open: boolean;
  isEpisodeView: boolean;
  sidebarRef: RefObject<HTMLElement | null>;
  allowed: boolean;
  onRequestQuery: () => void;
  onClose: () => void;
  // 剧集态
  episodeSeriesTitle: string;
  isResolvingSeriesRoot: boolean;
  isSeriesEpisodesLoading: boolean;
  seriesId?: string;
  seriesEpisodes: MediaCardSummary[];
  currentItemId?: string;
  // 推荐态
  detailKind?: string;
  recommendedItems: MediaCardSummary[];
  buildPlayPath: (item: MediaCardSummary) => string;
}

export function PlaybackSidebar({
  open,
  isEpisodeView,
  sidebarRef,
  allowed,
  onRequestQuery,
  onClose,
  episodeSeriesTitle,
  isResolvingSeriesRoot,
  isSeriesEpisodesLoading,
  seriesId,
  seriesEpisodes,
  currentItemId,
  detailKind,
  recommendedItems,
  buildPlayPath,
}: PlaybackSidebarProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      <button
        className={styles.queueBackdrop}
        type="button"
        aria-label="关闭播放队列"
        onClick={onClose}
      />
      <aside
        id="playback-sidebar"
        ref={sidebarRef}
        className={`${styles.sidebarColumn} ${styles.sidebarDrawer}`}
        role="dialog"
        aria-modal="true"
        aria-label={isEpisodeView ? '剧集队列' : '相关推荐'}
        onFocusCapture={onRequestQuery}
        onPointerEnter={onRequestQuery}
      >
        {isEpisodeView ? (
          <SidebarSection
            title="剧集列表"
            description={`已列出《${episodeSeriesTitle}》全部已识别剧集。`}
            fillHeight
          >
            {!allowed ? (
              <DeferredSidebarPrompt
                actionLabel="加载剧集列表"
                description="剧集列表按需拉取，先把播放器和起播链路让出来。"
                onClick={onRequestQuery}
              />
            ) : isResolvingSeriesRoot || isSeriesEpisodesLoading ? (
              <div className={styles.sidebarEmpty}>正在加载本剧剧集...</div>
            ) : !seriesId ? (
              <div className={styles.sidebarEmpty}>
                暂时无法定位当前剧集所属剧集，请稍后刷新重试。
              </div>
            ) : seriesEpisodes.length > 0 ? (
              <HoverScrollArea className={styles.episodeListScroller} axis="y" delayMs={50}>
                <div className={styles.episodeQueue}>
                  {seriesEpisodes.map((episode) => (
                    <EpisodeQueueItem
                      key={episode.id}
                      item={episode}
                      active={episode.id === currentItemId || episode.playbackTargetId === currentItemId}
                    />
                  ))}
                </div>
              </HoverScrollArea>
            ) : (
              <div className={styles.sidebarEmpty}>当前还没有识别到本剧剧集。</div>
            )}
          </SidebarSection>
        ) : (
          <SidebarSection
            title={detailKind === 'movie' ? '猜你喜欢' : '延伸内容'}
            description="别让右侧空着，顺手把相近内容接上。"
          >
            {!allowed ? (
              <DeferredSidebarPrompt
                actionLabel="加载延伸内容"
                description="相关推荐延后到交互后再查，避免和起播抢资源。"
                onClick={onRequestQuery}
              />
            ) : (
              <div className={styles.sidebarCardList}>
                {recommendedItems.map((item) => (
                  <SidebarMediaCard
                    key={item.id}
                    item={item}
                    actionLabel={item.playbackTargetId ? '直接播放' : '查看详情'}
                    to={item.playbackTargetId ? buildPlayPath(item) : `/item/${item.id}`}
                  />
                ))}
              </div>
            )}
          </SidebarSection>
        )}
      </aside>
    </>
  );
}

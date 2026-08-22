import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Info, Play, RefreshCw } from 'lucide-react';
import type { LibrarySummary, MediaCardSummary } from '@/domains/browse';
import { CinemaHeroBackdrop } from './CinemaHeroBackdrop';
import { CinemaFilmstrip } from './CinemaFilmstrip';
import { buildMediaMeta, resolvePlayableTargetId } from './utils';
import styles from '../styles/cinema-hero.module.css';
import cardStyles from '../styles/cards.module.css';
import sharedStyles from '../styles/shared.module.css';

const FEATURED_LIMIT = 8;
const AUTOPLAY_INTERVAL_MS = 8_000;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setReduced(query.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return reduced;
}

/**
 * 媒体库详情页 · 电影院式聚光轮播头部
 *
 * 全宽背景轮播（横图 + 氛围渐变兜底）+ 前景精选信息 + 底部胶片条导航。
 */
export function LibraryCinemaHero({
  library,
  items,
  heroSummary,
  loadedLabel,
  onRefresh,
}: {
  library: LibrarySummary;
  items: MediaCardSummary[];
  heroSummary?: string;
  loadedLabel: string;
  onRefresh: () => void;
}) {
  const featured = useMemo(() => items.slice(0, FEATURED_LIMIT), [items]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const visitedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (activeIndex >= featured.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, featured.length]);

  const hasCarousel = featured.length > 1;

  useEffect(() => {
    if (!hasCarousel || paused || reducedMotion) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % featured.length);
    }, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [hasCarousel, paused, reducedMotion, featured.length]);

  const activeItem = featured[Math.min(activeIndex, featured.length - 1)];
  if (!activeItem) {
    return null;
  }
  visitedRef.current.add(activeItem.id);

  const meta = buildMediaMeta(activeItem);
  const playTargetId = resolvePlayableTargetId(activeItem);
  const description =
    activeItem.description ?? heroSummary ?? library.description ?? '在这个媒体库里继续筛选和浏览。';

  return (
    <section
      className={styles.hero}
      aria-roledescription={hasCarousel ? 'carousel' : undefined}
      aria-label={`${library.name} 精选`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className={styles.backdropStage}>
        {featured.map((item, index) =>
          visitedRef.current.has(item.id) ? (
            <CinemaHeroBackdrop key={item.id} item={item} active={index === activeIndex} />
          ) : null,
        )}
      </div>
      <div className={styles.scrim} />

      <div className={styles.content}>
        <div className={styles.eyebrowRow}>
          <span className={sharedStyles.eyebrow}>
            {library.typeLabel} · {library.name}
          </span>
          {hasCarousel ? (
            <span className={styles.counter} aria-hidden="true">
              {activeIndex + 1} / {featured.length}
            </span>
          ) : null}
        </div>

        <div className={styles.slideCopy} key={activeItem.id} aria-live="polite">
          <h1 className={styles.title}>{activeItem.title}</h1>
          {meta.length > 0 ? (
            <div className={styles.metaRow}>
              {meta.map((entry) => (
                <span key={entry} className={cardStyles.metaChip}>
                  {entry}
                </span>
              ))}
            </div>
          ) : null}
          <p className={styles.description}>{description}</p>
          {activeItem.availabilityNotice ? (
            <div className={cardStyles.cardNotice}>{activeItem.availabilityNotice}</div>
          ) : null}
          <div className={sharedStyles.buttonRow}>
            {playTargetId ? (
              <Link className={sharedStyles.primaryButton} to={`/play/${playTargetId}`}>
                <Play size={16} />
                立即播放
              </Link>
            ) : null}
            <Link
              className={playTargetId ? sharedStyles.secondaryButton : sharedStyles.primaryButton}
              to={`/item/${activeItem.id}`}
            >
              <Info size={16} />
              查看详情
            </Link>
          </div>
        </div>

        <div className={styles.statsRow}>
          <span className={sharedStyles.filterChip}>{library.itemCount.toLocaleString('zh-CN')} 个内容</span>
          <span className={sharedStyles.filterChip}>{loadedLabel}</span>
          {library.accentLabel ? <span className={sharedStyles.filterChip}>{library.accentLabel}</span> : null}
        </div>
      </div>

      <div className={styles.filmstripBar}>
        {hasCarousel ? (
          <CinemaFilmstrip items={featured} activeIndex={activeIndex} onSelect={setActiveIndex} />
        ) : (
          <span />
        )}
        <div className={styles.heroActions}>
          <Link className={sharedStyles.secondaryButton} to="/libraries">
            返回媒体库
          </Link>
          <button className={sharedStyles.secondaryButton} type="button" onClick={onRefresh}>
            <RefreshCw size={14} />
            刷新
          </button>
        </div>
      </div>
    </section>
  );
}

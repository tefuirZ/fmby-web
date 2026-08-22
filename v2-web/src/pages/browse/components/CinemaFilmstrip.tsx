import { useEffect, useRef, type KeyboardEvent } from 'react';
import { generatePlaceholderColor, usePosterUrl } from '@/shared/hooks/usePosterUrl';
import { useHoverWheelScroll } from '@/shared/hooks/useHoverWheelScroll';
import type { MediaCardSummary } from '@/domains/browse';
import styles from '../styles/cinema-hero.module.css';

function FilmThumb({
  item,
  active,
  onSelect,
}: {
  item: MediaCardSummary;
  active: boolean;
  onSelect: () => void;
}) {
  const { url, onError } = usePosterUrl(item.artwork);
  const ref = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (active) {
      ref.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [active]);

  return (
    <button
      ref={ref}
      className={styles.filmThumb}
      type="button"
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      data-active={active ? 'true' : 'false'}
      aria-label={`切换到 ${item.title}`}
      title={item.title}
      onClick={onSelect}
    >
      {url ? (
        <img className={styles.filmThumbImage} src={url} alt="" onError={onError} loading="lazy" />
      ) : (
        <span className={styles.filmThumbFallback} style={{ background: generatePlaceholderColor(item.title) }}>
          {item.title.charAt(0)}
        </span>
      )}
      {item.progress && !item.progress.completed ? (
        <span className={styles.filmThumbProgress}>
          <span style={{ width: `${Math.min(100, Math.max(2, item.progress.progressPercent))}%` }} />
        </span>
      ) : null}
    </button>
  );
}

/**
 * 胶片条导航：竖版 2:3 小海报横向排列，当前项高亮，
 * 支持点击、左右方向键切换与滚轮横滚。
 */
export function CinemaFilmstrip({
  items,
  activeIndex,
  onSelect,
}: {
  items: MediaCardSummary[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const { bindings } = useHoverWheelScroll<HTMLDivElement>({ axis: 'x' });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const delta = event.key === 'ArrowLeft' ? -1 : 1;
    onSelect((activeIndex + delta + items.length) % items.length);
  };

  return (
    <div
      className={styles.filmstrip}
      role="tablist"
      aria-label="精选内容导航"
      onKeyDown={handleKeyDown}
      {...bindings}
    >
      {items.map((item, index) => (
        <FilmThumb key={item.id} item={item} active={index === activeIndex} onSelect={() => onSelect(index)} />
      ))}
    </div>
  );
}

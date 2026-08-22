import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { Link } from 'react-router';
import { usePosterUrl, useBackdropUrl, generatePlaceholderColor } from '@/shared/hooks/usePosterUrl';
import { useHoverWheelScroll } from '@/shared/hooks/useHoverWheelScroll';
import type { BrowseHero } from '@/domains/browse';
import { PosterBadges, buildPosterBadgeModel } from '../PosterBadges';
import { MediaProgressBar } from './MediaProgressBar';
import { AdaptiveWideBackdrop } from './AdaptiveWideBackdrop';
import { buildCardProgressLabel } from './utils';
import heroStyles from '../styles/hero.module.css';
import cardStyles from '../styles/cards.module.css';
import sharedStyles from '../styles/shared.module.css';

function shouldReduceMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function HeroSlideThumb({
  hero,
  active,
  index,
  onSelect,
}: {
  hero: BrowseHero;
  active: boolean;
  index: number;
  onSelect: () => void;
}) {
  const { url: posterUrl, onError: onPosterError } = usePosterUrl(hero.item.artwork);
  const { url: backdropUrl, onError: onBackdropError } = useBackdropUrl(hero.item.artwork);
  const image = hero.item.availabilityNotice ? undefined : (posterUrl ?? backdropUrl);
  const ref = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (active) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [active]);

  return (
    <button
      ref={ref}
      className={heroStyles.heroFilmThumb}
      type="button"
      data-active={active ? 'true' : 'false'}
      onClick={onSelect}
      aria-label={`切换到 ${hero.item.title}`}
      title={hero.item.title}
    >
      <div className={heroStyles.heroFilmThumbMedia}>
        {image ? (
          <img
            className={heroStyles.heroFilmThumbImg}
            src={image}
            alt={hero.item.title}
            onError={posterUrl ? onPosterError : onBackdropError}
            loading="lazy"
          />
        ) : (
          <div
            className={heroStyles.heroFilmThumbFallback}
            style={{ background: generatePlaceholderColor(hero.item.title) }}
          >
            {hero.item.title.charAt(0)}
          </div>
        )}
        {hero.item.progress && !hero.item.progress.completed ? (
          <div className={heroStyles.heroFilmThumbProgress}>
            <div style={{ width: `${Math.min(100, Math.max(2, hero.item.progress.progressPercent))}%` }} />
          </div>
        ) : null}
        <span className={heroStyles.heroFilmThumbIndex}>{index + 1}</span>
      </div>
      <span className={heroStyles.heroFilmThumbTitle}>{hero.item.title}</span>
    </button>
  );
}

export function HeroSpotlight({
  hero,
  slides,
  adminReminder,
}: {
  hero: BrowseHero;
  slides?: BrowseHero[];
  adminReminder?: ReactNode;
}) {
  const heroSlides = useMemo(
    () => (slides && slides.length > 0 ? slides : [hero]),
    [hero, slides],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const activeHero = heroSlides[Math.min(activeIndex, heroSlides.length - 1)] ?? hero;
  const hasCarousel = heroSlides.length > 1;
  const { url: backdropCandidate, onError: onBackdropError } = useBackdropUrl(activeHero.item.artwork);
  const { url: posterCandidate, onError: onPosterError } = usePosterUrl(activeHero.item.artwork);
  const backdrop = activeHero.item.availabilityNotice ? undefined : backdropCandidate;
  const poster = activeHero.item.availabilityNotice ? undefined : posterCandidate;

  const { bindings } = useHoverWheelScroll<HTMLDivElement>({ axis: 'x' });

  const posterBadges = buildPosterBadgeModel({
    kind: activeHero.item.kind,
    badge: activeHero.item.badge,
    tags: activeHero.item.tags,
    ratingLabel: activeHero.item.ratingLabel,
    resolutionLabel: activeHero.item.resolutionLabel,
    year: activeHero.item.year,
    itemCount: activeHero.item.itemCount,
    durationSeconds: activeHero.item.durationSeconds,
  });

  useEffect(() => {
    if (activeIndex < heroSlides.length) {
      return;
    }
    setActiveIndex(0);
  }, [activeIndex, heroSlides.length]);

  useEffect(() => {
    if (!hasCarousel || isCarouselPaused || shouldReduceMotion()) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % heroSlides.length);
    }, 8_000);

    return () => window.clearInterval(timer);
  }, [hasCarousel, heroSlides.length, isCarouselPaused]);

  const goPrev = () => {
    setActiveIndex((current) => (current - 1 + heroSlides.length) % heroSlides.length);
  };

  const goNext = () => {
    setActiveIndex((current) => (current + 1) % heroSlides.length);
  };

  return (
    <section
      className={heroStyles.hero}
      aria-roledescription={hasCarousel ? 'carousel' : undefined}
      onMouseEnter={() => setIsCarouselPaused(true)}
      onMouseLeave={() => setIsCarouselPaused(false)}
      onFocusCapture={() => setIsCarouselPaused(true)}
      onBlurCapture={() => setIsCarouselPaused(false)}
    >
      {backdrop ? (
        <AdaptiveWideBackdrop imageUrl={backdrop} onError={onBackdropError} />
      ) : (
        <div
          className={heroStyles.heroBackground}
          style={{ background: generatePlaceholderColor(activeHero.item.title) }}
        />
      )}
      <div className={heroStyles.heroLayout}>
        <div className={heroStyles.heroCopy}>
          <div className={heroStyles.heroKicker}>
            <span className={heroStyles.heroEyebrow}>{hasCarousel ? '热播轮播' : '今晚继续'}</span>
            {hasCarousel ? (
              <span className={heroStyles.heroCounter}>{activeIndex + 1} / {heroSlides.length}</span>
            ) : null}
          </div>
          <h1 className={heroStyles.heroTitle}>{activeHero.item.title}</h1>
          {activeHero.meta.length > 0 ? (
            <div className={heroStyles.heroMeta}>
              {activeHero.meta.map((entry) => (
                <span key={entry} className={cardStyles.metaChip}>
                  {entry}
                </span>
              ))}
            </div>
          ) : null}
          <p className={heroStyles.heroDescription}>{activeHero.description}</p>
          {activeHero.item.availabilityNotice ? (
            <div className={cardStyles.cardNotice}>{activeHero.item.availabilityNotice}</div>
          ) : null}
          <div className={sharedStyles.buttonRow}>
            <Link className={sharedStyles.primaryButton} to={activeHero.primaryActionTo}>
              {activeHero.primaryActionTo.startsWith('/play/') ? <Play size={16} /> : null}
              {activeHero.primaryActionLabel}
            </Link>
            {activeHero.secondaryActionLabel && activeHero.secondaryActionTo ? (
              <Link className={sharedStyles.secondaryButton} to={activeHero.secondaryActionTo}>
                {activeHero.secondaryActionLabel}
              </Link>
            ) : null}
          </div>
          {activeHero.item.progress ? (
            <MediaProgressBar
              value={activeHero.item.progress.progressPercent}
              label={buildCardProgressLabel(activeHero.item)}
            />
          ) : null}

          {hasCarousel ? (
            <div className={heroStyles.heroThumbSection}>
              <div className={heroStyles.heroThumbHeader}>
                <span className={heroStyles.heroThumbLabel}>热播精选 ({activeIndex + 1}/{heroSlides.length})</span>
                <div className={heroStyles.heroNavButtons}>
                  <button
                    className={heroStyles.heroArrowButton}
                    type="button"
                    onClick={goPrev}
                    aria-label="上一部热播内容"
                    title="上一部"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className={heroStyles.heroArrowButton}
                    type="button"
                    onClick={goNext}
                    aria-label="下一部热播内容"
                    title="下一部"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div
                className={heroStyles.heroThumbRail}
                aria-label="热播内容缩略导航"
                {...bindings}
              >
                {heroSlides.map((slide, index) => (
                  <HeroSlideThumb
                    key={slide.item.id}
                    hero={slide}
                    active={index === activeIndex}
                    index={index}
                    onSelect={() => setActiveIndex(index)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {adminReminder}
        </div>
        <div className={heroStyles.heroPosterWrap}>
          {poster ? (
            <img alt={activeHero.item.title} className={heroStyles.heroPoster} src={poster} onError={onPosterError} />
          ) : (
            <div
              className={cardStyles.imageFallback}
              style={{
                width: 'min(280px, 100%)',
                aspectRatio: '2/3',
                borderRadius: 22,
                background: generatePlaceholderColor(hero.item.title),
                fontSize: '3rem',
              }}
            >
              {activeHero.item.title.charAt(0)}
            </div>
          )}
          <PosterBadges
            feature={posterBadges.feature}
            score={posterBadges.score}
            resolution={posterBadges.resolution}
            footer={posterBadges.footer}
          />
        </div>
      </div>
    </section>
  );
}


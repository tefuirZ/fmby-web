import type Artplayer from 'artplayer';
import type { Option } from 'artplayer';
import type {
  PlayerEngine,
  PlayerEngineAdapter,
  PlayerEngineCreateOptions,
} from '../types';

type ArtPlayerConstructor = typeof Artplayer;

let artPlayerPromise: Promise<ArtPlayerConstructor> | null = null;

export class ArtPlayerEngineAdapter implements PlayerEngineAdapter {
  async create(options: PlayerEngineCreateOptions): Promise<PlayerEngine> {
    const ArtPlayer = await loadArtPlayerConstructor();
    options.container.innerHTML = '';

    const artOptions: Option = {
      container: options.container,
      url: options.url,
      poster: options.poster,
      theme: options.theme,
      lang: 'zh-cn',
      autoplay: options.autoplay,
      volume: 0.8,
      hotkey: true,
      pip: true,
      mutex: true,
      setting: true,
      playbackRate: true,
      aspectRatio: true,
      screenshot: false,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: true,
      playsInline: true,
      lock: true,
      gesture: true,
      fastForward: true,
      airplay: true,
      autoPlayback: false,
      subtitleOffset: true,
      moreVideoAttr: {
        preload: 'metadata',
      },
      contextmenu: [
        {
          name: 'fmby-player',
          html: 'FMBY ArtPlayer',
        },
      ],
    };

    if (options.subtitleUrl) {
      artOptions.subtitle = {
        url: options.subtitleUrl,
        type: 'vtt',
        name: options.subtitleLabel ?? '默认字幕',
        style: {
          color: 'rgba(255, 255, 255, 0.92)',
          fontSize: '24px',
          fontWeight: '600',
          textShadow: '0 2px 12px rgba(0, 0, 0, 0.95)',
        },
      };
    }

    const art = new ArtPlayer(artOptions);
    let resumed = false;

    art.on('video:loadedmetadata', () => {
      if (!resumed && options.resumePosition && options.resumePosition > 0) {
        resumed = true;
        art.seek = options.resumePosition;
        art.notice.show = `已恢复到 ${formatTime(options.resumePosition)}`;
      }
    });

    art.on('video:timeupdate', () => {
      options.onTimeUpdate?.(safeNumber(art.currentTime), safeNumber(art.duration));
    });

    art.on('video:play', () => {
      options.onPlay?.();
    });

    art.on('video:pause', () => {
      options.onPause?.(safeNumber(art.currentTime), safeNumber(art.duration));
    });

    art.on('video:ended', () => {
      options.onEnded?.(safeNumber(art.currentTime), safeNumber(art.duration));
    });

    art.on('video:error', (error) => {
      options.onError?.(error ?? art.video.error);
    });

    art.on('video:seeked', () => {
      options.onSeeked?.(safeNumber(art.currentTime));
    });

    return {
      destroy: () => art.destroy(true),
      seek: (time) => {
        art.seek = time;
      },
      play: () => {
        void art.play();
      },
      pause: () => art.pause(),
      setSpeed: (rate) => {
        art.playbackRate = rate;
      },
      setVolume: (value) => {
        art.volume = Math.max(0, Math.min(1, value));
      },
    };
  }
}

async function loadArtPlayerConstructor(): Promise<ArtPlayerConstructor> {
  if (!artPlayerPromise) {
    artPlayerPromise = import('artplayer').then((module) => module.default);
  }

  return artPlayerPromise;
}

function safeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

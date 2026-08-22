import type {
  PlayerEngine,
  PlayerEngineAdapter,
  PlayerEngineCreateOptions,
} from '../types';

type DPlayerEventName =
  | 'loadedmetadata'
  | 'timeupdate'
  | 'play'
  | 'pause'
  | 'ended'
  | 'error'
  | 'seeked';

interface DPlayerOptions {
  container: HTMLDivElement;
  autoplay: boolean;
  theme: string;
  lang: string;
  screenshot: boolean;
  hotkey: boolean;
  preload: string;
  volume: number;
  mutex: boolean;
  video: {
    url: string;
    pic?: string;
    type: string;
  };
  contextmenu: Array<{ text: string }>;
  subtitle?: {
    url: string;
    type: 'webvtt';
    fontSize: string;
    bottom: string;
    color: string;
  };
}

interface DPlayerInstanceLike {
  video: HTMLVideoElement;
  on(event: DPlayerEventName, handler: () => void): void;
  seek(time: number): void;
  notice(text: string, time?: number, opacity?: number): void;
  destroy(): void;
  play(): void;
  pause(): void;
  speed(rate: number): void;
  volume(value: number): void;
}

type DPlayerConstructorLike = new (options: DPlayerOptions) => DPlayerInstanceLike;

let dplayerPromise: Promise<DPlayerConstructorLike> | null = null;

export class DPlayerEngineAdapter implements PlayerEngineAdapter {
  async create(options: PlayerEngineCreateOptions): Promise<PlayerEngine> {
    const DPlayer = await loadDPlayerConstructor();
    const dplayerOptions: DPlayerOptions = {
      container: options.container,
      autoplay: options.autoplay,
      theme: options.theme,
      lang: 'zh-cn',
      screenshot: true,
      hotkey: true,
      preload: 'metadata',
      volume: 0.8,
      mutex: true,
      video: {
        url: options.url,
        pic: options.poster,
        type: 'auto',
      },
      contextmenu: [{ text: 'FMBY Player' }],
    };

    if (options.subtitleUrl) {
      dplayerOptions.subtitle = {
        url: options.subtitleUrl,
        type: 'webvtt',
        fontSize: '24px',
        bottom: '6%',
        color: '#ffffffcc',
      };
    }

    const dp = new DPlayer(dplayerOptions);
    let resumed = false;

    dp.on('loadedmetadata', () => {
      if (!resumed && options.resumePosition && options.resumePosition > 0) {
        resumed = true;
        dp.seek(options.resumePosition);
        dp.notice(`已恢复到 ${formatTime(options.resumePosition)}`, 3000, 0.8);
      }
    });

    dp.on('timeupdate', () => {
      options.onTimeUpdate?.(dp.video.currentTime, dp.video.duration);
    });

    dp.on('play', () => {
      options.onPlay?.();
    });

    dp.on('pause', () => {
      options.onPause?.(dp.video.currentTime, dp.video.duration);
    });

    dp.on('ended', () => {
      options.onEnded?.(dp.video.currentTime, dp.video.duration);
    });

    dp.on('error', () => {
      options.onError?.(dp.video.error);
    });

    dp.on('seeked', () => {
      options.onSeeked?.(dp.video.currentTime);
    });

    return {
      destroy: () => dp.destroy(),
      seek: (time) => dp.seek(time),
      play: () => dp.play(),
      pause: () => dp.pause(),
      setSpeed: (rate) => dp.speed(rate),
      setVolume: (value) => dp.volume(value),
    };
  }
}

async function loadDPlayerConstructor(): Promise<DPlayerConstructorLike> {
  if (!dplayerPromise) {
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      if (isDPlayerBannerLog(args)) {
        return;
      }
      originalLog(...args);
    };

    dplayerPromise = import('dplayer')
      .then((module) => module.default as unknown as DPlayerConstructorLike)
      .finally(() => {
        console.log = originalLog;
      });
  }

  return dplayerPromise;
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

function isDPlayerBannerLog(args: unknown[]) {
  return args.some((arg) => typeof arg === 'string' && arg.includes('DPlayer v'));
}
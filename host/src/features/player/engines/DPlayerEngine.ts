import type DPlayer from 'dplayer';
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
  // 与 ambient `dplayer`（src/types/dplayer.d.ts）的字面量联合对齐：本地选项必须
  // 可赋给 ambient 构造函数。旧实现用 `as unknown as DPlayerConstructorLike` 掩盖了
  // 两侧 `lang/preload/video.type` 的 string↔字面量漂移。
  lang: 'en' | 'zh-cn' | 'zh-tw';
  screenshot: boolean;
  hotkey: boolean;
  preload: 'auto' | 'metadata' | 'none';
  volume: number;
  mutex: boolean;
  video: {
    url: string;
    pic?: string;
    type: 'auto' | 'normal' | 'hls' | 'flv' | 'dash';
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

// 直接复用 ambient 模块的默认导出类作构造器类型，替代手写的实例镜像——镜像与
// ambient 漂移正是旧 `as unknown as DPlayerConstructorLike` 的根因。
type DPlayerConstructorLike = typeof DPlayer;

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
    // ambient `on(event: string, …)` 会丢掉事件名字面量联合；薄包装把它补回来
    // （不引入断言，也不再需要手写实例镜像）。
    const on = (event: DPlayerEventName, handler: () => void): void => dp.on(event, handler);
    let resumed = false;

    on('loadedmetadata', () => {
      if (!resumed && options.resumePosition && options.resumePosition > 0) {
        resumed = true;
        dp.seek(options.resumePosition);
        dp.notice(`已恢复到 ${formatTime(options.resumePosition)}`, 3000, 0.8);
      }
    });

    on('timeupdate', () => {
      options.onTimeUpdate?.(dp.video.currentTime, dp.video.duration);
    });

    on('play', () => {
      options.onPlay?.();
    });

    on('pause', () => {
      options.onPause?.(dp.video.currentTime, dp.video.duration);
    });

    on('ended', () => {
      options.onEnded?.(dp.video.currentTime, dp.video.duration);
    });

    on('error', () => {
      options.onError?.(dp.video.error);
    });

    on('seeked', () => {
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
      .then((module) => module.default)
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

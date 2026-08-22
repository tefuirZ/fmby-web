declare module 'dplayer' {
  interface DPlayerDanmakuOptions {
    id: string;
    api?: string;
    bottom?: string;
    unlimited?: boolean;
  }

  interface DPlayerSubtitleOptions {
    url: string;
    type?: 'webvtt' | 'ass';
    fontSize?: string;
    bottom?: string;
    color?: string;
  }

  interface DPlayerVideoQuality {
    name: string;
    url: string;
    type?: string;
  }

  interface DPlayerVideoOptions {
    url?: string;
    pic?: string;
    thumbnails?: string;
    type?: 'auto' | 'normal' | 'hls' | 'flv' | 'dash';
    customType?: Record<string, (video: HTMLVideoElement, player: DPlayer) => void>;
    quality?: DPlayerVideoQuality[];
    defaultQuality?: number;
  }

  interface DPlayerHighlight {
    time: number;
    text: string;
  }

  interface DPlayerContextMenuItem {
    text: string;
    link?: string;
    click?: (player: DPlayer) => void;
  }

  interface DPlayerOptions {
    container: HTMLElement;
    live?: boolean;
    autoplay?: boolean;
    theme?: string;
    loop?: boolean;
    lang?: 'en' | 'zh-cn' | 'zh-tw';
    screenshot?: boolean;
    hotkey?: boolean;
    preload?: 'auto' | 'metadata' | 'none';
    volume?: number;
    mutex?: boolean;
    logo?: string;
    video: DPlayerVideoOptions;
    subtitle?: DPlayerSubtitleOptions;
    danmaku?: DPlayerDanmakuOptions;
    contextmenu?: DPlayerContextMenuItem[];
    highlight?: DPlayerHighlight[];
  }

  class DPlayer {
    constructor(options: DPlayerOptions);
    play(): void;
    pause(): void;
    seek(time: number): void;
    toggle(): void;
    speed(rate: number): void;
    volume(percentage: number): void;
    volume(percentage?: number, nostorage?: boolean, nonotice?: boolean): number;
    switchVideo(video: DPlayerVideoOptions, danmaku?: DPlayerDanmakuOptions): void;
    switchQuality(index: number): void;
    notice(text: string, time?: number, opacity?: number): void;
    destroy(): void;
    on(event: string, handler: (...args: unknown[]) => void): void;
    video: HTMLVideoElement;
    fullScreen: {
      request(type?: 'web' | 'browser'): void;
      cancel(type?: 'web' | 'browser'): void;
    };
    danmaku: {
      send(dan: { text: string; color?: string; type?: string }): void;
      draw(dan: { text: string; color?: string; type?: string }): void;
      hide(): void;
      show(): void;
      clear(): void;
      opacity(percentage: number): void;
    };
    template: {
      videoWrap: HTMLElement;
    };
  }

  export default DPlayer;
}

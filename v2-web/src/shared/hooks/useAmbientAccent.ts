import { useEffect } from 'react';

/**
 * Darkroom 环境光：从当前封面提取主色，写入 CSS 变量驱动全局氛围。
 *
 * 暗房方案里界面本身不带品牌色，唯一的颜色来自正在浏览的内容。
 * 本 hook 负责：
 *   1. 把图片画进 32×32 离屏 canvas，按饱和度加权投票选出主色相；
 *   2. 把主色归一到 L≈68% / S≤70%，保证任何封面下描边与辉光都可见、
 *      且不会因为封面过暗过亮而「消失」；
 *   3. 写入 --content-accent / --content-accent-rgb。
 *
 * 失败（跨域污染、404、解码失败）一律静默回退到白色，不影响渲染。
 */

const ACCENT_VAR = '--content-accent';
const ACCENT_RGB_VAR = '--content-accent-rgb';

const DEFAULT_RGB: Rgb = [255, 255, 255];

/** 主色缓存：同一张图在整个会话里只解析一次 */
const accentCache = new Map<string, Rgb>();
/** 正在解析中的 URL，避免同一张图并发解析 */
const inflight = new Map<string, Promise<Rgb>>();

type Rgb = readonly [number, number, number];

export interface UseAmbientAccentOptions {
  /** 应用变量的目标元素，默认 document.documentElement */
  target?: HTMLElement | null;
  /** 置 false 时跳过解析并保持当前配色 */
  enabled?: boolean;
}

export function useAmbientAccent(
  imageUrl: string | null | undefined,
  options: UseAmbientAccentOptions = {},
): void {
  const { target, enabled = true } = options;

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const element = target ?? document.documentElement;
    if (!enabled) {
      return;
    }
    if (!imageUrl) {
      applyAccent(element, DEFAULT_RGB);
      return;
    }

    let cancelled = false;

    const cached = accentCache.get(imageUrl);
    if (cached) {
      applyAccent(element, cached);
    } else {
      void resolveAccent(imageUrl).then((rgb) => {
        if (!cancelled) {
          applyAccent(element, rgb);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [imageUrl, target, enabled]);

  // 卸载时熄灯，避免离开浏览页后管理页残留上一张封面的色温
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const element = target ?? document.documentElement;
    return () => {
      applyAccent(element, DEFAULT_RGB);
    };
  }, [target]);
}

function applyAccent(element: HTMLElement, rgb: Rgb): void {
  const [r, g, b] = rgb;
  element.style.setProperty(ACCENT_VAR, `rgb(${r}, ${g}, ${b})`);
  element.style.setProperty(ACCENT_RGB_VAR, `${r} ${g} ${b}`);
}

function resolveAccent(url: string): Promise<Rgb> {
  const existing = inflight.get(url);
  if (existing) {
    return existing;
  }

  const task = loadImage(url)
    .then((image) => {
      const rgb = extractAccent(image);
      accentCache.set(url, rgb);
      return rgb;
    })
    .catch(() => {
      accentCache.set(url, DEFAULT_RGB);
      return DEFAULT_RGB;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, task);
  return task;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`ambient accent: image load failed (${url})`));
    image.src = url;
  });
}

const SAMPLE_SIZE = 32;
const HUE_BUCKETS = 24;

function extractAccent(image: HTMLImageElement): Rgb {
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return DEFAULT_RGB;
  }
  ctx.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  // 跨域未授权时 getImageData 会抛 SecurityError
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
  } catch {
    return DEFAULT_RGB;
  }

  const weights = new Float64Array(HUE_BUCKETS);
  const satSums = new Float64Array(HUE_BUCKETS);

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 128) {
      continue;
    }
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    // 丢弃接近黑/白与近乎无彩的像素：它们决定不了「这张图是什么颜色」
    if (l < 0.12 || l > 0.92 || s < 0.12) {
      continue;
    }
    // 权重：饱和度越高、亮度越靠中间，越能代表画面主色
    const weight = s * s * (1 - Math.abs(l - 0.5) * 1.2);
    if (weight <= 0) {
      continue;
    }
    const bucket = Math.min(HUE_BUCKETS - 1, Math.floor((h / 360) * HUE_BUCKETS));
    weights[bucket] += weight;
    satSums[bucket] += s * weight;
  }

  let best = -1;
  let bestWeight = 0;
  for (let i = 0; i < HUE_BUCKETS; i += 1) {
    if (weights[i] > bestWeight) {
      bestWeight = weights[i];
      best = i;
    }
  }

  if (best < 0 || bestWeight === 0) {
    return DEFAULT_RGB;
  }

  const hue = ((best + 0.5) / HUE_BUCKETS) * 360;
  const saturation = clamp(satSums[best] / bestWeight, 0.34, 0.7);
  return hslToRgb(hue, saturation, 0.68);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** @returns [hue 0-360, saturation 0-1, lightness 0-1] */
function rgbToHsl(r8: number, g8: number, b8: number): [number, number, number] {
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return [0, 0, l];
  }

  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let h: number;
  if (max === r) {
    h = ((g - b) / delta) % 6;
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }
  h *= 60;
  if (h < 0) {
    h += 360;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rgb: [number, number, number];
  if (h < 60) {
    rgb = [c, x, 0];
  } else if (h < 120) {
    rgb = [x, c, 0];
  } else if (h < 180) {
    rgb = [0, c, x];
  } else if (h < 240) {
    rgb = [0, x, c];
  } else if (h < 300) {
    rgb = [x, 0, c];
  } else {
    rgb = [c, 0, x];
  }

  return [
    Math.round((rgb[0] + m) * 255),
    Math.round((rgb[1] + m) * 255),
    Math.round((rgb[2] + m) * 255),
  ] as const;
}

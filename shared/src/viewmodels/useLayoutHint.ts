/**
 * 布局提示（WEB-B1 交付物 3）：viewmodel 统一暴露 `layout: 'mobile' | 'desktop'`，
 * 供主题（L3）与页面做分支渲染，避免各页面各写一套 matchMedia。
 *
 * 设计约束：
 * - **SSR/无 window 安全**：`window.matchMedia` 缺失时回落到 `desktop`（不阻塞渲染）；
 * - **无布局抖动**：初始值同步取自 matchMedia，不用 effect 后置修正导致首帧错位；
 * - **订阅即时**：媒体查询变化立即更新（横竖屏切换/窗口缩放）；
 * - **可注入**：`useLayoutHint(overrides)` 支持测试与主题强制布局。
 */

import { useEffect, useState } from 'react';

import type { LayoutHint } from './types';

/** 移动端断点（与既有 CSS 断点口径一致：< 768px 为移动）。 */
export const MOBILE_BREAKPOINT_PX = 768;

export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`;

function readLayout(): LayoutHint {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'desktop';
  }
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches ? 'mobile' : 'desktop';
}

/**
 * 当前布局提示。
 *
 * @param override 强制布局（测试或主题显式指定时传入，跳过订阅）。
 */
export function useLayoutHint(override?: LayoutHint): LayoutHint {
  const [layout, setLayout] = useState<LayoutHint>(() => override ?? readLayout());

  useEffect(() => {
    if (override) {
      setLayout(override);
      return;
    }
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const media = window.matchMedia(MOBILE_MEDIA_QUERY);
    // 进入 effect 时以真实值为准（覆盖 SSR 回落值）。
    setLayout(media.matches ? 'mobile' : 'desktop');
    const listener = (event: MediaQueryListEvent) => {
      setLayout(event.matches ? 'mobile' : 'desktop');
    };
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
    // 旧版 Safari 兼容（addEventListener 缺失）。
    media.addListener(listener);
    return () => media.removeListener(listener);
  }, [override]);

  return layout;
}

/** 纯函数版布局判定（供非 hook 场景与单测使用）。 */
export function layoutForViewport(width: number): LayoutHint {
  return width < MOBILE_BREAKPOINT_PX ? 'mobile' : 'desktop';
}

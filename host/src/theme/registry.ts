/**
 * 主题注册表（host 侧加载契约）
 *
 * 注意：这里对主题包只做两件事——
 *  1. `?url` 取资产生成地址（字符串常量，不加载、不执行任何主题字节）；
 *  2. 动态 `import()` 声明懒入口（产物独立 async chunk，激活时才拉取）。
 * 因此 host 首屏不加载主题产物（docs/09 §6.1），红线由
 * scripts/check-frontend-size.mjs 依据 vite manifest 断言。
 */

import type { ThemeRegistration } from '@fmby/v2-shared/theme';
import darkroomManifestUrl from '@fmby/v2-theme-darkroom/theme.manifest.json?url';
import darkroomTokensUrl from '@fmby/v2-theme-darkroom/tokens.css?url';
import darkroomAmbientUrl from '@fmby/v2-theme-darkroom/aurora.css?url';
import templateManifestUrl from '@fmby/v2-theme-template/theme.manifest.json?url';
import templateTokensUrl from '@fmby/v2-theme-template/tokens.css?url';

export const DEFAULT_THEME_ID = 'darkroom';

export const THEME_REGISTRY: Record<string, ThemeRegistration> = {
  darkroom: {
    id: 'darkroom',
    manifestUrl: darkroomManifestUrl,
    assets: {
      'tokens.css': darkroomTokensUrl,
      'aurora.css': darkroomAmbientUrl,
    },
    loadEntry: () => import('@fmby/v2-theme-darkroom').then((m) => m.default),
  },
  template: {
    id: 'template',
    manifestUrl: templateManifestUrl,
    assets: {
      'tokens.css': templateTokensUrl,
    },
    loadEntry: () => import('@fmby/v2-theme-template').then((m) => m.default),
  },
};

/**
 * 主题注册表（host 侧加载契约）—— THEME-BUILD-01 运行时外挂形态
 *
 * 主题产物不再进 host 构建图（不 import 主题包源码）：所有资源与入口均按
 * ADR-001 §4 运行时路径从 `/themes/<id>/...` 拉取（后端静态面映射
 * `${data_dir}/themes/<id>/dist/`）。host bundle 零主题字节；第三方主题
 * 安装进 data/themes/<id>/ 即天然可用，无需重建 host。
 *
 * `loadEntry` 用运行时动态 `import(/* webpack 忽略 *\/ 字符串)（Vite 下用
 * 显式 URL 拼接，避免构建期把主题解析进模块图）。
 */

import type { ThemeRegistration } from '@fmby/v2-shared/theme';

export const DEFAULT_THEME_ID = 'darkroom';

/** 主题运行时基址（后端静态面：/themes/<id>/<rest> → data/themes/<id>/dist/<rest>）。 */
export function themeBaseUrl(id: string): string {
  return `/themes/${encodeURIComponent(id)}`;
}

/** 逻辑资源名 → 运行时 URL（静态面同目录布局：dist/<file>）。 */
function themeAssets(id: string, files: string[]): Record<string, string> {
  const base = themeBaseUrl(id);
  return Object.fromEntries(files.map((file) => [file, `${base}/${file}`]));
}

function makeRegistration(id: string, cssFiles: string[]): ThemeRegistration {
  const base = themeBaseUrl(id);
  return {
    id,
    manifestUrl: `${base}/theme.manifest.json`,
    assets: themeAssets(id, cssFiles),
    // 运行时外挂入口：default export ThemeEntryModule（vite library 构建产物）。
    // Vite 构建期看到的是纯字符串拼接 URL，不会把主题打进 host 模块图。
    loadEntry: async () => {
      const module = await import(/* @vite-ignore */ `${base}/index.js`);
      return module.default;
    },
  };
}

export const THEME_REGISTRY: Record<string, ThemeRegistration> = {
  darkroom: makeRegistration('darkroom', [
    'tokens.css',
    'aurora.css',
    'skins/library.css',
    'skins/item.css',
  ]),
  template: makeRegistration('template', ['tokens.css']),
};

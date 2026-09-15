/**
 * 主题注册表（host 侧加载契约）—— THEME-BUILD-01 运行时外挂形态
 *
 * 主题产物不再进 host 构建图（不 import 主题包源码）：所有资源与入口均按
 * ADR-001 §4 运行时路径从 `/themes/<id>/...` 拉取（后端静态面映射
 * `${data_dir}/themes/<id>/dist/`）。host bundle 零主题字节；第三方主题
 * 安装进 data/themes/<id>/ 即天然可用，无需重建 host。
 *
 * `loadEntry` 以 script 注入方式执行主题 IIFE 产物（Vite 构建期看到的是
 * 纯字符串拼接 URL，避免构建期把主题解析进模块图）。
 */

import type { ThemeEntryModule, ThemeRegistration } from '@fmby/v2-shared/theme';
import { exposeThemeGlobals } from './themeGlobals';

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

/** 已加载的 IIFE 主题挂到的全局名（见各主题 vite.config 的 output.globals）。 */
const THEME_GLOBAL_NAME = 'FmbyTheme';

/**
 * 运行时外挂入口：主题产物为 IIFE（`var FmbyTheme = (function(){...})()`，
 * react/shared 由宿主全局变量提供——浏览器环境无 importmap，ESM 裸说明符
 * 无法解析）。以 <script> 注入执行后读全局。Vite 构建期看到的是纯字符串
 * 拼接 URL，不会把主题打进 host 模块图。
 */
function loadIifeThemeEntry(src: string): Promise<ThemeEntryModule> {
  return new Promise((resolve, reject) => {
    // 注入前确保宿主依赖全局桥就位（`})(React)` 需要 window.React；
    // 缺失则主题入口抛 `React is not defined`。幂等。
    exposeThemeGlobals();
    const win = window as unknown as Record<string, unknown>;
    const previous = win[THEME_GLOBAL_NAME];
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      const win = window as unknown as Record<string, unknown>;
      const entry = win[THEME_GLOBAL_NAME];
      // 恢复/清除全局，避免多主题（串行激活）串味。
      // 注：注入的 `var FmbyTheme = …` 在 window 上是**不可配置**属性，
      // `delete` 会抛 `Cannot delete property`（实测）——故改为**赋值**。
      if (previous === undefined) {
        win[THEME_GLOBAL_NAME] = undefined;
      } else {
        win[THEME_GLOBAL_NAME] = previous;
      }
      if (entry && typeof entry === 'object' && 'manifest' in (entry as object)) {
        resolve(entry as ThemeEntryModule);
      } else {
        reject(new Error(`theme entry global "${THEME_GLOBAL_NAME}" missing after load: ${src}`));
      }
    };
    script.onerror = () => reject(new Error(`theme entry script failed to load: ${src}`));
    document.head.appendChild(script);
  });
}

function makeRegistration(id: string, cssFiles: string[]): ThemeRegistration {
  const base = themeBaseUrl(id);
  return {
    id,
    manifestUrl: `${base}/theme.manifest.json`,
    assets: themeAssets(id, cssFiles),
    loadEntry: () => loadIifeThemeEntry(`${base}/index.js`),
  };
}

export const THEME_REGISTRY: Record<string, ThemeRegistration> = {
  darkroom: makeRegistration('darkroom', [
    'tokens.css',
    'aurora.css',
    'skins/library.css',
    'skins/item.css',
  ]),
  // `_template` 是第三方主题完整样板：tokens + browse.item L3 皮肤（自带样式层，
  // 演示「域皮肤 + 独立 CSS」的完整接线）。
  template: makeRegistration('template', ['tokens.css', 'skins/item.css']),
};

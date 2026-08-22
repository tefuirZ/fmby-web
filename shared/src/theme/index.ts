/**
 * 主题协议（docs/09-webui.md §3.2，R0 冻结形状）
 *
 * 主题 = 纯外观：tokens.css + 可选 skins。以下能力**禁止**出现在主题内：
 * API client / mapper / query keys / 权限判断 / 预加载业务数据（preload 恒 false）。
 * 该约束由 scripts/check-frontend-dupes.mjs 在 CI 侧强制。
 */

import type { ComponentType } from 'react';

/** 页面域（与 docs/09 §4、docs/13 webui 分节一致） */
export type PageDomain =
  | 'browse'
  | 'playback'
  | 'identify-review'
  | 'scrape'
  | 'manage'
  | 'observability'
  | 'settings';

/** 主题导航贡献项（由 host 合并进全局导航） */
export interface ThemeNavItem {
  id: string;
  label: string;
  to: string;
  domain: PageDomain;
}

/** 主题清单（JSON 落盘，红线 <2KB；host 启动时最先拉取的唯一主题资源） */
export interface ThemeManifest {
  /** 稳定 id：'darkroom' 等 */
  id: string;
  version: string;
  label: string;
  /** palette tokens（统一 token 语言；extraCssFiles 为附加样式层，如环境光层） */
  tokens: { cssFile: string; extraCssFiles?: string[] };
  /** 主题挂载点（app 根） */
  entry: { mount: string };
  /** 各页面域皮肤组件映射（可缺省走 host 默认渲染） */
  skins: Partial<Record<PageDomain, string>>;
  /** 导航贡献 */
  nav: { items: ThemeNavItem[] };
  i18n?: { locale: string };
  /** 恒 false：禁止主题预加载业务数据（lint/CI 强制） */
  preload: false;
}

/**
 * 主题入口模块（动态 import 得到的模块形状）。
 * Skin 为可选的应用级外观层（背景/装饰 chrome）；CSS-only 主题可不提供。
 */
export interface ThemeEntryModule {
  manifest: ThemeManifest;
  Skin?: ComponentType;
}

/** host 侧注册表项（加载契约：manifest URL + 资源 URL 映射 + 懒入口） */
export interface ThemeRegistration {
  id: string;
  /** manifest.json 的运行时 URL（fetch 用，非 import） */
  manifestUrl: string;
  /** 逻辑资源名 → 构建产物 URL（tokens / 附加样式层） */
  assets: Record<string, string>;
  /** 懒加载主题入口（动态 import，产物独立 async chunk） */
  loadEntry: () => Promise<ThemeEntryModule>;
}

/** 主题清单红线（docs/09 §6.4）：manifest 字节数上限 */
export const THEME_MANIFEST_MAX_BYTES = 2048;

/** 校验 ThemeManifest 形状（host 拉取后先校验再应用） */
export function isValidThemeManifest(value: unknown): value is ThemeManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const manifest = value as Partial<ThemeManifest>;
  return (
    typeof manifest.id === 'string' &&
    manifest.id.length > 0 &&
    typeof manifest.version === 'string' &&
    typeof manifest.label === 'string' &&
    typeof manifest.tokens === 'object' &&
    manifest.tokens !== null &&
    typeof manifest.tokens.cssFile === 'string' &&
    typeof manifest.entry === 'object' &&
    manifest.entry !== null &&
    typeof manifest.entry.mount === 'string' &&
    typeof manifest.nav === 'object' &&
    manifest.nav !== null &&
    Array.isArray(manifest.nav.items) &&
    manifest.preload === false
  );
}

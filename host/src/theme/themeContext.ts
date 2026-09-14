/**
 * 主题分发 context（自 ThemeProvider 拆出为 .ts：无 JSX 的模块形态，
 * node:test（strip-types）可直接消费——skins 调度测试需要 stub 注入
 * domainSkins。形状冻结于 docs/09 §3 / §6。
 */

import { createContext, useContext } from 'react';
import type { ThemeEntryModule } from '@fmby/v2-shared/theme';

export type ThemeStatus = 'default' | 'activating' | 'active' | 'error';

export interface ThemeContextValue {
  activeThemeId: string | null;
  status: ThemeStatus;
  availableThemeIds: string[];
  /** 已激活的主题入口（含 L3 domainSkins；未激活/失败 = null）。 */
  entry: ThemeEntryModule | null;
  /** 切换主题：tokens 热替换；同 id 幂等；失败回落当前主题，不重载页面。 */
  switchTheme: (id: string) => Promise<void>;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme 必须在 ThemeProvider 内使用');
  }
  return context;
}

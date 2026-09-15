/**
 * 主题分发运行时（docs/09 §3 / §6）
 *
 * 加载时序（§6.5）：host entry 启动 → ThemeManifest fetch（<2KB，与会话探测并行）
 * → tokens.css 以动态 <link> 注入（非阻塞，首屏渲染不等它）→ skins 懒入口激活。
 * 未就绪期间页面用 host 默认形象（styles/defaults.css），没有假加载动画。
 *
 * 热切换（§6.3）：只做 tokens <link> 替换 + 缺失 skin 懒加载 + data-theme 更新。
 * 不刷新页面、不失效 react-query 缓存、不发业务请求、不打断播放会话。
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  isValidThemeManifest,
  THEME_MANIFEST_MAX_BYTES,
  type ThemeEntryModule,
  type ThemeRegistration,
} from '@fmby/v2-shared/theme';
import { logger } from '@fmby/v2-shared/utils/logger';
import { ThemeContext, useTheme, type ThemeContextValue, type ThemeStatus } from './themeContext';
import { DEFAULT_THEME_ID, THEME_REGISTRY } from './registry';

/** 持久化键。theme_mode 是站点级管理决策（docs/07）：后端 /api/settings 就绪后改为服务端下发，键保留做离线兜底。 */
const THEME_STORAGE_KEY = 'fmby:theme';

function readPersistedThemeId(): string {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && stored in THEME_REGISTRY) {
      return stored;
    }
  } catch {
    // localStorage 不可用（隐私模式等）：走默认主题
  }
  return DEFAULT_THEME_ID;
}

function persistThemeId(id: string): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // 同上：忽略
  }
}

/** 移除当前已注入的主题样式 <link>（热切换的"卸下"半步）。 */
function teardownThemeStyles(): void {
  document.head
    .querySelectorAll('link[data-theme-style]')
    .forEach((link) => link.remove());
}


/**
 * 双缓冲样式切换（FE-OPT-01 ③ 零闪烁）：
 *
 * 旧实现 teardownThemeStyles() 先卸旧 <link>再注入新 <link>——新 CSS 下载
 * 完成前的空窗里 :root 的 --bg-base 回落到 defaults.css 的 #0b0c0f，画布
 * 闪一次「非当前主题色」（实测 ~100 帧/500 帧，约 200ms）。改为：先注入
 * 新 link，等全部加载完成（onload/error）再卸旧层。新旧 tokens 同变量名
 * （兼容旧版 token 命名），切换瞬间新层覆盖旧层，无回落帧。
 */
async function activateNextStyles(registration: ThemeRegistration, cssFiles: string[]): Promise<boolean> {
  const pending: Promise<void>[] = [];
  for (const file of cssFiles) {
    const url = registration.assets[file];
    if (!url) {
      logger.warn(`theme "${registration.id}" 声明了未注册的样式资源: ${file}`);
      return false;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.dataset.themeStyle = registration.id;
    link.dataset.themeRole = 'next';
    pending.push(
      new Promise<void>((resolve) => {
        link.addEventListener('load', () => resolve(), { once: true });
        link.addEventListener('error', () => resolve(), { once: true }); // 错误也继续，让上层激活失败路径处理
      }),
    );
    document.head.appendChild(link);
  }
  await Promise.all(pending);
  return true;
}

interface ActivatedTheme {
  manifestId: string;
  entry: ThemeEntryModule;
}

/** 校验并激活一个主题：manifest fetch（红线 <2KB）→ tokens 注入 → 懒入口。 */
async function activateTheme(registration: ThemeRegistration): Promise<ActivatedTheme> {
  const response = await fetch(registration.manifestUrl);
  if (!response.ok) {
    throw new Error(`theme manifest fetch failed: ${response.status}`);
  }
  const raw = await response.text();
  if (new Blob([raw]).size > THEME_MANIFEST_MAX_BYTES) {
    throw new Error(`theme manifest exceeds ${THEME_MANIFEST_MAX_BYTES} bytes: ${registration.id}`);
  }
  const parsed: unknown = JSON.parse(raw);
  if (!isValidThemeManifest(parsed) || parsed.id !== registration.id) {
    throw new Error(`invalid theme manifest: ${registration.id}`);
  }
  if (parsed.preload !== false) {
    throw new Error(`theme ${registration.id} violates preload:false contract`);
  }

  const cssFiles = [parsed.tokens.cssFile, ...(parsed.tokens.extraCssFiles ?? [])];
  // 双缓冲：新样式全部加载完成后才卸旧层（零闪烁，见 activateNextStyles）。
  if (!(await activateNextStyles(registration, cssFiles))) {
    throw new Error(`theme assets missing in registry: ${registration.id}`);
  }
  // 新层已生效：卸掉**旧主题**的样式层；新层的 next 标记转正为 active。
  document.head
    .querySelectorAll('link[data-theme-style]')
    .forEach((link) => {
      const el = link as HTMLLinkElement;
      if (el.dataset.themeStyle !== registration.id) {
        el.remove();
      } else {
        delete el.dataset.themeRole; // next → active（保留生效）
      }
    });

  const entry = await registration.loadEntry();
  document.documentElement.dataset.theme = parsed.id;
  return { manifestId: parsed.id, entry };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [status, setStatus] = useState<ThemeStatus>('default');
  const [entry, setEntry] = useState<ThemeEntryModule | null>(null);
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    const initialId = readPersistedThemeId();
    activeIdRef.current = initialId;
    let cancelled = false;

    activateTheme(THEME_REGISTRY[initialId])
      .then(({ manifestId, entry: loaded }) => {
        if (cancelled) {
          return;
        }
        setActiveThemeId(manifestId);
        setEntry(loaded);
        setStatus('active');
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        logger.error('初始主题激活失败，保持 host 默认形象', error);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
    // 仅在挂载时执行一次：初始主题激活与会话探测并行（§6.5）
  }, []);

  const switchTheme = useCallback(async (id: string) => {
    const registration = THEME_REGISTRY[id];
    if (!registration) {
      logger.warn(`未注册的主题: ${id}`);
      return;
    }
    if (id === activeIdRef.current) {
      return;
    }
    const previousId = activeIdRef.current;
    setStatus('activating');
    try {
      const { manifestId, entry: loaded } = await activateTheme(registration);
      activeIdRef.current = manifestId;
      setActiveThemeId(manifestId);
      setEntry(loaded);
      setStatus('active');
      persistThemeId(manifestId);
    } catch (error: unknown) {
      logger.error(`切换主题 ${id} 失败`, error);
      // 回落：重新激活上一个主题的 tokens；再失败则回到默认形象（无假加载动画）
      if (previousId && previousId in THEME_REGISTRY) {
        try {
          await activateTheme(THEME_REGISTRY[previousId]);
        } catch {
          teardownThemeStyles();
          delete document.documentElement.dataset.theme;
        }
      } else {
        teardownThemeStyles();
        delete document.documentElement.dataset.theme;
      }
      setStatus('error');
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      activeThemeId,
      status,
      availableThemeIds: Object.keys(THEME_REGISTRY),
      entry,
      switchTheme,
    }),
    [activeThemeId, status, entry, switchTheme],
  );

  const Skin = entry?.Skin;

  return (
    <ThemeContext.Provider value={value}>
      {/* 主题应用级外观层（背景/装饰 chrome）。CSS-only 主题无 Skin，首屏前后都不占位、不渲染占位动画。 */}
      {Skin ? <Skin /> : null}
      {children}
    </ThemeContext.Provider>
  );
}

export { useTheme };

/**
 * 主题协议（docs/09-webui.md §3.2，R0 冻结形状）
 *
 * 主题 = 纯外观：tokens.css + 可选 skins。以下能力**禁止**出现在主题内：
 * API client / mapper / query keys / 权限判断 / 预加载业务数据（preload 恒 false）。
 * 该约束由 scripts/check-frontend-dupes.mjs 在 CI 侧强制。
 */

import type { ComponentType } from 'react';

import type { ThemeCapabilitiesDeclaration } from './capabilities';

export * from './capabilities';

/**
 * 页面域（WEB-C1 粗粒度定版，ADR-001 §3）。
 *
 * 粗粒度原则：域内子页（如 manage 下的媒体/用户/安全）由主题在同一 skin 内
 * 自行重排——host 不按子路由细分 domain，避免 skins 键爆炸与主题碎片化。
 */
export type PageDomain =
  | 'browse.home'
  | 'browse.library'
  | 'browse.item'
  | 'browse.play'
  | 'manage'
  | 'settings'
  | 'observability';

/** 全部 PageDomain 值（host 路由判定用，与上列类型逐一对应） */
export const PAGE_DOMAINS = [
  'browse.home',
  'browse.library',
  'browse.item',
  'browse.play',
  'manage',
  'settings',
  'observability',
] as const satisfies readonly PageDomain[];

/**
 * Skin 数据就绪态（ADR-001 §3 L3 硬约束 3：全部状态必须处理，门禁校验）。
 */
export type SkinState = 'loading' | 'ready' | 'empty' | 'error' | 'forbidden';

/**
 * Skin 实时状态源（WEB-C1 ④：实时显示必须有）。
 *
 * TODO(WEB 实时面)：后端实时推送面（SSE/WebSocket）接入后，host 在此注入
 * 订阅句柄；当前以 host 轮询兜底（见 host `useSkinRealtime`）——轮询间隔
 * 由 host 统一控制，主题不得自建定时器/连接。
 */
export interface SkinRealtime {
  /** 最近一次数据刷新时刻（epoch ms；null = 尚无数据） */
  lastRefreshedAt: number | null;
  /** 是否处于实时推送通道（false = 当前为轮询兑底） */
  isLive: boolean;
  /** 订阅实时更新：返回取消函数；通道未建立时立即以轮询节奏触发 */
  subscribe: (listener: () => void) => () => void;
}

/**
 * L3 页面域皮肤组件 props 契约（ADR-001 §3 硬约束 1/2）。
 *
 * 硬约束：
 * - 只读数据 + 回调：`data` 由 host 调 viewmodel 算好后注入；
 * - 禁止主题取数：不得 useQuery / 调 api client / import contracts 裸 DTO /
 *   自定义 query key（CI dupes 门禁强制）；
 * - 状态全覆盖：主题组件必须处理全部 [`SkinState`]（loading/ready/empty/
 *   error/forbidden 都要有 DOM 输出，门禁校验）；
 * - 移动端必须有：主题 skin 需含移动端布局（媒体查询/响应式，验收门禁人工核）。
 */
export interface SkinProps {
  /** 由 viewmodel 算好的视图数据（形状由各 domain 的 viewmodel 定义） */
  data: unknown;
  /** 数据就绪态（四态全覆盖 + ready） */
  state: SkinState;
  /** 动作回调（语义键名 → host 注入的处理函数；主题不得自建副作用） */
  actions: Record<string, (...args: never[]) => void>;
  /** 实时状态源（WEB-C1 ④：接口先行，当前 host 轮询兑底） */
  realtime: SkinRealtime;
}

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
 * `domainSkins` 为 L3 页面域皮肤（WEB-C1：host 按路由 domain 调度，未声明的
 * domain 静默回落 host 默认页面——功能永不缺失）。
 */
export interface ThemeEntryModule {
  manifest: ThemeManifest;
  Skin?: ComponentType;
  /** L3 页面域皮肤（键 = PageDomain；未声明的 domain 回落 host 默认页面） */
  domainSkins?: Partial<Record<PageDomain, ComponentType<SkinProps>>>;
  /**
   * L2 组件级替换（WEB-C1 3：**接口预留，本卡不实现具体替换**）。
   * 键 = host ui 组件语义名（如 poster-card / item-row / hero）；host 消费
   * 点落地前，此映射被忽略（零行为）。
   */
  componentSkins?: Record<string, ComponentType<SkinProps>>;
  /**
   * 能力面声明（WEB-GOV ④）：声明了 manifest.skins 的 domain 必须覆盖
   * 对应能力面；由 scripts/check-theme-parity.mjs 强制（声明即负责）。
   */
  capabilities?: ThemeCapabilitiesDeclaration;
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

/**
 * 路由 → PageDomain 判定（WEB-C1 ②；host 调度单源）。
 *
 * 顺序敏感：更具体的规则在前（首条命中即返回）。根前缀 `/` 兼底：首页与
 * 未细分的浏览类页（如 /history、/libraries 列表）均归 browse.home 粗粒度。
 * 未命中 → null（调用方回落 host 默认页面，如 /login /install）。
 */
export const PAGE_DOMAIN_ROUTES: readonly {
  domain: PageDomain;
  /** pathname 前缀（精确或前缀匹配） */
  prefix: string;
  /** true = 仅精确匹配（根形态）；缺省 = 前缀匹配 */
  exact?: boolean;
}[] = [
  { domain: 'browse.play', prefix: '/play/' },
  { domain: 'browse.item', prefix: '/item/' },
  { domain: 'browse.library', prefix: '/libraries/' },
  { domain: 'manage', prefix: '/manage' },
  { domain: 'settings', prefix: '/settings' },
  { domain: 'observability', prefix: '/observability' },
  // 根形态浏览类（粗粒度归 browse.home）：首页/历史/库列表；
  // 非域页（/login /install）不在此列 → null 回落。
  { domain: 'browse.home', prefix: '/', exact: true },
  { domain: 'browse.home', prefix: '/history' },
  { domain: 'browse.home', prefix: '/libraries' },
] as const;

/** 按 pathname 判定 PageDomain；未命中返回 null（回落 host 默认页面）。 */
export function resolvePageDomain(pathname: string): PageDomain | null {
  for (const rule of PAGE_DOMAIN_ROUTES) {
    if (rule.exact) {
      if (pathname === rule.prefix) {
        return rule.domain;
      }
      continue;
    }
    if (pathname === rule.prefix || pathname.startsWith(rule.prefix)) {
      return rule.domain;
    }
  }
  return null;
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

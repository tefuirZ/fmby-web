/**
 * L3 页面域皮肤调度（WEB-C1 ②：host 消费 manifest.skins）。
 *
 * 调度回路：
 *   useLocation → resolvePageDomain(pathname)
 *   → 主题入口 domainSkins[domain] 且 host 数据源已注册
 *   → 渲染主题组件（SkinProps：data/state/actions/realtime 全 host 注入）
 *   → 否则渲染 children（host 默认页面——功能永不缺失，静默回落）。
 *
 * 主题组件硬约束（ADR-001 §3）由契约类型 + CI dupes 门禁强制：
 * 只读 data + 回调、禁取数、状态全覆盖、移动端必备。
 *
 * 实现注：本文件用 React.createElement（非 JSX）——保持 .ts 形态使
 * node:test（strip-types，不支持 JSX）可直接渲染断言四态 DOM 输出。
 */

import { Fragment, createElement, useMemo, type ReactNode } from 'react';
import { useLocation, useParams } from 'react-router';
import {
  resolvePageDomain,
  type SkinProps,
} from '@fmby/v2-shared/theme';
import { useTheme } from '@/theme/themeContext';
import {
  DOMAIN_SKIN_DATA_REGISTRY,
  useDomainSkinData,
  type DomainSkinParamsProps,
} from './loaders';
import { useSkinRealtime } from './useSkinRealtime';

/** 按路由渲染域 skin；无 skin 时渲染 host 默认 children。 */
export function DomainSkinOutlet({ children }: { children: ReactNode }) {
  const location = useLocation();
  const params = useParams();
  const { entry } = useTheme();
  const domain = resolvePageDomain(location.pathname);
  const domainSkins = entry?.domainSkins;
  const Skin = domain && domainSkins ? domainSkins[domain] : undefined;
  const hasDataLoader =
    domain !== null && DOMAIN_SKIN_DATA_REGISTRY[domain] !== undefined;

  if (!Skin || !domain || !hasDataLoader) {
    // 静默回落：主题未声明该域 / host 无该域数据源 → host 默认页面。
    return children;
  }

  return createElement(RoutedDomainSkin, {
    domain,
    params,
    Skin: Skin as React.ComponentType<SkinProps>,
  });
}

function RoutedDomainSkin(props: {
  domain: string;
  params: Readonly<Record<string, string | undefined>>;
  Skin: React.ComponentType<SkinProps>;
}) {
  const { domain, params, Skin } = props;
  const registry = DOMAIN_SKIN_DATA_REGISTRY as unknown as Record<
    string,
    React.ComponentType<DomainSkinParamsProps & { children: ReactNode }> | undefined
  >;
  const Provider = registry[domain];
  const realtime = useSkinRealtime();

  const content = useMemo(() => {
    if (!Provider) {
      return null;
    }
    const ProviderComponent = Provider as React.ComponentType<
      DomainSkinParamsProps & { children?: ReactNode }
    >;
    return createElement(
      ProviderComponent,
      { params },
      createElement(SkinConsumer, { Skin, realtime }),
    );
    // Provider/domain 是注册表静态形态；realtime 变化需要重建 props。
  }, [domain, Provider, Skin, realtime, params]);

  return createElement(Fragment, null, content);
}

function SkinConsumer(props: {
  Skin: React.ComponentType<SkinProps>;
  realtime: ReturnType<typeof useSkinRealtime>;
}) {
  const { Skin, realtime } = props;
  const { data, state } = useDomainSkinData();
  // actions：WEB-B1 前主题侧动作面尚未开放（空表；键语义随首个 skin 落地冻结）。
  const actions: SkinProps['actions'] = {};
  return createElement(Skin, { data, state, actions, realtime });
}

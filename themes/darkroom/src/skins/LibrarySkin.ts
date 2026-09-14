/**
 * LibrarySkin —— darkroom 主题 `browse.library` 域皮肤（WEB-C2，L3 示范）。
 *
 * 硬约束（ADR-001 §3 / SkinProps 契约）：
 * - 只接收 SkinProps（data/state/actions/realtime 全部由 host 注入）；
 * - 禁取数：无 useQuery / httpClient / fetch / query keys
 *   （check-frontend-dupes 主题纯度扫描强制）；
 * - 状态全覆盖：loading/ready/empty/error/forbidden 五态都有 DOM 输出；
 * - 移动端：layout === 'mobile' 单列，desktop 双列（layoutForViewport hint）；
 * - 实时显示：订阅 host realtime（当前轮询兜底，接口不假设推送形态）；
 * - 布局与 host 默认页不同：host = 顶部 hero + 虚拟化网格 + 侧筛选；
 *   本 skin = 居中玻璃面板 + 顶部类型分组条 + 双列卡墙 + 底部悬浮操作条。
 *
 * 实现形态：createElement（非 JSX）——node:test（strip-types）可直接
 * 渲染断言，与构建链（Vite esbuild）兼容。
 */

import { createElement, useEffect, useState } from 'react';
import type { SkinProps } from '@fmby/v2-shared/theme';

/** 卡片视图数据的最小形状（viewmodel 已整形；此处仅类型视图，不导入 DTO 面）。 */
interface SkinLibraryCard {
  id: string;
  title: string;
  kind?: string;
  year?: number;
}

interface SkinLibraryData {
  library?: { name?: string; itemCount?: number };
  items?: SkinLibraryCard[];
  totalItems?: number;
}

function asLibraryData(data: unknown): SkinLibraryData | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  return data as SkinLibraryData;
}

/** 类型分组条：按 kind 聚合计数（纯视图派生，非取数）。 */
function groupByKind(items: SkinLibraryCard[]): { kind: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const kind = item.kind ?? 'other';
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((left, right) => right.count - left.count);
}

/** 状态徽标（主题自绘——L3 主题自持表现层，不依赖 host 组件实现）。 */
function SkinBadge(props: { label: string; tone: 'live' | 'poll' | 'neutral' }) {
  return createElement(
    'span',
    { 'data-darkroom': 'badge', 'data-tone': props.tone },
    props.label,
  );
}

/** 底部悬浮操作条（实时状态 + 重试/加载更多——与 host 布局不同的组成件）。 */
function FloatingActionBar(props: {
  isLive: boolean;
  lastRefreshedAt: number | null;
  canLoadMore: boolean;
  onLoadMore: () => void;
}) {
  const { isLive, lastRefreshedAt, canLoadMore, onLoadMore } = props;
  const refreshed = lastRefreshedAt
    ? new Date(lastRefreshedAt).toLocaleTimeString()
    : '—';
  return createElement(
    'div',
    { 'data-darkroom': 'floating-bar' },
    createElement(SkinBadge, {
      label: isLive ? '实时' : `轮询 ${refreshed}`,
      tone: isLive ? 'live' : 'poll',
    }),
    canLoadMore
      ? createElement(
          'button',
          { 'data-darkroom': 'ghost-button', onClick: onLoadMore, type: 'button' },
          '加载更多',
        )
      : null,
  );
}

/** 全宽反馈面（四态共用骨架；主题自绘，形态对齐暗房细线美学）。 */
function SkinFeedback(props: { state: string; title: string; description: string; action?: unknown }) {
  return createElement(
    'div',
    { 'data-darkroom': 'feedback', 'data-state': props.state },
    createElement('h2', null, props.title),
    createElement('p', null, props.description),
    props.action as React.ReactNode | null ?? null,
  );
}

export function LibrarySkin(props: SkinProps) {
  const { data, state, actions, realtime } = props;
  // 实时显示必须有（WEB-C1 ④）：订阅 host 实时源（当前轮询兜底）。
  const [, forceTick] = useState(0);
  useEffect(() => realtime.subscribe(() => forceTick((tick: number) => tick + 1)), [realtime]);

  // —— loading：骨架（非转圈占位；暗房形态 = 细线面板呼吸）——
  if (state === 'loading') {
    return createElement(
      'section',
      { 'data-darkroom': 'library-skin', 'data-state': 'loading' },
      createElement('div', { 'data-darkroom': 'skeleton-line', style: { width: '40%' } }),
      createElement('div', { 'data-darkroom': 'skeleton-line', style: { width: '90%' } }),
      createElement('div', { 'data-darkroom': 'skeleton-line', style: { width: '90%' } }),
    );
  }

  // —— error / forbidden：重试面（五态全覆盖；forbidden 无重试动作）——
  if (state === 'error' || state === 'forbidden') {
    return createElement(
      'section',
      { 'data-darkroom': 'library-skin', 'data-state': state },
      createElement(SkinFeedback, {
        state,
        title: state === 'forbidden' ? '没有访问该媒体库的权限' : '媒体库内容加载失败',
        description: '暗房皮肤：内容未能呈现。',
        action:
          state === 'error'
            ? createElement(
                'button',
                {
                  'data-darkroom': 'primary-button',
                  onClick: actions.refresh,
                  type: 'button',
                },
                '重试',
              )
            : null,
      }),
    );
  }

  const libraryData = asLibraryData(data);
  if (state === 'empty' || !libraryData) {
    return createElement(
      'section',
      { 'data-darkroom': 'library-skin', 'data-state': 'empty' },
      createElement(SkinFeedback, {
        state: 'empty',
        title: '这个库还没有内容',
        description: '回到管理面添加媒体来源后，内容会出现在这里。',
      }),
    );
  }

  // —— ready：与 host 默认页不同的重排 ——
  const items = libraryData.items ?? [];
  const groups = groupByKind(items);
  const canLoadMore = typeof actions.loadMore === 'function';

  return createElement(
    'section',
    { 'data-darkroom': 'library-skin', 'data-state': 'ready' },
    // 结构差异 1：居中面板承载库头（host 默认是全宽 hero）。
    createElement(
      'div',
      { 'data-darkroom': 'library-head-panel' },
      createElement(
        'header',
        { 'data-darkroom': 'library-head' },
        createElement('h1', null, libraryData.library?.name ?? '媒体库'),
        createElement(SkinBadge, {
          label: `${libraryData.totalItems ?? items.length} 项`,
          tone: 'neutral',
        }),
      ),
    ),
    // 结构差异 2：类型分组条（host 默认是侧栏下拉筛选）。
    createElement(
      'nav',
      { 'data-darkroom': 'kind-groups' },
      groups.map((group) =>
        createElement(
          'span',
          { key: group.kind, 'data-darkroom': 'kind-group' },
          `${group.kind} · ${group.count}`,
        ),
      ),
    ),
    // 结构差异 3：卡墙（mobile 单列 / desktop 双列——layoutForViewport hint）。
    createElement(
      'div',
      { 'data-darkroom': 'card-wall' },
      items.map((item) =>
        createElement(
          'article',
          { key: item.id, 'data-darkroom': 'card' },
          createElement('strong', null, item.title),
          createElement(
            'span',
            { 'data-darkroom': 'card-meta' },
            [item.year, item.kind].filter(Boolean).join(' · '),
          ),
        ),
      ),
    ),
    // 结构差异 4：底部悬浮操作条（实时态 + 加载更多）。
    createElement(FloatingActionBar, {
      isLive: realtime.isLive,
      lastRefreshedAt: realtime.lastRefreshedAt,
      canLoadMore,
      onLoadMore: actions.loadMore,
    }),
  );
}

export default LibrarySkin;

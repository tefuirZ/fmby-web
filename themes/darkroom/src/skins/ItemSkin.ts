/**
 * ItemSkin —— darkroom 主题 `browse.item` 域皮肤（WEB-C3，L3 第二域示范）。
 *
 * 硬约束（ADR-001 §3 / SkinProps 契约）与 LibrarySkin（WEB-C2）同模式：
 * - 只接收 SkinProps（data/state/actions/realtime 全 host 注入），禁取数；
 * - 状态全覆盖：loading/ready/empty/error/forbidden 五态 DOM 输出；
 * - 移动端：CSS 断点单列（media <768px），桌面横向双栏；
 * - 实时显示：挂载即 realtime.subscribe（host 轮询兜底）。
 *
 * 布局与 host 默认详情页**实质不同**：
 *   host = 纵向堆叠（hero 顶部 → 元数据 → 技术区 → 人物区 → 关联区）；
 *   skin = **横向海报墙（左视觉列）+ 右侧元数据栏 + 底部横滑剧集/关联带**。
 *
 * 实现形态：createElement（非 JSX）——node:test（strip-types）可直接渲染断言。
 */

import { createElement, useEffect, useState } from 'react';
import type { SkinProps } from '@fmby/v2-shared/theme';

/** 条目视图数据的最小形状（viewmodel 已整形；仅类型视图，不导入 DTO 面）。 */
interface SkinItem {
  title?: string;
  kindLabel?: string;
  year?: number;
  description?: string;
  tagline?: string;
  ratingLabel?: string;
  runtimeLabel?: string;
  meta?: string[];
  genres?: string[];
  actors?: { name: string; role?: string }[];
  sourceStatusLabel?: string;
  progress?: { progressPercent?: number };
}

interface SkinItemData {
  item?: SkinItem;
  episodeOptions?: { id: string; title: string }[];
}

function asItemData(data: unknown): SkinItemData | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  return data as SkinItemData;
}

/** 全宽反馈面（五态共用骨架；主题自绘，形态对齐暗房细线美学）。 */
function SkinFeedback(props: {
  state: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return createElement(
    'div',
    { 'data-darkroom': 'item-feedback', 'data-state': props.state },
    createElement('h2', null, props.title),
    createElement('p', null, props.description),
    props.action ?? null,
  );
}

export function ItemSkin(props: SkinProps) {
  const { data, state, actions, realtime } = props;
  // 实时显示必须有（WEB-C1 ④）：订阅 host 实时源（当前轮询兜底）。
  const [, forceTick] = useState(0);
  useEffect(
    () => realtime.subscribe(() => forceTick((tick: number) => tick + 1)),
    [realtime],
  );

  if (state === 'loading') {
    return createElement(
      'section',
      { 'data-darkroom': 'item-skin', 'data-state': 'loading' },
      createElement('div', { 'data-darkroom': 'skeleton-poster' }),
      createElement('div', { 'data-darkroom': 'skeleton-line', style: { width: '55%' } }),
      createElement('div', { 'data-darkroom': 'skeleton-line', style: { width: '90%' } }),
    );
  }

  if (state === 'error' || state === 'forbidden') {
    return createElement(
      'section',
      { 'data-darkroom': 'item-skin', 'data-state': state },
      createElement(SkinFeedback, {
        state,
        title: state === 'forbidden' ? '没有查看该条目的权限' : '条目详情加载失败',
        description: '暗房皮肤：内容未能呈现。',
        action:
          state === 'error'
            ? createElement(
                'button',
                {
                  'data-darkroom': 'primary-button',
                  onClick: actions.retry,
                  type: 'button',
                },
                '重试',
              )
            : null,
      }),
    );
  }

  const itemData = asItemData(data);
  const item = itemData?.item;
  if (state === 'empty' || !item) {
    return createElement(
      'section',
      { 'data-darkroom': 'item-skin', 'data-state': 'empty' },
      createElement(SkinFeedback, {
        state: 'empty',
        title: '条目不存在或已被移除',
        description: '返回媒体库查看其它内容。',
      }),
    );
  }

  const episodes = itemData?.episodeOptions ?? [];
  // BUG-SKIN-NAV-01：剧集带卡片导航由 host 注入面驱动（同 LibrarySkin 模式）。
  const openItem = typeof actions.openItem === 'function' ? actions.openItem : undefined;
  const itemHref = typeof actions.itemHref === 'function' ? actions.itemHref : undefined;
  const metaLine = [
    item.year,
    item.kindLabel,
    item.runtimeLabel,
    item.ratingLabel,
    ...(item.meta ?? []),
  ]
    .filter(Boolean)
    .join(' · ');

  return createElement(
    'section',
    { 'data-darkroom': 'item-skin', 'data-state': 'ready' },
    // 结构差异 1：横向双栏（host 默认是纵向堆叠）——左海报墙 + 右元数据栏。
    createElement(
      'div',
      { 'data-darkroom': 'item-columns' },
      createElement(
        'div',
        { 'data-darkroom': 'poster-wall' },
        // 纯装饰性占位（无图片/无内容，渐变底）；条目标题已由 meta-column 的
        // <h1> 宣布。无 role 的 div 禁带 aria-label（axe aria-prohibited-attr），
        // 故不标注——装饰元素对 AT 应不可见。
        createElement('div', { 'data-darkroom': 'poster-frame', 'aria-hidden': 'true' }),
      ),
      createElement(
        'aside',
        { 'data-darkroom': 'meta-column' },
        item.sourceStatusLabel
          ? createElement(
              'span',
              { 'data-darkroom': 'source-badge' },
              item.sourceStatusLabel,
            )
          : null,
        createElement('h1', null, item.title),
        item.tagline
          ? createElement('p', { 'data-darkroom': 'tagline' }, item.tagline)
          : null,
        metaLine ? createElement('p', { 'data-darkroom': 'meta-line' }, metaLine) : null,
        item.progress && item.progress.progressPercent
          ? createElement(
              'div',
              { 'data-darkroom': 'progress-track' },
              createElement('div', {
                'data-darkroom': 'progress-fill',
                style: { width: `${Math.min(100, item.progress.progressPercent)}%` },
              }),
            )
          : null,
        item.description
          ? createElement('p', { 'data-darkroom': 'description' }, item.description)
          : null,
        (item.genres ?? []).length
          ? createElement(
              'p',
              { 'data-darkroom': 'genres' },
              item.genres!.map((genre, index) =>
                createElement('span', { key: `${genre}-${index}` }, genre),
              ),
            )
          : null,
        (item.actors ?? []).length
          ? createElement(
              'p',
              { 'data-darkroom': 'actors' },
              item
                .actors!.slice(0, 6)
                .map((actor) => actor.name)
                .join(' / '),
            )
          : null,
      ),
    ),
    // 结构差异 2：剧集/关联横滑带（host 默认是整段区块纵向排列）。
    // BUG-SKIN-NAV-01：剧集卡片接入 host 注入的导航面（主题不自建路由
    // 字面量）；无注入时退化为静态展示（向后兼容）。
    episodes.length
      ? createElement(
          'div',
          { 'data-darkroom': 'hstrip' },
          createElement('h3', null, '剧集'),
          createElement(
            'div',
            { 'data-darkroom': 'hstrip-track' },
            episodes.map((episode) => {
              const href = itemHref?.(episode.id);
              return createElement(
                'article',
                { key: episode.id, 'data-darkroom': 'hstrip-card' },
                openItem && href
                  ? createElement(
                      'a',
                      {
                        'data-darkroom': 'hstrip-open',
                        href,
                        onClick: (event: { preventDefault?: () => void }) => {
                          event.preventDefault?.();
                          openItem(episode.id);
                        },
                      },
                      createElement('strong', null, episode.title),
                    )
                  : openItem
                    ? createElement(
                        'button',
                        {
                          'data-darkroom': 'hstrip-open',
                          onClick: () => openItem(episode.id),
                          type: 'button',
                        },
                        createElement('strong', null, episode.title),
                      )
                    : createElement('strong', null, episode.title),
              );
            }),
          ),
        )
      : null,
  );
}

export default ItemSkin;

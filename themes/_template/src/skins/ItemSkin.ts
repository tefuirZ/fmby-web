/**
 * ItemSkin —— 模板主题（`_template`）的 `browse.item` 域皮肤。
 *
 * 这是**第三方主题样板**里那个「真实可用」的 L3 皮肤：不是空骨架，而是把
 * host 注入的条目数据渲染成一套与 host 默认页、与 darkroom 都**不同**的版式
 * ——「编辑档案（dossier）」：顶部导语 → 事实带 → 双栏（叙述 + 事实栏）→
 * 剧集横滑带。复制本文件即可起步你自己的域皮肤。
 *
 * ── L3 硬约束（ADR-001 §3；违反即 `pnpm verify` 红）───────────────────
 * 1. **只接收 `SkinProps`**：`{ data, state, actions, realtime }` 全部由 host
 *    注入。主题不得自行取数。
 * 2. **禁取数 / 禁路由**：不得 `useQuery` / 调 api client / import contracts
 *    裸 DTO / 自建 query key / 拼接路由字面量（`check-frontend-dupes.mjs` 扫描
 *    强制）。导航只经 host 注入的 `actions.openItem(id)` / `actions.itemHref(id)`。
 * 3. **五态全覆盖**：`loading / ready / empty / error / forbidden` 都要有 DOM
 *    输出（缺态 = 功能黑屏，门禁与评审都会抓）。
 * 4. **移动端必须有**：响应式布局由同目录 `item.css` 的媒体查询承担
 *    （`<768px` 单列，断点与 shared 口径一致）。
 * 5. **实时显示**：挂载即 `realtime.subscribe(...)`（host 轮询兜底）；主题不得
 *    自建定时器 / 连接。
 *
 * ── 实现形态 ─────────────────────────────────────────────────────────
 * `createElement`（非 JSX）：与仓库既有主题一致，node:test（Node 原生
 * strip-types，不支持 .tsx）可直接 `renderToStaticMarkup` 断言五态；Vite
 * esbuild 构建同样吃这一形态。
 *
 * ── 数据形状 ─────────────────────────────────────────────────────────
 * host 的 `useItemDetail` viewmodel 算好后经 `data` 注入，形状为
 * `ItemDetailViewData`：`{ item, episodeOptions, ... }`。此处只声明**类型视图**
 * （不 import DTO 面）——主题对数据形状的依赖保持最小、只读。
 */

import { createElement, useEffect, useState } from 'react';
import type { SkinProps } from '@fmby/v2-shared/theme';

/** 条目视图数据的最小形状（viewmodel 已整形；仅类型视图，不导入 DTO 面）。 */
interface SkinItem {
  id?: string;
  title?: string;
  kindLabel?: string;
  year?: number;
  runtimeLabel?: string;
  ratingLabel?: string;
  tagline?: string;
  description?: string;
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

/** 事实条单项（导语下方的一行「关键事实」）。 */
function Fact(props: { label: string; value: string }) {
  return createElement(
    'span',
    { 'data-template': 'fact' },
    createElement('span', { 'data-template': 'fact-label' }, props.label),
    createElement('span', { 'data-template': 'fact-value' }, props.value),
  );
}

/** 五态共用的反馈面（模板自绘的诚实状态面）。 */
function Feedback(props: { state: string; title: string; description: string; action?: React.ReactNode }) {
  return createElement(
    'section',
    { 'data-template': 'item-dossier', 'data-state': props.state },
    createElement(
      'div',
      { 'data-template': 'dossier-feedback' },
      createElement('h1', null, props.title),
      createElement('p', null, props.description),
      props.action ?? null,
    ),
  );
}

export function ItemSkin(props: SkinProps) {
  const { data, state, actions, realtime } = props;

  // 硬约束 5：挂载即订阅实时源（host 轮询兜底；推送面接入后主题零改动）。
  const [, forceTick] = useState(0);
  useEffect(
    () => realtime.subscribe(() => forceTick((tick: number) => tick + 1)),
    [realtime],
  );

  // ── 状态 1/5：loading（骨架占位；不伪造数据）──────────────────────────
  if (state === 'loading') {
    return createElement(
      'section',
      { 'data-template': 'item-dossier', 'data-state': 'loading' },
      createElement('div', { 'data-template': 'skeleton-kicker' }),
      createElement('div', { 'data-template': 'skeleton-title' }),
      createElement('div', { 'data-template': 'skeleton-line', style: { width: '92%' } }),
      createElement('div', { 'data-template': 'skeleton-line', style: { width: '78%' } }),
    );
  }

  // ── 状态 2/5：error / 3/5：forbidden ──────────────────────────────────
  if (state === 'error' || state === 'forbidden') {
    const forbidden = state === 'forbidden';
    return createElement(Feedback, {
      state,
      title: forbidden ? '你没有查看该条目的权限' : '条目详情加载失败',
      description: forbidden
        ? '权限由 host 判定；模板皮肤不猜测、不重试。'
        : '模板皮肤：内容没能取回。可重试，或返回媒体库。',
      action: forbidden
        ? null
        : createElement(
            'button',
            {
              'data-template': 'primary-button',
              type: 'button',
              onClick: actions.retry,
            },
            '重试',
          ),
    });
  }

  const itemData = asItemData(data);
  const item = itemData?.item;

  // ── 状态 4/5：empty（条目缺失）────────────────────────────────────────
  if (state === 'empty' || !item) {
    return createElement(Feedback, {
      state: 'empty',
      title: '条目不存在或已被移除',
      description: '返回媒体库看看其它内容。',
    });
  }

  // ── 状态 5/5：ready ──────────────────────────────────────────────────
  const episodes = itemData?.episodeOptions ?? [];
  const facts: React.ReactNode[] = [];
  if (item.year) facts.push(createElement(Fact, { key: 'year', label: '年份', value: String(item.year) }));
  if (item.kindLabel) facts.push(createElement(Fact, { key: 'kind', label: '类型', value: item.kindLabel }));
  if (item.runtimeLabel) facts.push(createElement(Fact, { key: 'runtime', label: '时长', value: item.runtimeLabel }));
  if (item.ratingLabel) facts.push(createElement(Fact, { key: 'rating', label: '评分', value: item.ratingLabel }));
  if (item.sourceStatusLabel) {
    facts.push(createElement(Fact, { key: 'source', label: '来源', value: item.sourceStatusLabel }));
  }

  // 导航面由 host 注入（主题禁自建路由）；缺失时诚实退化为纯文本。
  const openItem = typeof actions.openItem === 'function' ? actions.openItem : undefined;
  const itemHref = typeof actions.itemHref === 'function' ? actions.itemHref : undefined;

  return createElement(
    'section',
    { 'data-template': 'item-dossier', 'data-state': 'ready' },
    // ① 导语头：主题自有的「kicker」行 + 大标题 + tagline（host 默认页无此形态）。
    createElement(
      'header',
      { 'data-template': 'dossier-head' },
      createElement('p', { 'data-template': 'dossier-kicker' }, '模板主题 · 编辑档案'),
      createElement('h1', null, item.title),
      item.tagline ? createElement('p', { 'data-template': 'dossier-tagline' }, item.tagline) : null,
      facts.length > 0 ? createElement('div', { 'data-template': 'fact-ribbon' }, facts) : null,
    ),
    // ② 双栏主体：左「叙述」（简介 / 类型 / 进度），右「事实栏」（meta / 演职员）。
    createElement(
      'div',
      { 'data-template': 'dossier-grid' },
      createElement(
        'article',
        { 'data-template': 'dossier-narrative' },
        item.description
          ? createElement('p', { 'data-template': 'description' }, item.description)
          : createElement('p', { 'data-template': 'description' }, '暂无简介。'),
        (item.genres ?? []).length > 0
          ? createElement(
              'ul',
              { 'data-template': 'genre-chips' },
              item.genres!.map((genre, index) =>
                createElement('li', { key: `${genre}-${index}`, 'data-template': 'chip' }, genre),
              ),
            )
          : null,
        item.progress && typeof item.progress.progressPercent === 'number'
          ? createElement(
              'div',
              { 'data-template': 'progress', 'data-percent': String(item.progress.progressPercent) },
              createElement('div', {
                'data-template': 'progress-fill',
                style: { width: `${Math.max(0, Math.min(100, item.progress.progressPercent))}%` },
              }),
            )
          : null,
      ),
      createElement(
        'aside',
        { 'data-template': 'dossier-facts' },
        (item.meta ?? []).length > 0
          ? createElement(
              'div',
              { 'data-template': 'fact-block' },
              createElement('h2', { 'data-template': 'block-title' }, '规格'),
              createElement(
                'ul',
                { 'data-template': 'fact-list' },
                item.meta!.map((entry, index) =>
                  createElement('li', { key: `${entry}-${index}` }, entry),
                ),
              ),
            )
          : null,
        (item.actors ?? []).length > 0
          ? createElement(
              'div',
              { 'data-template': 'fact-block' },
              createElement('h2', { 'data-template': 'block-title' }, '主演'),
              createElement(
                'ul',
                { 'data-template': 'fact-list' },
                item.actors!.slice(0, 6).map((actor, index) =>
                  createElement('li', { key: `${actor.name}-${index}` }, actor.name),
                ),
              ),
            )
          : null,
      ),
    ),
    // ③ 剧集横滑带：卡片经 host 注入的导航面渲染**真实 `<a href>`**
    //    （可访问性 + 中键/右键可用）；点击 preventDefault 后走 SPA 导航。
    //    无注入时退化为静态标题（不伪造链接，向后兼容旧 host）。
    episodes.length > 0
      ? createElement(
          'section',
          { 'data-template': 'episode-rail' },
          createElement('h2', { 'data-template': 'rail-title' }, '剧集'),
          createElement(
            'ul',
            { 'data-template': 'rail-track' },
            episodes.map((episode) => {
              const href = itemHref?.(episode.id);
              return createElement(
                'li',
                { key: episode.id, 'data-template': 'rail-card' },
                openItem && href
                  ? createElement(
                      'a',
                      {
                        'data-template': 'rail-open',
                        href,
                        onClick: (event: { preventDefault?: () => void }) => {
                          event.preventDefault?.();
                          openItem(episode.id);
                        },
                      },
                      episode.title,
                    )
                  : createElement('span', { 'data-template': 'rail-open-static' }, episode.title),
              );
            }),
          ),
        )
      : null,
  );
}

export default ItemSkin;

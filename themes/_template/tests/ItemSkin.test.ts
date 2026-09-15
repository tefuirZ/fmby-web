// 模板主题 ItemSkin 单测：五态 + dossier 版式 + 导航注入 + 实时契约。
// 跑法：node --import ../../shared/tests/register-resolver.mjs --test tests/*.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ItemSkin } from '../src/skins/ItemSkin';
import type { SkinProps } from '@fmby/v2-shared/theme';

const noopRealtime = {
  lastRefreshedAt: null,
  isLive: false,
  subscribe: () => () => {},
};

function renderSkin(overrides: Partial<SkinProps> = {}): string {
  const props: SkinProps = {
    data: null,
    state: 'loading',
    actions: {},
    realtime: noopRealtime,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(ItemSkin, props));
}

const READY_DATA = {
  item: {
    title: '流浪地球2',
    kindLabel: '电影',
    year: 2023,
    runtimeLabel: '173 分钟',
    ratingLabel: '8.3',
    tagline: '人类一起走',
    description: '太阳危机将至，人类开启流浪地球计划。',
    meta: ['4K', 'HDR'],
    genres: ['科幻', '灾难'],
    actors: [{ name: '吴京' }, { name: '刘德华' }],
    sourceStatusLabel: '已入库',
    progress: { progressPercent: 42 },
  },
  episodeOptions: [],
};

test('五态全覆盖：每个 state 都有 DOM 输出且标记 data-state', () => {
  for (const state of ['loading', 'empty', 'error', 'forbidden', 'ready'] as const) {
    const html = renderSkin({ state, data: state === 'ready' ? READY_DATA : null });
    assert.match(html, new RegExp(`data-state="${state}"`), `state=${state} 缺 DOM 输出`);
  }
});

test('loading 态：骨架占位，不伪造数据', () => {
  const html = renderSkin({ state: 'loading' });
  assert.match(html, /data-state="loading"/);
  assert.match(html, /skeleton-title/);
});

test('empty 态：条目缺失引导', () => {
  const html = renderSkin({ state: 'empty' });
  assert.match(html, /条目不存在或已被移除/);
});

test('error 态：给出重试；forbidden 态：不重试（权限不因重试改变）', () => {
  const errorHtml = renderSkin({ state: 'error', actions: { retry: () => {} } });
  assert.match(errorHtml, /data-state="error"/);
  assert.match(errorHtml, /data-template="primary-button"/, 'error 态给出重试按钮');

  const forbiddenHtml = renderSkin({ state: 'forbidden' });
  assert.match(forbiddenHtml, /data-state="forbidden"/);
  assert.match(forbiddenHtml, /没有查看该条目的权限/);
  // 断言的是「无重试按钮」（而非文本不含“重试”二字——文案里本就写「不重试」）。
  assert.doesNotMatch(forbiddenHtml, /data-template="primary-button"/, 'forbidden 态不给重试按钮');
});

test('ready 态：dossier 版式（导语头 + 事实带 + 双栏）——与 host / darkroom 不同', () => {
  const html = renderSkin({ state: 'ready', data: READY_DATA });
  assert.match(html, /data-template="dossier-head"/, '导语头');
  assert.match(html, /data-template="dossier-kicker"/, '主题自有 kicker 行');
  assert.match(html, /data-template="fact-ribbon"/, '事实带');
  assert.match(html, /data-template="dossier-grid"/, '双栏主体');
  assert.match(html, /data-template="dossier-narrative"/, '左叙述栏');
  assert.match(html, /data-template="dossier-facts"/, '右事实栏');
  assert.match(html, /流浪地球2/);
  assert.match(html, /科幻/, 'genres 渲染');
  assert.match(html, /吴京/, 'actors 渲染');
  assert.match(html, /已入库/, '来源状态');
  assert.match(html, /data-percent="42"/, '观看进度');
});

test('响应式：布局差异由 CSS 媒体查询承担（无内联 grid-template-columns）', () => {
  const html = renderSkin({ state: 'ready', data: READY_DATA });
  assert.doesNotMatch(html, /style="[^"]*grid-template-columns/);
});

test('剧集导航：注入 openItem/itemHref → 剧集卡为真实 <a href>', () => {
  const html = renderSkin({
    state: 'ready',
    data: {
      ...READY_DATA,
      episodeOptions: [
        { id: 'e1', title: '第一集' },
        { id: 'e2', title: '第二集' },
      ],
    },
    actions: { openItem: () => {}, itemHref: (id: string) => `/item/${id}` },
  });
  assert.match(html, /<a[^>]*data-template="rail-open"[^>]*href="\/item\/e1"/);
  assert.match(html, /<a[^>]*href="\/item\/e2"/);
  assert.equal(
    (html.match(/<a[^>]*data-template="rail-open"/g) ?? []).length,
    2,
    '两剧集 → 两锚点',
  );
});

test('剧集导航回退：无注入（旧 host）→ 静态标题，不伪造链接', () => {
  const html = renderSkin({
    state: 'ready',
    data: { ...READY_DATA, episodeOptions: [{ id: 'e1', title: '第一集' }] },
  });
  assert.match(html, /第一集/);
  assert.doesNotMatch(html, /data-template="rail-open"/);
  assert.match(html, /data-template="rail-open-static"/);
});

test('实时契约：skin 接受 realtime 且 SSR 首帧不订阅（client 挂载面建立）', () => {
  let subscribeCalled = false;
  renderToStaticMarkup(
    createElement(ItemSkin, {
      data: READY_DATA,
      state: 'ready',
      actions: {},
      realtime: {
        lastRefreshedAt: 1700000000000,
        isLive: false,
        subscribe: () => {
          subscribeCalled = true;
          return () => {};
        },
      },
    }),
  );
  assert.equal(subscribeCalled, false, 'SSR 首帧不订阅');
});

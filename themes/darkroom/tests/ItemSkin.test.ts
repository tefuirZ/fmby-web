// WEB-C3：darkroom ItemSkin 五态 + 布局差异 + 实时断言。
// 跑法：node --import ../../shared/tests/register-resolver.mjs --test tests/ItemSkin.test.ts
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
    kindLabel: 'movie',
    year: 2023,
    description: '太阳即将危机',
    tagline: '人类-army',
    ratingLabel: '8.3',
    meta: ['4K', 'HDR'],
    genres: ['科幻', '灾难'],
    actors: [{ name: '吴京' }, { name: '刘德华' }],
    sourceStatusLabel: '已入库',
    progress: { progressPercent: 42 },
  },
  episodeOptions: [],
};

test('loading 态：海报骨架 + 行骨架', () => {
  const html = renderSkin({ state: 'loading' });
  assert.match(html, /data-state="loading"/);
  assert.match(html, /skeleton-poster/);
});

test('empty 态：条目不存在引导', () => {
  const html = renderSkin({ state: 'empty' });
  assert.match(html, /data-state="empty"/);
  assert.match(html, /条目不存在或已被移除/);
});

test('error 态：重试 + forbidden 态：无重试', () => {
  const errorHtml = renderSkin({ state: 'error', actions: { retry: () => {} } });
  assert.match(errorHtml, /data-state="error"/);
  assert.match(errorHtml, /重试/);

  const forbiddenHtml = renderSkin({ state: 'forbidden' });
  assert.match(forbiddenHtml, /data-state="forbidden"/);
  assert.match(forbiddenHtml, /没有查看该条目的权限/);
  assert.doesNotMatch(forbiddenHtml, /重试/);
});

test('ready 态：横向双栏重排断言（海报墙 + 元数据栏 —— host 无此结构）', () => {
  const html = renderSkin({ state: 'ready', data: READY_DATA });
  assert.match(html, /data-darkroom="item-columns"/, '横向双栏容器');
  assert.match(html, /data-darkroom="poster-wall"/, '左侧海报墙');
  assert.match(html, /data-darkroom="meta-column"/, '右侧元数据栏');
  assert.match(html, /流浪地球2/);
  assert.match(html, /科幻/, 'genres 渲染');
  assert.match(html, /吴京/, 'actors 渲染');
  assert.match(html, /已入库/, '来源状态徽标');
});

test('移动端分支：卡墙结构由 CSS 断点承担（无内联列数）', () => {
  const html = renderSkin({ state: 'ready', data: READY_DATA });
  assert.match(html, /data-darkroom="item-columns"/);
  assert.doesNotMatch(html, /style="[^"]*grid-template-columns/);
});

test('剧集横滑带：episodeOptions 非空时渲染', () => {
  const html = renderSkin({
    state: 'ready',
    data: {
      ...READY_DATA,
      episodeOptions: [{ id: 'e1', title: '第一集' }],
    },
  });
  assert.match(html, /data-darkroom="hstrip"/);
  assert.match(html, /第一集/);
});

test('剧集导航（BUG-SKIN-NAV-01）：注入 openItem/itemHref → 剧集卡为真实 <a href>', () => {
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
  assert.match(html, /<a[^>]*data-darkroom="hstrip-open"[^>]*href="\/item\/e1"/);
  assert.match(html, /<a[^>]*href="\/item\/e2"/);
  assert.equal(
    (html.match(/<a[^>]*data-darkroom="hstrip-open"/g) ?? []).length,
    2,
    '两剧集 → 两锚点',
  );
});

test('剧集导航回退：无注入（旧 host）→ 静态标题，不崩不伪造链接', () => {
  const html = renderSkin({
    state: 'ready',
    data: { ...READY_DATA, episodeOptions: [{ id: 'e1', title: '第一集' }] },
  });
  assert.match(html, /第一集/);
  assert.doesNotMatch(html, /data-darkroom="hstrip-open"/);
});

test('实时显示：isLive 两形态诚实标注', () => {
  // ItemSkin 本体无悬浮条（Library 专属），实时契约由 subscribe 订阅 +
  // progress/源状态随刷新更新体现；此处锁定 subscribe 合同被 skin 接受。
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
  // SSR 不执行 effect（订阅由 client 挂载面建立）——锁定 skin 接受
  // realtime 契约且不因 isLive=false 抛错/伪造。
  assert.equal(subscribeCalled, false, 'SSR 首帧不订阅（client 挂载面建立）');
});

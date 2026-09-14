// WEB-C2：darkroom LibrarySkin 四态 + 布局分支 + 实时订阅断言。
// 跑法：node --import ../../shared/tests/register-resolver.mjs --test tests/LibrarySkin.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LibrarySkin } from '../src/skins/LibrarySkin';
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
  return renderToStaticMarkup(createElement(LibrarySkin, props));
}

const READY_DATA = {
  library: { name: '电影库', itemCount: 2 },
  items: [
    { id: 'i1', title: '流浪地球2', kind: 'movie', year: 2023 },
    { id: 'i2', title: '三体', kind: 'series', year: null },
  ],
  totalItems: 2,
};

test('loading 态：骨架 DOM（非转圈假占位）', () => {
  const html = renderSkin({ state: 'loading' });
  assert.match(html, /data-state="loading"/);
  assert.match(html, /skeleton-line/);
});

test('empty 态：引导建库文案', () => {
  const html = renderSkin({ state: 'empty' });
  assert.match(html, /data-state="empty"/);
  assert.match(html, /还没有内容/);
});

test('error 态：重试动作 + forbidden 态：无重试动作', () => {
  const errorHtml = renderSkin({ state: 'error', actions: { refresh: () => {} } });
  assert.match(errorHtml, /data-state="error"/);
  assert.match(errorHtml, /重试/);

  const forbiddenHtml = renderSkin({ state: 'forbidden' });
  assert.match(forbiddenHtml, /data-state="forbidden"/);
  assert.match(forbiddenHtml, /没有访问该媒体库的权限/);
  assert.doesNotMatch(forbiddenHtml, /重试/);
});

test('ready 态：重排布局断言（玻璃面板库头 + 类型分组条 + 卡墙）', () => {
  const html = renderSkin({ state: 'ready', data: READY_DATA });
  assert.match(html, /data-darkroom="library-head-panel"/, '居中玻璃库头（host 无此结构）');
  assert.match(html, /data-darkroom="kind-groups"/, '类型分组条（host 用侧栏筛选）');
  assert.match(html, /data-darkroom="card-wall"/, '卡墙');
  assert.match(html, /电影库/);
  assert.match(html, /movie · 1/, 'kind 聚合计数');
  assert.match(html, /流浪地球2/);
});

test('移动端分支：layout hint 由主题消费（卡墙容器样式钩子恒在，窄屏单列由 CSS 承担）', () => {
  // viewmodel layout hint 不会直接传给 skin（SkinProps 契约只有
  // data/state/actions/realtime）——主题的移动端分支 = CSS 媒体查询 +
  // 单列卡墙结构（data-darkroom="card-wall" 容器是单列/双列的唯一挂点）。
  // 此处锁定：卡墙容器存在且不含内联列数（列数交给 CSS 断点，可被
  // layoutForViewport 未来扩展替换）。
  const html = renderSkin({ state: 'ready', data: READY_DATA });
  assert.match(html, /data-darkroom="card-wall"/);
  assert.doesNotMatch(html, /style="[^"]*columns/);
});

test('实时显示：isLive=false 诚实标注轮询兜底（订阅契约见 useSkinRealtime）', () => {
  // SSR（renderToStaticMarkup）不执行 effect：订阅建立由 client 挂载面覆盖
  //（LibrarySkin 挂载即 realtime.subscribe，卸载即清理——effect 返回值）。
  // 此处锁定 wire 层契约：isLive=false → 界面标注「轮询」（不伪造实时），
  // lastRefreshedAt 有值时展示最近刷新时刻。
  const html = renderToStaticMarkup(
    createElement(LibrarySkin, {
      data: READY_DATA,
      state: 'ready',
      actions: {},
      realtime: {
        lastRefreshedAt: 1700000000000,
        isLive: false,
        subscribe: () => () => {},
      },
    }),
  );
  assert.match(html, /轮询/, 'isLive=false → 轮询兜底标注（不伪造实时）');
  assert.match(html, /data-tone="poll"/);
});

test('实时显示：isLive=true → 实时标注（推送面接入后形态已预留）', () => {
  const html = renderToStaticMarkup(
    createElement(LibrarySkin, {
      data: READY_DATA,
      state: 'ready',
      actions: {},
      realtime: { lastRefreshedAt: 1700000000000, isLive: true, subscribe: () => () => {} },
    }),
  );
  assert.match(html, /实时/);
  assert.match(html, /data-tone="live"/);
});

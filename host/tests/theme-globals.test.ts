// FE-OPT-03：主题宿主全局桥（themeGlobals）单测。
//
// 回归背景：FE-OPT-01 把主题产物改为 IIFE + output.globals，契约要求宿主提供
// `window.React` 等依赖（主题 `index.js` 结尾为 `})(React)`）。若宿主未暴露，
// 主题入口抛 `React is not defined` → `data-theme` 恒不设置、domainSkins 不挂载
// （theme-switch 在 main 上恒红）。本测试锁定桥的幂等与正确挂载。
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import * as ReactDOM from 'react-dom';
import { exposeThemeGlobals } from '../src/theme/themeGlobals';

// 桥面向浏览器（`window`）；node:test 环境无 window → 建立最小别名。
(globalThis as unknown as Record<string, unknown>).window = globalThis;

test('exposeThemeGlobals：把宿主 React/ReactDOM 挂到 window', () => {
  const w = globalThis as unknown as Record<string, unknown>;
  // 清场（其它测试可能已挂）
  w.React = undefined;
  w.ReactDOM = undefined;
  w.ReactJSXRuntime = undefined;

  exposeThemeGlobals();

  assert.equal(w.React, React, 'window.React 必须是宿主同一实例');
  assert.equal(w.ReactDOM, ReactDOM, 'window.ReactDOM 必须是宿主同一实例');
  assert.ok(w.ReactJSXRuntime, 'window.ReactJSXRuntime 必须已挂载');
  // 必须是可用的 React 运行时（createElement）
  assert.equal(typeof (w.React as typeof React).createElement, 'function');
});

test('exposeThemeGlobals：幂等，且不覆盖已存在的全局', () => {
  const w = globalThis as unknown as Record<string, unknown>;
  const sentinel = { created: 'by-earlier-script' };
  w.React = sentinel;

  exposeThemeGlobals();

  assert.equal(w.React, sentinel, '已存在的 window.React 不得被覆盖');
});

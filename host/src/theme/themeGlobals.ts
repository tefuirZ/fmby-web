/**
 * 主题宿主机全局桥（FE-OPT-01 IIFE 契约缺失实现）。
 *
 * 背景（BUG 修复）：FE-OPT-01 把主题产物从 ESM 改为 **IIFE + output.globals**
 * （浏览器无 importmap，`import "react"` 裸说明符不可执行）。契约要求**宿主**
 * 以 `window.React / window.ReactDOM / window.ReactJSXRuntime / window.FmbyShared`
 * 提供依赖，主题产物 `<script>` 注入即执行、读 `window.FmbyTheme`。
 *
 * 但该桥**从未实现**：`themes/<id>/index.js` 结尾为 `})(React)`，而 `window.React`
 * 为 undefined → 主题入口抛 `React is not defined` → `data-theme` 恒不设置、
 * domainSkins 永不挂载（`theme-switch.spec.ts` 在 main 上恒红；且主题皮肤页
 * 无法进入 a11y/键盘遍历）。
 *
 * 本模块在宿主启动最早期（main.tsx，早于 ThemeProvider 激活 effect）把
 * **宿主已有的同一份** react/react-dom/jsx-runtime 实例挂到全局——不额外打包
 * 第二份 react（external 纪律由 scripts/check-frontend-size.mjs [3c] 守）。
 * 幂等：已存在则不覆盖（多 worktree/热重载安全）。
 *
 * 注：`@fmby/v2-shared` → `FmbyShared` 未在此预绑定——当前主题对 shared 仅作
 * **类型引用**（`import type`，构建期擦除），无运行时消费；预绑需把 shared 根
 * barrel 拉进首屏。第三方主题若需运行时消费 shared，应扩展本桥（登记在 handoff）。
 */

import React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactJSXRuntime from 'react/jsx-runtime';

let exposed = false;

/** 把主题所需的宿主依赖挂到 window（幂等）。 */
export function exposeThemeGlobals(): void {
  if (exposed) {
    return;
  }
  exposed = true;
  if (typeof window === 'undefined') {
    return;
  }
  const w = window as unknown as Record<string, unknown>;
  w.React ??= React;
  w.ReactDOM ??= ReactDOM;
  w.ReactJSXRuntime ??= ReactJSXRuntime;
}

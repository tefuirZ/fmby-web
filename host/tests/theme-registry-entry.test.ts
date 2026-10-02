/**
 * FE-STRICT-TYPES：IIFE 主题入口加载的诚实性（malformed entry 必 reject）。
 *
 * `loadIifeThemeEntry` 原先用 `entry as ThemeEntryModule` 断言全局落下的对象。
 * 本次去掉 `as unknown as` 后，用 `'manifest' in entry` 收窄；本测试锁定：
 * 全局缺失 / 非对象 / 缺 manifest 的 entry 必须 reject，不得解析成功。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { THEME_REGISTRY } from '../src/theme/registry.ts';

const g = globalThis as unknown as {
  window: unknown;
  document: unknown;
  FmbyTheme: unknown;
};

let pendingGlobal: unknown;

function installDom(): void {
  g.window = globalThis;
  g.document = {
    createElement: () => ({ src: '', async: false, onload: undefined, onerror: undefined }),
    head: {
      appendChild: (script: { onload?: () => void }) => {
        // 模拟 IIFE 产物执行：脚本落下 window.FmbyTheme，然后触发 onload。
        g.FmbyTheme = pendingGlobal;
        queueMicrotask(() => script.onload?.());
      },
    },
  };
}

async function loadEntryWith(value: unknown): Promise<unknown> {
  installDom();
  delete g.FmbyTheme;
  pendingGlobal = value;
  return THEME_REGISTRY.darkroom.loadEntry();
}

test('合法 entry（含 manifest）→ resolve', async () => {
  const entry = { manifest: { id: 'darkroom', version: '0.0.0' } };
  const result = await loadEntryWith(entry);
  assert.equal((result as { manifest: { id: string } }).manifest.id, 'darkroom');
});

test('全局缺失（脚本未落地）→ reject，不得静默成功', async () => {
  await assert.rejects(() => loadEntryWith(undefined), /missing after load/);
});

test('全局为 null → reject，不得静默成功', async () => {
  await assert.rejects(() => loadEntryWith(null), /missing after load/);
});

test('对象但缺 manifest key → reject，不得把坏 entry 当模块', async () => {
  await assert.rejects(() => loadEntryWith({ foo: 1 }), /missing after load/);
});

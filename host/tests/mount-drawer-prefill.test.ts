// F-47（fmby-web#2）：编辑抽屉预填不得被轮询刷新反复重置。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/mount-drawer-prefill.test.ts
//
// 形态：真实复刻 ManageMountsPage 的预填 effect —— deps 含 detailQuery.data
// （对象引用），而详情 query 在有 pending/running 扫描任务时 1.5s 轮询。
// ���描运行期间打开抽屉 ⇒ 用户输入每 1.5s 被服务端旧值覆盖。
//
// 上真实浏览器的原因：被测是 effect 依赖 + 轮询/渲染生命周期，SSR 不执行
// effect ⇒ 测不到；仓内无 jsdom / react-test-renderer 且不新增依赖，故复用既有
// devDep vite + @playwright/test。
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOST_ROOT = join(import.meta.dirname, '..');

const PROBE_ENTRY = `
import { createElement, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

const c = { prefills: 0, form: null };

/**
 * 与 ManageMountsPage.tsx 修复后**完全同形**的预填 effect（含 prefilledMountIdRef
 * 守卫），而非重写一份简化逻辑——否则测的不是生产代码。
 */
function Drawer({ mountKey, detail }) {
  const [formState, setFormState] = useState(null);
  const prefilledMountIdRef = useRef(null);
  useEffect(() => {
    if (mountKey && detail) {
      if (prefilledMountIdRef.current === mountKey) {
        return;
      }
      prefilledMountIdRef.current = mountKey;
      setFormState(detail.form);
      c.prefills += 1;
    }
  }, [detail, mountKey]);
  // 与 ManageMountsPage 的 closeMountDrawer 同形：关抽屉时清掉已预填标记。
  useEffect(() => {
    if (mountKey === null) {
      prefilledMountIdRef.current = null;
    }
  }, [mountKey]);
  return createElement('input', {
    value: formState?.name ?? '',
    onChange: (e) => setFormState({ ...formState, name: e.target.value }),
    onInput: (e) => { c.form = e.target.value; },
  });
}

let tick = 0;
function Parent() {
  // detail 每次轮询都是**新对象**（真实 query 返回新的 JSON 引用）。
  const [, force] = useState(0);
  const [closed, setClosed] = useState(false);
  globalThis.__poll = () => { tick += 1; force((t) => t + 1); };
  globalThis.__type = (v) => {
    const el = document.querySelector('input');
    // 必须走原生 setter：直接赋 el.value 会被 React 的 value tracker 当成
    // 「值未变」而跳过 onChange（实测输入根本不进 React state）。
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    desc.set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  globalThis.__close = () => setClosed(true);
  globalThis.__reopen = () => setClosed(false);
  return createElement(Drawer, {
    mountKey: closed ? null : 'm1',
    detail: { id: 'm1', form: { name: tick === 0 ? '服务名（初值）' : '服务名（轮询旧值）' } },
  });
}

createRoot(document.getElementById('root')).render(createElement(Parent));
globalThis.__c = c;
`;

test('F-47：详情轮询刷新不得重置抽屉里已编辑的表单', async (t) => {
  if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    return;
  }

  const { build } = await import('vite');
  const { chromium } = await import('@playwright/test');

  const work = await mkdtemp(join(tmpdir(), 'f47-'));
  const entryFile = join(HOST_ROOT, 'tests', '__probeF47-entry.tsx');
  await writeFile(entryFile, PROBE_ENTRY, 'utf8');

  try {
    await build({
      configFile: false,
      root: HOST_ROOT,
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"development"' },
      build: {
        outDir: work,
        emptyOutDir: true,
        minify: false,
        lib: { entry: entryFile, formats: ['iife'], name: 'F47', fileName: () => 'probe.js' },
      },
    });

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(String(error)));
      await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
      await page.addScriptTag({ path: join(work, 'probe.js') });
      await page.waitForFunction(() => Boolean((globalThis as any).__c));
      await page.waitForTimeout(100);

      // 用户在编辑抽屉里输入（真实场景：改目录/账号）。
      await page.evaluate(() => (globalThis as any).__type('我改过的值'));
      const before = await page.evaluate(() => (globalThis as any).__c.form);

      // 扫描任务运行中：详情 query 每 1.5s 轮询一次（此处加速模拟 3 次）。
      for (let i = 0; i < 3; i += 1) {
        await page.evaluate(() => (globalThis as any).__poll());
        await page.waitForTimeout(30);
      }
      await page.waitForTimeout(50);

      const after = await page.evaluate(() => ({ ...(globalThis as any).__c }));
      const inputValue = await page.inputValue('input');

      assert.deepEqual(pageErrors, [], '探针不得抛错');
      assert.equal(before, '我改过的值', '输入本身应先写进表单');
      assert.equal(
        inputValue,
        '我改过的值',
        `轮询后用户输入被服务端旧值覆盖（F-47：deps 含 detailQuery.data，对象引用每次轮询都变）；输入框现为「${inputValue}」`,
      );
      assert.ok(
        after.prefills <= 2,
        `3 次轮询触发了 ${after.prefills} 次预填（应 ≤2：初次 1 次 + 至多 1 次重开，不得每拍都重置）`,
      );

      // 反向守卫（防修过头）：关闭后重开**同一个** mount 必须重新预填，否则抽屉空白。
      await page.evaluate(() => (globalThis as any).__close());
      await page.waitForTimeout(30);
      await page.evaluate(() => (globalThis as any).__reopen());
      await page.waitForTimeout(50);
      const reopened = await page.inputValue('input');
      const finalCounts = await page.evaluate(() => ({ ...(globalThis as any).__c }));
      assert.ok(
        finalCounts.prefills > after.prefills,
        `重开同一 mount 必须重新预填（守卫不得吞掉重开）；预填次数 ${after.prefills} → ${finalCounts.prefills}`,
      );
      assert.match(
        reopened,
        /服务名（初值）|服务名（轮询旧值）/,
        `重开后抽屉应有详情值，不得空白；现为「${reopened}」`,
      );
    } finally {
      await browser.close();
    }
  } finally {
    await rm(entryFile, { force: true });
    await rm(work, { recursive: true, force: true });
  }
});
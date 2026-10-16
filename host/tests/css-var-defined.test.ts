/**
 * CSS 变量引用必须有定义（REVIEW-66 回归闸）。
 *
 * 背景：PR #66 曾把 `--font-weight-semibold` 误写成 `--font-weight-semibibold`（多一个 bi）
 * —— 变量未定义 ⇒ 该声明失效、字重回退 normal ⇒ 桌面也视觉变化（rb01 实抓）。
 * 这类「看起来对、其实未定义」的 typo 无法靠 tsc 发现（CSS 不进 tsc），
 * 故加本机械闸：仓内所有 CSS 的 `var(--x)` 引用，其 `--x` 必须在某处有定义。
 *
 * 定义来源：host/src + shared/src 下所有 .css 的 `--name:` 声明（含 defaults.css token 表）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url)); // host/tests
const ROOTS = [join(HERE, '..', 'src'), join(HERE, '..', '..', 'shared', 'src')];

/**
 * 显式 allowlist（两类，均**非 typo**）：
 * 1. `--radix-*`：Radix 运行时 JS 注入的 CSS 变量（Select/Popover 等），不在静态 CSS 定义表；
 * 2. 存量未定义基线（REVIEW-66 当次实测，属既有技术债，非本卡范围，登记待清）：
 *    BatchProgressPanel(--text/--radius-xs)、MediaItemDetail(--text-strong/--accent-subtle)、
 *    ManageShared(--surface-hover)。★登记为防止「新 typo 被存量债淹没」；清掉存量后应逐项移出。
 */
const ALLOWLIST = new Set<string>([
  '--radix-select-trigger-width',
  '--radix-select-content-available-height',
  '--text',
  '--radius-xs',
  '--surface-hover',
  '--text-strong',
  '--accent-subtle',
]);

function isAllowlisted(name: string): boolean {
  return name.startsWith('--radix-') || ALLOWLIST.has(name);
}

function walkCss(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walkCss(p, out);
    else if (entry.endsWith('.css')) out.push(p);
  }
  return out;
}

test('CSS var(--x) 引用的变量必须有定义（堵 semibold→semibibold 类 typo）', () => {
  const cssFiles = ROOTS.flatMap((r) => walkCss(r));
  assert.ok(cssFiles.length > 0, '应扫描到 CSS 文件');

  const defined = new Set<string>();
  for (const f of cssFiles) {
    const c = readFileSync(f, 'utf8');
    for (const m of c.matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]);
  }

  const undefinedRefs: string[] = [];
  for (const f of cssFiles) {
    const c = readFileSync(f, 'utf8');
    for (const m of c.matchAll(/var\((--[\w-]+)/g)) {
      const name = m[1];
      if (isAllowlisted(name)) continue;
      if (!defined.has(name)) {
        const line = c.slice(0, m.index).split('\n').length;
        undefinedRefs.push(`${relative(HERE, f)}:${line} var(${name}) 未定义`);
      }
    }
  }

  assert.deepEqual(
    undefinedRefs,
    [],
    `以下 var(--x) 引用未定义（声明会失效，属静默视觉 bug）：\n${undefinedRefs.join('\n')}`,
  );
});

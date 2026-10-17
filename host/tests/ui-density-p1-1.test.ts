// P1-1（FE-UI-DENSITY-AUDIT）DOM 断言：条目详情不得嵌套两层 `.page`。
//
// 背景：原实现 ItemDetailPage 外层 `<div className={styles.page}>` 内层又一层
// `<div className={styles.page}>`，而 `.page` 带 `padding: ... var(--grid-margin) ...`
// => 横向 gutter 叠加至 2x（最大 80px/侧），hero（外层）与分节（内层）左右缘错位。
//
// 为什么用「读源码文本」而不是渲染断言：本仓前端测试是 node:test + 桩 fetch 的
// 契约测试（见 media-items-detail.test.ts），**没有** jsdom/RTL 渲染环境；
// 引一个渲染库只为这一条断言违反 ponytail（YAGNI + 零新依赖）。
// 这条断言盯的是**结构不变量**（同类名不得嵌套两层），文本判定足够且稳定。
//
// 运行：node --import ./host/tests/register-aliases.mjs --test host/tests/*.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const pagePath = join(repoRoot, 'src/pages/browse/ItemDetailPage.tsx');
const cssPath = join(repoRoot, 'src/pages/browse/styles/shared.module.css');

/** 取 JSX 里所有 `className={styles.X}` 的出现（按序）。 */
function classNamesIn(source) {
  const out = [];
  const re = /className=\{styles\.([A-Za-z0-9_]+)\}/g;
  let m;
  while ((m = re.exec(source)) !== null) out.push(m[1]);
  return out;
}

test('P1-1: ItemDetailPage 不得嵌套两层 .page（双重 gutter）', () => {
  const src = readFileSync(pagePath, 'utf8');
  const names = classNamesIn(src);
  const pageCount = names.filter((n) => n === 'page').length;

  assert.equal(
    pageCount,
    1,
    `条目详情应只有 1 个 .page（外层）；实测 ${pageCount} 个。` +
      `嵌套两层会把 var(--grid-margin) 叠加成 2x，hero 与分节左右缘错位。`
  );
});

test('P1-1: 内层分节容器必须存在且不带 padding', () => {
  const src = readFileSync(pagePath, 'utf8');
  const css = readFileSync(cssPath, 'utf8');

  // 页面确实用了 pageSections
  assert.ok(
    /className=\{styles\.pageSections\}/.test(src),
    'ItemDetailPage 应使用 styles.pageSections 作为内层分节容器'
  );

  // CSS 里 .pageSections 存在
  const block = css.match(/\.pageSections\s*\{([^}]*)\}/);
  assert.ok(block, 'shared.module.css 应定义 .pageSections');

  // 关键：.pageSections 不得带 padding（否则又变成双重 gutter）
  assert.doesNotMatch(
    block[1],
    /padding\s*:/,
    '.pageSections 不得带 padding —— 它是内层，padding 由外层 .page 负责'
  );

  // 反证：.page 仍然带 padding（外层职责未丢）
  const pageBlock = css.match(/\.page\s*\{([^}]*)\}/);
  assert.ok(pageBlock, '.page 定义应仍在');
  assert.match(
    pageBlock[1],
    /padding\s*:/,
    '.page 必须保留 padding（它是唯一的外层 gutter 来源）'
  );
});

test('P1-1: 两容器栅格一致（gap/width/max-width/margin）', () => {
  const css = readFileSync(cssPath, 'utf8');
  const sections = css.match(/\.pageSections\s*\{([^}]*)\}/)[1];
  const page = css.match(/\.page\s*\{([^}]*)\}/)[1];

  // hero（外层 .page）与分节（.pageSections）必须同栅格，否则左右缘仍会错位
  for (const prop of ['gap', 'width', 'max-width', 'margin']) {
    const pick = (block) => {
      const m = block.match(new RegExp(`${prop}\\s*:([^;]+);`));
      return m ? m[1].trim() : null;
    };
    assert.equal(
      pick(sections),
      pick(page),
      `.pageSections 与 .page 的 ${prop} 必须一致（同栅格），否则 hero 与分节仍错位`
    );
  }
});

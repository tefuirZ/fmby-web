/**
 * CAS 触屏热区的**运行时证明**（卡 FIX-CSS-HOTAREA · 席位 w10）
 *
 * 要证的是什么（以及为什么要自己证）：
 *   `ManageCasPage.tsx:181/182/204/207` 与 `casWriteActions.tsx:31` 用
 *   `styles.casHitCell / casHitCheck / casHitCellBtn / casHitBtn` 扩触屏热区。
 *   仓内闸 `scripts/check-css-module-usage.mjs` 判它们「CSS 里未定义」⇒
 *   推论是 `className=undefined`⇒**热区静默失效**（用户点不到、且零报错）。
 *   而唯一覆盖真实点击命中的 `host/e2e/cas-tap-targets.spec.ts` **需要活后端**
 *   （`test.skip(!E2E_ENABLED)`）⇒ 在有后端的机器之外，这条链没有任何证据。
 *
 * ★本探针把「导出面 + 几何 + 命中」三件事一次性在真浏览器里证死，且不依赖后端：
 *   ① `styles.casHit*` 四个键在**打包产物**里确有导出（非 undefined）；
 *   ② 触屏媒体查询真匹配（仓内 `playwright.config.ts:79-83` 点过这个坑：
 *      desktop project 的 pointer 是 fine ⇒ 触屏规则**永不生效**却会记成「0 违规」）；
 *   ③ 热区几何真成立：`td` 是定位上下文（`position:relative`）、
 *      `::after` 用 `inset:0` **填满本格** ⇒ 贴近格底的点命中按钮本身（不跨行）；
 *      独立按钮 `.casHitBtn::after` 的带高 = `--touch-min` 解析后的 **44px**；
 *   ④ 桌面对照：同一 DOM 在 fine pointer 下热区**不生效**（`position:static`），
 *      证明「触屏才扩、桌面零变化」这个设计事实没被改坏。
 *
 * 形态沿用仓内既有 DOM 探针范式（vite 打包 + `@playwright/test` Chromium +
 *   本地 http 服务器给真 origin；entry 落 `os.tmpdir()`，收尾 `rm` 整棵 work）。
 *   ★触屏 profile 用 `devices['Pixel 5']`（isMobile + hasTouch）—— 与 e2e 的
 *   mobile-chrome project 同一档，否则 `pointer:coarse` 不匹配、本探针自证为空。
 *
 * 诚实边界：探针挂的是与生产**同结构**的 DOM 复刻 + 真 CSS module（不是真页面），
 *   因为真页面要先过会话与数据面。它证的是「类名有导出 + 样式真生效 + 热区真可点」，
 *   **不**替代 `cas-tap-targets.spec.ts` 对真页面的端到端覆盖。
 *
 * 跑法：node --import ./tests/register-aliases.mjs --test tests/cas-tap-target-cssmodule.dom.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const HOST_ROOT = join(import.meta.dirname, '..');
const NM = join(HOST_ROOT, 'node_modules');
const nmUrl = (rel: string) => pathToFileURL(join(NM, rel)).href;

/** 被测的两个真源：CSS module（热区规则）+ defaults.css（`--touch-min` 的定义处）。 */
const SHARED_CSS = pathToFileURL(
  join(HOST_ROOT, 'src/pages/manage/longtail-shared/ManageShared.module.css'),
).href;
const DEFAULTS_CSS = pathToFileURL(join(HOST_ROOT, 'src/styles/defaults.css')).href;

/** 探针 DOM：与 `ManageCasPage.tsx:181-213` / `casWriteActions.tsx:31` 同结构同 class 取法。 */
const PROBE_ENTRY = `
import { createElement as h } from '${nmUrl('react/index.js')}';
import { createRoot } from '${nmUrl('react-dom/client.js')}';
import '${DEFAULTS_CSS}';
import styles from '${SHARED_CSS}';

// 导出面原样交给测试读（证伪「styles.X = undefined」）
window.__casHitExports = {
  casHitCell: styles.casHitCell,
  casHitCheck: styles.casHitCheck,
  casHitCellBtn: styles.casHitCellBtn,
  casHitBtn: styles.casHitBtn,
};

function Scene() {
  return h('div', null,
    // 密集表格单元格（保存按钮 / checkbox）—— 与 ManageCasPage 的 tr/td 形态一致：
    // ★必须带真页面的 styles.tableWrap + styles.table，否则 td 的 padding 不同、
    //   量出来的格高与生产不一致（e2e 对真页面的判据是格高 ≥24，见 cas-tap-targets.spec.ts:74）。
    h('div', { className: styles.tableWrap, role: 'region', 'aria-label': '盘配置（CAS 矩阵）（可横向滚动）' },
    h('table', { className: styles.table },
      h('thead', null, h('tr', null, h('th', null, '盘'), h('th', null, '纳入扇出'), h('th', null, '操作'))),
      h('tbody', null,
      h('tr', null,
        h('td', null, 'drive-a'),
        h('td', { className: styles.casHitCell, id: 'cell-check' },
          h('label', { className: styles.casHitCheck },
            h('input', { type: 'checkbox', 'aria-label': 'drive-a 纳入扇出' }))),
        h('td', { className: styles.casHitCell, id: 'cell-save' },
          h('button', { type: 'button', className: styles.casHitCellBtn, id: 'save-btn' }, '保存')),
      ),
      // 相邻行：用来证「热区不跨行」——行 B 的顶边不该被行 A 的热区吃掉
          h('tr', { id: 'row-b' }, h('td', null, 'drive-b'), h('td', null, ''), h('td', null, '')),
      ))),
    // 独立按钮（不在密集行内）：44 高热带
    h('div', null,
      h('button', { type: 'button', className: styles.casHitBtn, id: 'standalone-btn' }, '触发对账')),
  );
}

createRoot(document.getElementById('root')).render(h(Scene));
`;

const SKIP = Symbol('skip');

/** 找到 outDir 里 vite 抽出的 CSS（lib 构建默认叫 style.css，但名字不是契约）。 */
function findEmittedCss(outDir: string): string {
  const css = readdirSync(outDir).filter((f) => f.endsWith('.css'));
  if (css.length === 0) throw new Error(`构建产物里没有 CSS（outDir=${outDir}）⇒ 热区样式没进产物`);
  return join(outDir, css[0]);
}

async function buildProbe(): Promise<{ jsPath: string; cssPath: string; work: string }> {
  const work = await mkdtemp(join(tmpdir(), 'fe-cas-hit-'));
  const entryFile = join(work, '__probeCasHit-entry.tsx');
  const outDir = join(work, 'dist');
  await writeFile(entryFile, PROBE_ENTRY, 'utf8');
  let ok = false;
  try {
    await (
      await import('vite')
    ).build({
      configFile: false,
      root: HOST_ROOT,
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"development"' },
      resolve: {
        alias: {
          '@fmby/v2-shared': join(HOST_ROOT, '..', 'shared', 'src'),
          '@': join(HOST_ROOT, 'src'),
        },
      },
      build: {
        outDir,
        emptyOutDir: true,
        minify: false,
        lib: {
          entry: entryFile,
          formats: ['iife'],
          name: 'ProbeCasHit',
          fileName: () => 'probe.js',
        },
      },
    });
    ok = true;
  } finally {
    await rm(entryFile, { force: true });
    if (!ok) await rm(work, { recursive: true, force: true });
  }
  return { jsPath: join(outDir, 'probe.js'), cssPath: findEmittedCss(outDir), work };
}

/** 起静态服务器（真 origin），把打包出的 JS/CSS 交给页面。 */
async function serveProbe(jsPath: string, cssPath: string): Promise<{ origin: string; stop: () => Promise<void> }> {
  const html =
    '<!doctype html><html><head><link rel="stylesheet" href="/probe.css"></head>' +
    '<body><div id="root"></div><script src="/probe.js"></script></body></html>';
  const server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url === '/probe.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(readFileSync(jsPath));
      return;
    }
    if (url === '/probe.css') {
      res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' });
      res.end(readFileSync(cssPath));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return {
    origin: `http://127.0.0.1:${port}`,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** 页内测量：热区定位上下文 + ::after 覆盖 + 贴近格底的命中 + 独立按钮带高。 */
const MEASURE = () => `
  (() => {
    const btn = document.querySelector('#save-btn');
    const cell = document.querySelector('#cell-save');
    const check = document.querySelector('#cell-check');
    const standalone = document.querySelector('#standalone-btn');
    const rowB = document.querySelector('#row-b');
    const out = {
      exports: {
        casHitCell: (window).__casHitExports.casHitCell ?? null,
        casHitCheck: (window).__casHitExports.casHitCheck ?? null,
        casHitCellBtn: (window).__casHitExports.casHitCellBtn ?? null,
        casHitBtn: (window).__casHitExports.casHitBtn ?? null,
      },
      coarse: matchMedia('(hover: none) and (pointer: coarse)').matches,
      cellApplied: cell ? cell.className : '',
      cellPos: cell ? getComputedStyle(cell).position : '',
      // ::after 的实际几何（Chromium 支持读伪元素 computed style）
      afterPos: btn ? getComputedStyle(btn, '::after').position : '',
      afterTop: btn ? getComputedStyle(btn, '::after').top : '',
      bandHeight: standalone ? parseFloat(getComputedStyle(standalone, '::after').height) : NaN,
      touchMinVar: getComputedStyle(document.documentElement).getPropertyValue('--touch-min').trim(),
    };
    if (btn && cell) {
      const rb = btn.getBoundingClientRect();
      const rc = cell.getBoundingClientRect();
      const cx = rc.left + rc.width / 2;
      // 贴近格底（按钮视觉盒之外）的点：热区填满本格 ⇒ 应命中保存按钮自身
      const hitBottom = document.elementFromPoint(cx, rc.bottom - 2);
      out.boxH = Math.round(rb.height);
      out.cellH = Math.round(rc.height);
      out.hitBottomIsSelf = !!hitBottom && (hitBottom === btn || btn.contains(hitBottom) || (hitBottom && hitBottom.contains && hitBottom.contains(btn)));
      // 不跨行：行 B 顶边外侧的点不该命中保存按钮
      if (rowB) {
        const rB = rowB.querySelectorAll('td')[2].getBoundingClientRect();
        const hitAcross = document.elementFromPoint(cx, rB.top + 2);
        out.hitAcrossRowIsSelf = !!hitAcross && (hitAcross === btn || btn.contains(hitAcross));
      }
    }
    if (check) {
      const rc2 = check.getBoundingClientRect();
      const label = check.querySelector('label');
      const hit = document.elementFromPoint(rc2.left + rc2.width / 2, rc2.bottom - 2);
      out.checkHit = !!hit && !!label && (hit === label || label.contains(hit) || hit.contains(label));
    }
    return out;
  })()
`;

type Measure = {
  exports: Record<string, string | null>;
  coarse: boolean;
  cellApplied: string;
  cellPos: string;
  afterPos: string;
  afterTop: string;
  bandHeight: number;
  touchMinVar: string;
  boxH?: number;
  cellH?: number;
  hitBottomIsSelf?: boolean;
  hitAcrossRowIsSelf?: boolean;
  checkHit?: boolean;
};

let workDirs: string[] = [];
let stopServer: (() => Promise<void>) | null = null;
let browser: import('@playwright/test').Browser | null = null;
let bundle: { jsPath: string; cssPath: string; work: string } | null = null;
let servedOrigin = '';

async function cleanup() {
  if (browser) await browser.close();
  if (stopServer) await stopServer();
  for (const w of workDirs) await rm(w, { recursive: true, force: true });
  browser = null;
  stopServer = null;
  workDirs = [];
}
test.after(cleanup);

async function getBundle(): Promise<{ origin: string }> {
  if (bundle) return { origin: servedOrigin };
  bundle = await buildProbe();
  workDirs.push(bundle.work);
  const served = await serveProbe(bundle.jsPath, bundle.cssPath);
  stopServer = served.stop;
  servedOrigin = served.origin;
  return { origin: served.origin };
}

async function openAt(origin: string, mobile: boolean) {
  if (!browser) {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch();
  }
  const { devices } = await import('@playwright/test');
  const ctx = await browser.newContext(mobile ? { ...devices['Pixel 5'] } : {});
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(String(e)));
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#save-btn') !== null, undefined, {
    timeout: 20000,
  });
  return { ctx, page, errors };
}

test('触屏档：casHit* 确有导出 + 热区填满单元格（贴近格底命中自身、不跨行）+ 独立按钮 44 热带', async (t) => {
  if (!existsSync(join(NM, 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    return;
  }
  const built = await getBundle();
  const { ctx, page, errors } = await openAt(built.origin, true);
  try {
    const m = (await page.evaluate(MEASURE())) as Measure;
    assert.deepEqual(errors, [], `探针页面不应抛错，实际：${errors.join(' | ')}`);

    // ① 导出面：四个类名都要有真值（闸的推论是它们 undefined —— 这里直接判真伪）
    for (const [k, v] of Object.entries(m.exports)) {
      assert.ok(
        typeof v === 'string' && v.length > 0,
        `styles.${k} 必须在打包产物里有导出（undefined = 闸的推论成立、热区静默失效），实际=${String(v)}｜导出面=${JSON.stringify(m.exports)}`,
      );
    }

    // ② 媒体查询真匹配（否则触屏样式根本没参与渲染，下面的断言会自证为空）
    assert.equal(
      m.coarse,
      true,
      '本用例必须在 pointer:coarse 下跑（playwright.config.ts:79-83 的坑：fine 指针下触屏规则永不匹配却记成 0 违规）',
    );

    // ③ 几何：td 是定位上下文、::after 绝对定位铺满本格
    assert.equal(
      m.cellPos,
      'relative',
      `.casHitCell 单元格应 position:relative（热区的定位上下文）｜class=${m.cellApplied}`,
    );
    assert.equal(m.afterPos, 'absolute', '单元格内按钮的 ::after 必须是绝对定位热区');
    assert.equal(m.afterTop, '0px', '热区 inset:0 ⇒ top 应为 0（填满单元格而不是外扩）');
    assert.ok(
      (m.cellH ?? 0) >= 24,
      `单元格应有可点高度（实测 cellH=${m.cellH}, 按钮盒 boxH=${m.boxH}）`,
    );
    assert.equal(
      m.hitBottomIsSelf,
      true,
      `贴近格底的点必须命中保存按钮自身（热区填满本格）｜读数=${JSON.stringify(m)}`,
    );
    assert.equal(
      m.hitAcrossRowIsSelf,
      false,
      `行 B 顶边的点不得命中行 A 的保存按钮（热区被单元格兜住，绝不跨行 —— REVIEW-69 的原风险）｜读数=${JSON.stringify(m)}`,
    );
    assert.equal(
      m.checkHit,
      true,
      `checkbox 包在 .casHitCheck <label> 里 ⇒ 点格内盒外也应命中该 label（整格可切换）｜读数=${JSON.stringify(m)}`,
    );

    // ④ 独立按钮的 44 热带（--touch-min 经 CSS 变量真解析）
    assert.equal(m.touchMinVar, '44px', `--touch-min 应由 defaults.css:180 解析成 44px，实测 ${m.touchMinVar}`);
    assert.ok(
      Math.abs(m.bandHeight - 44) < 0.5,
      `.casHitBtn::after 的带高应为 44（--touch-min），实测 ${m.bandHeight}`,
    );
  } finally {
    await ctx.close();
  }
});

test('桌面对照：fine pointer 下热区不生效（触屏才扩、桌面零变化）', async (t) => {
  if (!existsSync(join(NM, 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    return;
  }
  const built = await getBundle();
  const { ctx, page } = await openAt(built.origin, false);
  try {
    const m = (await page.evaluate(MEASURE())) as Measure;
    assert.equal(m.coarse, false, '本用例必须在桌面（fine pointer）下跑');
    assert.notEqual(
      m.cellPos,
      'relative',
      `桌面档不得应用 .casHitCell 的 position:relative（触屏媒体查询不该在 fine 指针下匹配）｜读数=${JSON.stringify(m)}`,
    );
    assert.equal(
      m.afterPos,
      'static',
      `桌面档不得有绝对定位的 ::after 热区（触屏规则不该在 fine 指针下匹配）｜读数=${JSON.stringify(m)}`,
    );
    assert.equal(
      m.afterTop,
      'auto',
      `桌面档 ::after 无 inset:0（top 应保持 auto）｜读数=${JSON.stringify(m)}`,
    );
    // ★诚实边界：`cas-tap-targets.spec.ts:79-81` 在**真页面**上还会断言「桌面格底的点
    //   不命中按钮」。这里不复刻那条 —— 复刻的裸表格里 td 的 padding 与真页面不同
    //   （实测格高 46 / 按钮盒 21），命中与否取决于盒子落位而不是热区，写死反而会把
    //   探针变成几何快照。热区是否在桌面档生效，由上面 position/inset 两条判据承担。
  } finally {
    await ctx.close();
  }
});

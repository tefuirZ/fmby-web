// FE-UI-1：扫码二维码**可缩放**（115 挂载 / 115 新建 / 115 图床 / 115 分享预览 / 139 / TOTP）。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/qr-image-responsive.dom.test.ts
//
// 背景（用户原话）：「扫码登录（115、139）为啥那个二维码那么大？不能缩放一下？」
// 改前实测（本测试断言的就是「改前必红」的三种形态）：
//   1. 三处 115 弹窗写死 `width:220;height:220` inline style ⇒ 视口再窄也不缩；
//   2. 三处页内 <img> 误用 `styles.readonlyField`（`width:100%` 的**只读文本框**类）
//      ⇒ 二维码被拉到整行宽、**比例失真**，且无上限；
//   3. 没有任何**下限**保护 ⇒ 若有人一味求小，二维码会缩到扫不出来的尺寸。
//
// 为什么上真实浏览器：被测是 CSS 媒体查询 + flex 收缩下的**真实布局盒**（offsetWidth），
// 静态源码断言只能证明「写了某个数值」，证不了「窄容器下真的变小」。仓内无 jsdom /
// testing-library（引新依赖违反 ponytail），故沿用 table-row-keynav.test.ts 与
// search-overlay-focus.test.ts 既有范式：复用 devDep vite（打包）+ @playwright/test
// （Chromium），**零新增依赖**。
//
// ★`box-sizing` 说明：本探针自带 `*{box-sizing:border-box}`（全站 defaults.css 同款），
//   因为 page.setContent 的空文档不带宿主样式表；不补的话 offsetWidth 会把
//   padding+border 算进 content 宽，断言口径与线上不一致。

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const HOST_ROOT = join(import.meta.dirname, '..');

const NM = join(HOST_ROOT, 'node_modules');
const nmUrl = (rel: string) => pathToFileURL(join(NM, rel)).href;
const NM_REACT = nmUrl('react/index.js');
const NM_REACT_DOM_CLIENT = nmUrl('react-dom/client.js');

/** 被测组件（绝对 file URL，绕开 tmpdir 解析链）。 */
const COMPONENT_URL = pathToFileURL(
  join(HOST_ROOT, 'src/pages/manage/longtail-shared/components/ScanQrImage.tsx'),
).href;

/**
 * 探针：把 ScanQrImage 放进**不同宽度的容器**里各渲染一份，
 * 用 `data-slot` 标记，便于按容器取 offsetWidth / offsetHeight。
 *
 * 三个容器宽度取的是仓内真实断点的三个代表：
 *   480px —— 桌面管理卡（ManageSectionCard 内容区，宽）
 *   280px —— 平板/窄侧栏（DetailModal 在小屏的可用内容宽）
 *   240px —— 手机档最苛刻情形（375px 视口 - 弹窗左右各 20px 边距）
 */
function probeEntry(containerWidths: number[]): string {
  const widthsLiteral = JSON.stringify(containerWidths);
  return `
import { createElement } from '${NM_REACT}';
import { createRoot } from '${NM_REACT_DOM_CLIENT}';
import { ScanQrImage } from '${COMPONENT_URL}';

const WIDTHS = ${widthsLiteral};

// ★1x1 PNG（不透明）—— 只关心布局盒尺寸，不关心图内容。
// 不用 SVG：115 侧是 PNG data URI（后端 qrcodeapi.115.com 拉图转 data URI，
// 见 crates/fmby-v2-providers/src/pan115_qr.rs:144），探针必须复刻真实图种。
const PNG_1x1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

createRoot(document.getElementById('root')).render(
  createElement(
    'div',
    { style: { display: 'flex', gap: '24px', alignItems: 'flex-start' } },
    WIDTHS.map((w) =>
      createElement(
        'div',
        { key: String(w), 'data-slot': 'container-' + w, style: { width: w + 'px', flex: 'none' } },
        createElement(ScanQrImage, {
          src: PNG_1x1,
          alt: '115 登录二维码（探针）',
          kind: 'bitmap',
        }),
      ),
    ),
  ),
);
`;
}

/** 打包一次探针，返回 { bundle, css, work }（用完由调用方整棵清理）。 */
async function buildProbe(
  containerWidths: number[],
): Promise<{ bundle: string; css: string; work: string } | null> {
  if (!existsSync(join(NM, 'react'))) return null;
  const work = await mkdtemp(join(tmpdir(), 'feui1-qr-'));
  const entryFile = join(work, '__probeScanQr-entry.tsx');
  const outDir = join(work, 'dist');
  await writeFile(entryFile, probeEntry(containerWidths), 'utf8');
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
          name: 'ProbeScanQr',
          fileName: () => 'probe.js',
        },
      },
    });
  } finally {
    await rm(entryFile, { force: true });
  }
  // lib 模式把 CSS 吐成同名 .css（vite 默认文件名取包名/或 index）——按需探测。
  const { readdir } = await import('node:fs/promises');
  const cssName = (await readdir(outDir)).find((f) => f.endsWith('.css'));
  return {
    bundle: join(outDir, 'probe.js'),
    css: cssName ? join(outDir, cssName) : '',
    work,
  };
}

type Harness = { page: any; close: () => Promise<void> };
let harness: Harness | null = null;
const SKIP = Symbol('skip');

const CONTAINER_WIDTHS = [480, 260, 240, 200];

async function getHarness(t: any): Promise<Harness> {
  if (harness) return harness;
  const built = await buildProbe(CONTAINER_WIDTHS);
  if (!built) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    throw SKIP;
  }
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(String(e)));
  await page.setContent(`<!doctype html><html><head><style>
    /* 全站 defaults.css 同款（探针需自带：setContent 的裸文档无宿主样式表）。 */
    *{box-sizing:border-box}
    body{margin:0;background:#0b0c0f}
  </style></head><body><div id="root"></div></body></html>`);
  // ★必须把被测组件**自带的 CSS Module** 也注入：lib 模式不自动插 <link>，
  //   不注入则 class 名在但无规则 ⇒ offsetWidth 恒为 0，断言失去意义。
  if (built.css) await page.addStyleTag({ path: built.css });
  await page.addScriptTag({ path: built.bundle });
  await page.waitForSelector('[data-slot="container-240"] img');
  harness = {
    page,
    close: async () => {
      await browser.close();
      await rm(built.work, { recursive: true, force: true });
    },
  };
  (harness as any).errors = errors;
  return harness;
}

after(async () => {
  if (harness) await harness.close();
});

async function qrBox(containerWidth: number): Promise<{ w: number; h: number }> {
  const page = (harness as Harness).page;
  return page.evaluate((w: number) => {
    const img = document.querySelector(`[data-slot="container-${w}"] img`) as HTMLImageElement | null;
    if (!img) return { w: -1, h: -1 };
    return { w: img.offsetWidth, h: img.offsetHeight };
  }, containerWidth);
}

test('① 二维码随容器变窄而变小（不是写死 220px）', async (t) => {
  let page: any;
  try {
    ({ page } = await getHarness(t));
  } catch (err) {
    if (err !== SKIP) throw err;
    return;
  }
  const capped = await qrBox(480);
  const adaptive = await qrBox(260);
  const phone = await qrBox(240);

  // 改前：三处 115 弹窗写死 width:220/height:220 ⇒ 任何容器都是 220
  //       （「容器再窄也不缩」⇒ 本断言必红）；
  //       三处页内 <img> 误用 .readonlyField（width:100% 无上限）⇒ 480px 容器
  //       下被拉到整行宽 480px（「无限撑大」⇒ 上限断言必红）。
  assert.ok(
    adaptive.w > phone.w,
    `容器窄于上限时二维码须跟着缩：260px 容器得 ${adaptive.w}px、240px 容器得 ${phone.w}px`,
  );
  // 宽容器下仍受**上限**约束（不能无限撑大，那是改前 readonlyField 的「整行拉伸」病）
  assert.ok(capped.w <= 280, `宽容器下二维码不得超过 280px 上限（实际 ${capped.w}px）`);
  assert.ok(adaptive.w <= 280, `260px 容器不得超上限（实际 ${adaptive.w}px）`);
  assert.deepEqual((harness as any).errors, [], '探针不得抛错');
});

test('② 手机档不小于扫码可用下限（180px，含 quiet zone）', async (t) => {
  let page: any;
  try {
    ({ page } = await getHarness(t));
  } catch (err) {
    if (err !== SKIP) throw err;
    return;
  }
  const phone = await qrBox(240);
  const floored = await qrBox(200);
  // 下限依据（本卡取证，见 docs/FE-UI-1-QR-IMAGE-RESPONSIVE.md）：
  //   115 图源 185×185 / 29 模块 ⇒ 每模块 ≈6.4px（qrcodeapi.115.com 实测 curl）。
  //   缩到 180px ⇒ 每模块 ≈6.2px，仍在「≥6px/模块」可扫区间；再往下
  //   （<150px ⇒ <5px/模块）手机摄像头在常规距离解析失败 ⇒ 扫码失败。
  assert.ok(
    phone.w >= 180,
    `240px 容器下二维码不得低于 180px 扫码下限（实际 ${phone.w}px）`,
  );
  assert.ok(phone.h >= 180, `高度同样不得低于 180px（实际 ${phone.h}px）`);
  // 容器比下限还窄 ⇒ 兜底停在下限，绝不破下限
  assert.ok(
    floored.w >= 180,
    `200px 容器（窄于下限）仍不得低于 180px（实际 ${floored.w}px）`,
  );
  // 同时也不得反向超过手机档上限
  assert.ok(floored.w <= 240, `200px 容器下不得超过手机档上限 240px（实际 ${floored.w}px）`);
  assert.deepEqual((harness as any).errors, [], '探针不得抛错');
});

test('③ 缩放不影响扫码区域层级与可访问名（弹窗内仍可点、仍有 alt）', async (t) => {
  let page: any;
  try {
    ({ page } = await getHarness(t));
  } catch (err) {
    if (err !== SKIP) throw err;
    return;
  }
  // 可访问名：alt 必须透传（扫码区对读屏用户是「用手机扫这张图」的动作说明）
  const alt = await page.evaluate(
    () => (document.querySelector('[data-slot="container-260"] img') as HTMLImageElement).alt,
  );
  assert.equal(alt, '115 登录二维码（探针）', 'alt 必须原样透传');

  // 层级：二维码自身不得设 z-index/position 抢层级（会盖住弹窗关闭按钮或遮罩）
  const layering = await page.evaluate(() => {
    const img = document.querySelector('[data-slot="container-260"] img') as HTMLImageElement;
    const wrap = img.parentElement as HTMLElement;
    const cs = getComputedStyle(img);
    const ws = getComputedStyle(wrap);
    return {
      imgPosition: cs.position,
      imgZIndex: cs.zIndex,
      wrapPosition: ws.position,
      wrapZIndex: ws.zIndex,
      // 图片必须真的解码成非零尺寸（display:none / 0×0 会让「扫码区」不存在）
      natural: { w: img.naturalWidth, h: img.naturalHeight },
    };
  });
  assert.equal(layering.imgPosition, 'static', '二维码不得自设定位（不抢弹窗层级）');
  assert.equal(layering.imgZIndex, 'auto', '二维码不得自设 z-index');
  assert.equal(layering.wrapPosition, 'static', '二维码容器不得自设定位');
  assert.equal(layering.wrapZIndex, 'auto', '二维码容器不得自设 z-index');
  assert.ok(layering.natural.w > 0 && layering.natural.h > 0, '图片必须真实加载（非 0×0）');
  assert.deepEqual((harness as any).errors, [], '探针不得抛错');
});

/**
 * CAS 内容列表页的**两态分离**行为锁（卡 CAS-G5 · #78 · 席位 w10）
 *
 * 要钉住的缺陷（用户面是「撒谎」，不是排版）：
 *   页面在 `unwired` 分支写「后端列表端点（w02 CAS-CONTENT-LIST-API）**尚未接线**」，
 *   而该端点在 fmby-v2 **早已实现并挂进生产 router**
 *   （`crates/fmby-v2-http/src/routes/admin_cas.rs` 的 `cas_list_contents`，
 *   同文件测试 :382 还专门断言「命中真实 handler 而非 404」）。
 *   ⇒ 运维读到这句会以为**功能没做**，而真原因只有两个：
 *     ① 本实例 CAS 端口未装配（`service(&state)` ⇒ 503）；
 *     ② 后端版本过旧、该路由不存在（404）。
 *   另一半：`unwired`（取不到数据）与「后端正常返回空列表」（真·没有内容）
 *   必须**分开呈现**——不能把前者说成「0 条内容」，也不能把后者说成「功能未开发」。
 *
 * ★为什么用真渲染而不是源码文本断言：仓内既有 `cas-publish-orchestration.contract.test.ts`
 *   就是用文本判据钉这件事的——而它恰恰把**错误的文案**当成了判据
 *   （`/数据面未就绪|尚未接线|等待后端/`），结果「谎」被锁在测试里，改对了反而红。
 *   本探针按行为判：喂不同的真回执，看页面**分别**说出对的话。
 *   文本断言只能证明「文件里有这几个字」，证明不了「这一态渲染这一句」。
 *
 * 形态沿用仓内 DOM 探针范式（vite 打包 iife + @playwright/test Chromium +
 *   本地 http 服务器给真 origin；见 `runtime-log-archives-empty-scroll.dom.test.ts:71-74`
 *   关于 `setContent` 下 `window.location.origin` 非法的实证）。
 *
 * 跑法：node --import ./tests/register-aliases.mjs --test tests/cas-content-list-states.dom.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const HOST_ROOT = join(import.meta.dirname, '..');
const NM = join(HOST_ROOT, 'node_modules');
const nmUrl = (rel: string) => pathToFileURL(join(NM, rel)).href;

const PAGE_URL = pathToFileURL(join(HOST_ROOT, 'src/pages/manage/CasContentListPage.tsx')).href;

/** 一条真回执（snake_case wire，字段名对 `mapCasContentSummary` 取证而来）。 */
const ONE_ITEM_WIRE = [
  {
    content_id: 7,
    fingerprint: { sha256: 'a'.repeat(64), md5: null, size_bytes: 1024 },
    media_item_id: 42,
    drives: [{ drive_ref: 'drive-a', provider_type: 'quark', copy_state: 'ok' }],
    has_local_entity: true,
    source_kind: 'rapid_upload',
    deferred_gate: null,
    grace_remaining_ms: null,
    lease: null,
    updated_at: '2026-10-16T00:00:00Z',
  },
];

const PROBE_ENTRY = `
import { createElement } from '${nmUrl('react/index.js')}';
import { createRoot } from '${nmUrl('react-dom/client.js')}';
import { QueryClient, QueryClientProvider } from '${nmUrl('@tanstack/react-query/build/modern/index.js')}';
import { CasContentListPage } from '${PAGE_URL}';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
createRoot(document.getElementById('root')).render(
  createElement(QueryClientProvider, { client: qc }, createElement(CasContentListPage)),
);
`;

/** 三种后端态：数据面不可用（503）/ 正常空列表 / 有数据。 */
type Variant = 'port_unassembled' | 'route_missing' | 'empty_list' | 'with_data';

const ANSWERS: Record<Variant, { status: number; body: string }> = {
  // CAS 端口未装配 ⇒ 后端 fail-closed 503（不是「端点不存在」）
  port_unassembled: { status: 503, body: JSON.stringify({ error_code: 'dependency_unavailable', message: 'CAS 端口未装配' }) },
  // 后端版本过旧 ⇒ 该路由不存在（404 对列表端点 = 路由缺失，不是业务 404）
  route_missing: { status: 404, body: JSON.stringify({ message: 'not found' }) },
  // 真·空列表：HTTP 200 + `[]` ⇒ 实例里就是没有内容
  empty_list: { status: 200, body: '[]' },
  with_data: { status: 200, body: JSON.stringify(ONE_ITEM_WIRE) },
};

const SKIP = Symbol('skip');

let harness: {
  browser: import('@playwright/test').Browser;
  origin: string;
  variant: Variant;
  close: () => Promise<void>;
} | null = null;

async function getHarness(t: any, variant: Variant) {
  if (harness && harness.variant === variant) return harness;
  if (harness) {
    await harness.close();
    harness = null;
  }
  if (!existsSync(join(NM, 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    throw SKIP;
  }
  const work = await mkdtemp(join(tmpdir(), 'fe-cas-states-'));
  const entryFile = join(work, '__probeCasStates-entry.tsx');
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
        lib: { entry: entryFile, formats: ['iife'], name: 'ProbeCasStates', fileName: () => 'probe.js' },
      },
    });
    ok = true;
  } finally {
    await rm(entryFile, { force: true });
    if (!ok) await rm(work, { recursive: true, force: true });
  }

  const jsPath = join(outDir, 'probe.js');
  const html =
    '<!doctype html><html><body><div id="root"></div><script src="/probe.js"></script></body></html>';
  const server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url.startsWith('/api/admin/cas/contents')) {
      const a = ANSWERS[variant];
      res.writeHead(a.status, { 'content-type': 'application/json; charset=utf-8' });
      res.end(a.body);
      return;
    }
    if (url.startsWith('/api/admin/cas/drives')) {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end('[]');
      return;
    }
    if (url === '/probe.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(readFileSync(jsPath));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  harness = {
    browser,
    origin: `http://127.0.0.1:${port}`,
    variant,
    close: async () => {
      await browser.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(work, { recursive: true, force: true });
    },
  };
  return harness;
}

async function openAndRead(t: any, variant: Variant) {
  let h: Awaited<ReturnType<typeof getHarness>>;
  try {
    h = await getHarness(t, variant);
  } catch (e) {
    if (e === SKIP) return null;
    throw e;
  }
  const page = await h.browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(String(e)));
  await page.goto(h.origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => (document.body.innerText || '').includes('CAS 内容列表'),
    undefined,
    { timeout: 20000 },
  );
  const text = (await page.evaluate(() => document.body.innerText || '')) as string;
  await page.close();
  return { text, errors };
}

test.after(async () => {
  if (harness) {
    const h = harness;
    harness = null;
    await h.close();
  }
});

/** 断言「不可用态」说了对的话、没说谎。 */
function expectUnavailableCopy(text: string, variant: Variant) {
  assert.match(
    text,
    /数据面在本实例不可用|数据面不可用/,
    `[${variant}] 必须显式提示「数据面不可用」（fail-closed，不伪装成正常空列表）。实际：${text.slice(-500)}`,
  );
  // ★主断言（G5 的「撒谎」部分）：不得再声称后端端点没做/未接线
  for (const lie of ['尚未接线', '未实现', '等待后端列表端点', '功能未开发', '后端列表端点（w02']) {
    assert.ok(
      !text.includes(lie),
      `[${variant}] 页面不得写「${lie}」—— 列表端点在 fmby-v2 已实现并入生产 router` +
        `（admin_cas.rs 的 cas_list_contents），这句话会让运维以为功能没做。实际：${text.slice(-500)}`,
    );
  }
  // 不可用 ≠ 空列表：两态必须分开
  assert.ok(
    !text.includes('后端返回空列表'),
    `[${variant}] 不可用态不得混入「后端返回空列表」（那是真·空列表才说的话）。实际：${text.slice(-400)}`,
  );
}

test('态 A：CAS 端口未装配（503）⇒ 说「数据面不可用」并给出可行动原因，不说「后端没做」', async (t) => {
  const r = await openAndRead(t, 'port_unassembled');
  if (!r) return;
  try {
    assert.deepEqual(r.errors, [], `探针页面不应抛错：${r.errors.join(' | ')}`);
    expectUnavailableCopy(r.text, 'port_unassembled');
    assert.match(
      r.text,
      /503|端口未装配/,
      `不可用提示须点明可行动原因（503 / CAS 端口未装配），而不是只说「未就绪」。实际：${r.text.slice(-500)}`,
    );
  } finally {
    await (harness as NonNullable<typeof harness>).close();
    harness = null;
  }
});

test('态 B：路由不存在（404，旧版本后端）⇒ 同一不可用态，原因写版本/路由而非「功能未做」', async (t) => {
  const r = await openAndRead(t, 'route_missing');
  if (!r) return;
  try {
    assert.deepEqual(r.errors, [], `探针页面不应抛错：${r.errors.join(' | ')}`);
    expectUnavailableCopy(r.text, 'route_missing');
    assert.match(
      r.text,
      /404|版本过旧|路由/,
      `404 态须点明「该实例没有这条路由 / 版本过旧」。实际：${r.text.slice(-500)}`,
    );
  } finally {
    await (harness as NonNullable<typeof harness>).close();
    harness = null;
  }
});

test('态 C：后端正常返回空列表 ⇒ 说「暂无 CAS 内容」，不得出现任何「不可用」提示', async (t) => {
  const r = await openAndRead(t, 'empty_list');
  if (!r) return;
  try {
    assert.deepEqual(r.errors, [], `探针页面不应抛错：${r.errors.join(' | ')}`);
    assert.match(
      r.text,
      /暂无 CAS 内容/,
      `真·空列表要说「暂无 CAS 内容」。实际：${r.text.slice(-400)}`,
    );
    assert.match(
      r.text,
      /后端返回空列表|确实没有 CAS 内容/,
      `并须点明这是后端给的空结果，不是取不到。实际：${r.text.slice(-400)}`,
    );
    // ★反向：空列表态绝不能挂「不可用」横幅（那才是把两态混起来）
    assert.ok(
      !/数据面不可用|数据面在本实例不可用/.test(r.text),
      `真·空列表不得渲染「数据面不可用」提示。实际：${r.text.slice(-400)}`,
    );
  } finally {
    await (harness as NonNullable<typeof harness>).close();
    harness = null;
  }
});

test('态 D：有数据 ⇒ 渲染真表格（反证这条链**确实已接线**，页面不是占位空壳）', async (t) => {
  const r = await openAndRead(t, 'with_data');
  if (!r) return;
  try {
    assert.deepEqual(r.errors, [], `探针页面不应抛错：${r.errors.join(' | ')}`);
    assert.ok(r.text.includes('7'), `应渲染 content_id=7 这一行。实际：${r.text.slice(0, 300)}`);
    assert.ok(
      r.text.includes('a'.repeat(64).slice(0, 16)),
      '应渲染指纹（sha256 前缀），证明数据来自后端回执。',
    );
    assert.ok(
      !/数据面不可用|暂无 CAS 内容/.test(r.text),
      `有数据时既不该报不可用、也不该报空列表。实际：${r.text.slice(-400)}`,
    );
    // 反向守卫（断言非 vacuous）：同一棵树只换后端回执，态 D 必须与态 C **渲染不同**。
    // 上面三条已分别要求「不可用」「暂无 CAS 内容」在场，本条要求两者**都不在**
    // ⇒ 四态互斥；若判据写空（例如恒真），这里就会出现「有数据仍报空列表」的红。
  } finally {
    await (harness as NonNullable<typeof harness>).close();
    harness = null;
  }
});

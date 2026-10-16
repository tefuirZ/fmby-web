/**
 * 安装向导**阶段唯一性 + 重启文案**回归探针（卡 FE-WIZARD-REGRESSION-TEST · 席位 w10）
 *
 * 用户线上实测撞到的两个缺陷（前端 UI 由 fe02 修；本文件负责**防它复发**）：
 *   ① `apply` 成功后「③ 管理员账号」表单段与「④ 完成安装」段**同时渲染**
 *      ⇒ 同一屏出现两遍凭据（可编辑的用户名/口令 + 只读回执）、两套编号；
 *      代码现场：`InstallPage.tsx:287`（`step === 'admin' ? <AdminFieldset/>`）与
 *      `InstallPage.tsx:341`（`apply.isSuccess ? <InstallCompletionPanel/>`）
 *      **同在 `<form>` 内、互不排斥**。
 *   ② 过渡页/核对页把「complete 落锁后**须重启**」写成硬话，而后端
 *      `install_flow::complete` 走**进程内热切换** ⇒ `restart_required:false`
 *      （`crates/fmby-v2-server/src/install_flow/mod.rs:753-761`，日志原文
 *      「无需重启」:751；模块头注释 :11-14 还专门警告「后端说不需重启、
 *      前端仍提示重启 = 自相矛盾」）。所以这不是**文案风格**问题，是**契约一致性**问题。
 *
 * ★为什么用真渲染 + 纯 DOM 计数，而不是源码文本断言：
 *   缺陷形状是「两个 JSX 分支同时为真」；文本断言只能钉住**某一种修法**（fe02 的分支
 *   尚未推 ⇒ 形状未知，我现在写死形状就是替他们做实现决定）。这里只数 DOM 事实
 *   （口令输入框个数、可编辑用户名框个数、圈号 legend 个数、「第 N / M 步」行数、
 *   重启字样），任何「让两段互斥」的修法都过；只有**继续同页共存**才会红。
 *
 * 形态沿用仓内既有 DOM 探针范式（`runtime-log-archives-empty-scroll.dom.test.ts` /
 *   `secrets-override-select.dom.test.ts`）：vite 打包 iife + `@playwright/test` Chromium，
 *   **零新增依赖**；entry 落 `os.tmpdir()`（仓库树 root:755，降权跑测写不进）；
 *   ★必须用**本地 http 服务器**供页（真 origin）——`page.setContent` 下
 *   `window.location.origin` 是 `about:blank`，`new URL('/api/..', origin)` 直接抛
 *   `Invalid base URL`（先例文件 :71-74 已记过一次），本探针会全部落到 isError 分支。
 *   收尾 `rm` **整棵** work（含构建失败路径 —— 本仓同类探针就在这条上漏过 /tmp）。
 *
 * 跑法：node --import ./tests/register-aliases.mjs --test tests/install-wizard-stage.dom.test.ts
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

const INSTALL_PAGE = pathToFileURL(join(HOST_ROOT, 'src/pages/install/InstallPage.tsx')).href;
const SESSION_PROVIDER = pathToFileURL(join(HOST_ROOT, 'src/session/SessionProvider.tsx')).href;

const USERNAME = 'probe_admin';
const PASSWORD = 'Str0ng#Passw0rd!x9';
/** 后端防误触的精确确认串（`INSTALL_COMPLETE_CONFIRM_ACTION`，shared 契约同一常量值）。 */
const CONFIRM_ACTION = 'complete-install';

/** apply/complete 故意**延迟**应答：过渡页只在 pending 期间存在，不拖就采不到那一帧。 */
const PENDING_DELAY_MS = 700;

/**
 * 探针：挂**真实的** SessionProvider（`InstallPage` 经 `useSession()` 取 `retryRestore`，
 * 不在 Provider 内会直接抛 `useSession 必须在 SessionProvider 内部使用`）
 * + QueryClientProvider + MemoryRouter。请求不页内 stub，由下面的本地服务器应答，
 * 这样 `window.location.origin` 构造出的 URL 与真浏览器一致。
 */
function probeEntry(): string {
  return `
import { createElement, useState } from '${nmUrl('react/index.js')}';
import { createRoot } from '${nmUrl('react-dom/client.js')}';
import { QueryClient, QueryClientProvider } from '${nmUrl('@tanstack/react-query/build/modern/index.js')}';
import { MemoryRouter } from '${nmUrl('react-router/dist/development/index.mjs')}';
import { SessionProvider } from '${SESSION_PROVIDER}';
import { InstallPage } from '${INSTALL_PAGE}';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function App() {
  return createElement(QueryClientProvider, { client: qc },
    createElement(MemoryRouter, null,
      createElement(SessionProvider, null, createElement(InstallPage))));
}

createRoot(document.getElementById('root')).render(createElement(App));
`;
}

/**
 * 「这一段在屏幕上出现了几次」的读数器（在浏览器里执行）。
 * 只数 DOM 事实：不依赖 CSS 类名、不依赖 ③/④ 这个字形本身。
 */
const READ = () => `
  (() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    const text = document.body.innerText || '';
    const legends = Array.from(document.querySelectorAll('legend'))
      .map((el) => (el.textContent || '').trim());
    return {
      text,
      legends,
      // 圈号编号（①②③④…）在场的小节：同一时刻至多一套 ⇒ >1 就是「两段同页」
      circleLegends: legends.filter((t) => /^[\\u2460-\\u2473]/.test(t)),
      // 「第 N / M 步」进度计数行：向导还在走才有意义；完成段再挂着 = 第二套编号
      stepCounter: (text.match(/第\\s*\\d+\\s*\\/\\s*\\d+\\s*步/g) || []).length,
      // ③ 表单在场的最硬证据：两个可写口令框（密码 + 再输一次）
      writablePassword: inputs.filter((el) => el.type === 'password' && !el.readOnly).length,
      // ④ 回执在场的最硬证据：只读口令展示框
      readonlyPassword: inputs.filter((el) => el.type === 'password' && el.readOnly).length,
      // 凭据回显次数：可编辑的用户名框 vs 只读回显
      editableUsername: inputs.filter((el) => el.value === '${USERNAME}' && !el.readOnly).length,
      readonlyUsername: inputs.filter((el) => el.value === '${USERNAME}' && el.readOnly).length,
    };
  })()
`;

type Read = {
  text: string;
  legends: string[];
  circleLegends: string[];
  stepCounter: number;
  writablePassword: number;
  readonlyPassword: number;
  editableUsername: number;
  readonlyUsername: number;
};

/** 装探针 + 起「真 origin」静态/接口服务器（一套共用，两个用例各开新页面）。 */
type Harness = {
  browser: import('@playwright/test').Browser;
  origin: string;
  close: () => Promise<void>;
};
let harness: Harness | null = null;

const SKIP = Symbol('skip');

/** 接口应答：安装模式进程的真形状（status 带 `state`；apply 平铺回执；complete 报 false）。 */
function answer(req: { url: string; method: string }): {
  status: number;
  body: string;
  delayMs?: number;
} | null {
  const { url } = req;
  if (url.startsWith('/api/install/status')) {
    return {
      status: 200,
      body: JSON.stringify({
        state: 'needs_database',
        database_configured: false,
        can_probe: true,
        completed: false,
      }),
    };
  }
  if (url.startsWith('/api/install/probe/')) {
    return { status: 200, body: JSON.stringify({ ok: true, kind: 'sqlite' }) };
  }
  if (url.startsWith('/api/install/apply')) {
    return {
      status: 200,
      delayMs: PENDING_DELAY_MS,
      body: JSON.stringify({
        applied: true,
        auto_login: true,
        kind: 'sqlite',
        id: 'usr_probe',
        username: USERNAME,
      }),
    };
  }
  if (url.startsWith('/api/install/complete')) {
    // ★后端真相：进程内热切换 ⇒ 不需要运维重启（mod.rs:753-761 写死 false）
    return { status: 200, delayMs: PENDING_DELAY_MS, body: JSON.stringify({ completed: true, restart_required: false }) };
  }
  if (url.startsWith('/api/auth/me')) {
    // 安装模式进程不挂 `/auth/me` ⇒ 404 是**预期**（SessionProvider 据此静默清会话）
    return { status: 404, body: JSON.stringify({ message: 'install mode' }) };
  }
  return null;
}

async function getHarness(t: any): Promise<Harness> {
  if (harness) return harness;
  if (!existsSync(join(NM, 'react'))) {
    t.skip('未安装 host 依赖（pnpm install 后重跑）');
    throw SKIP;
  }
  const work = await mkdtemp(join(tmpdir(), 'fe-wiz-stage-'));
  const entryFile = join(work, '__probeWizardStage-entry.tsx');
  const outDir = join(work, 'dist');
  await writeFile(entryFile, probeEntry(), 'utf8');
  let bundleOk = false;
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
          name: 'FeWizStage',
          fileName: () => 'probe.js',
        },
      },
    });
    bundleOk = true;
  } finally {
    await rm(entryFile, { force: true });
    // ★构建失败也要清整棵 work（本仓同类探针在「只删 outDir」上漏过 /tmp）。
    if (!bundleOk) await rm(work, { recursive: true, force: true });
  }

  const bundlePath = join(outDir, 'probe.js');
  const html =
    '<!doctype html><html><body><div id="root"></div>' +
    '<script src="/probe.js"></script></body></html>';
  const server = createServer((req, res) => {
    const api = answer({ url: req.url ?? '/', method: req.method ?? 'GET' });
    if (api) {
      const write = () => {
        res.writeHead(api.status, { 'content-type': 'application/json; charset=utf-8' });
        res.end(api.body);
      };
      if (api.delayMs) setTimeout(write, api.delayMs);
      else write();
      return;
    }
    if (req.url === '/probe.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(readFileSync(bundlePath));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  harness = {
    browser,
    origin: `http://127.0.0.1:${port}`,
    close: async () => {
      await browser.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(work, { recursive: true, force: true });
    },
  };
  return harness;
}

async function cleanupHarness() {
  if (harness) {
    const h = harness;
    harness = null;
    await h.close();
  }
}
test.after(async () => {
  await cleanupHarness();
});

/**
 * React 受控输入必须走原生 setter + `input` 事件，否则 `onChange` 不触发。
 * 浏览器侧无法把函数当参数传 ⇒ 这段 setter 写法在两个 filler 里各出现一次
 * （`ponytail:` 不为两行代码造 `new Function` 的间接层）。
 */

/**
 * 填管理员：按「legend 含『管理员』的小节」定位 ③ 段，段内取可写用户名框 + 两个口令框。
 * 定位写法与断言写法分开 ⇒ fe02 改属性/改文案不影响驱动。
 */
async function fillAdmin(page: any) {
  const done = await page.evaluate(
    ({ user, pass }: { user: string; pass: string }) => {
      const fill = (el: HTMLInputElement, val: string) => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )!.set!;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const fs = Array.from(document.querySelectorAll('fieldset')).find((el) =>
        (el.querySelector('legend')?.textContent || '').includes('管理员'));
      if (!fs) throw new Error('未找到管理员表单小节');
      const inputs = Array.from(fs.querySelectorAll('input'));
      const pw = inputs.filter((el) => el.type === 'password');
      const un = (fs.querySelector('input[autocomplete="username"]')
        || inputs.find((el) => el.type !== 'password' && !el.readOnly)) as HTMLInputElement | undefined;
      if (!un) throw new Error('未找到用户名输入框');
      if (pw.length < 2) throw new Error('③ 段应有密码 + 再输一次两个口令框，实际 ' + pw.length);
      fill(un, user);
      fill(pw[0], pass);
      fill(pw[1], pass);
      return true;
    },
    { user: USERNAME, pass: PASSWORD },
  );
  assert.ok(done, '应能填好 ③ 管理员表单');
}

/** 填「输入 complete-install 以确认」：优先 placeholder，退化到完成段内第一个可写非口令框。 */
async function fillConfirm(page: any) {
  await page.evaluate(
    (act: string) => {
      const fill = (el: HTMLInputElement, val: string) => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )!.set!;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      let el = document.querySelector(`input[placeholder="${act}"]`) as HTMLInputElement | null;
      if (!el) {
        const fs = Array.from(document.querySelectorAll('fieldset')).find((x) =>
          (x.textContent || '').includes('安装锁'));
        el = fs
          ? ((Array.from(fs.querySelectorAll('input')).find(
              (i) => i.type !== 'password' && !i.readOnly,
            ) as HTMLInputElement | undefined) ?? null)
          : null;
      }
      if (!el) throw new Error('未找到确认动作输入框');
      fill(el, act);
    },
    CONFIRM_ACTION,
  );
}

async function read(page: any): Promise<Read> {
  return (await page.evaluate(READ())) as Read;
}

/** 按**可见文案**点按钮（不依赖 class/实现细节）；找不到就明确报错，不静默跳过。 */
async function clickButton(page: any, re: RegExp) {
  const clicked = await page.evaluate((src: string) => {
    const rx = new RegExp(src);
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      rx.test((b.textContent || '').trim()));
    if (!btn) return false;
    btn.click();
    return true;
  }, re.source);
  assert.ok(clicked, `页面上应有文案匹配 ${re} 的按钮，实际没有`);
}

/** 每条用例都要走一遍的驱动：进到第 3 步（③ 管理员表单在场）并填好管理员。 */
async function openAdminStep(h: Harness) {
  const page = await h.browser.newPage();
  const problems: string[] = [];
  page.on('pageerror', (e: Error) => problems.push(String(e)));
  await page.goto(`${h.origin}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => (document.body.innerText || '').includes('安装向导'),
    undefined,
    { timeout: 20000 },
  );
  return { page, problems };
}

/** 第 1 步 → 第 2 步（服务器配置核对页）。 */
async function toServerStep(page: any) {
  await clickButton(page, /下一步/);
  await page.waitForFunction(
    () => (document.body.innerText || '').includes('生效值'),
    undefined,
    { timeout: 15000 },
  );
}

/** 第 2 步 → 第 3 步（③ 管理员表单在场）。 */
async function toAdminStep(page: any) {
  await clickButton(page, /下一步/);
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('input[type=password]')).length >= 2,
    undefined,
    { timeout: 15000 },
  );
}

test('阶段唯一性：每阶段只渲染该渲染的那一段（apply 成功后 ③ 表单必须让位、凭据只出现一次）', async (t) => {
  let h: Harness;
  try {
    h = await getHarness(t);
  } catch (e) {
    if (e === SKIP) return;
    throw e;
  }
  const { page, problems } = await openAdminStep(h);
  try {
    // —— 阶段 A：第 1 步（数据库 / 缓存）⇒ ③/④ 都不该在场
    const a = await read(page);
    assert.equal(a.writablePassword, 0, `阶段 A 不该有可写口令框：${JSON.stringify(a.legends)}`);
    assert.equal(
      a.readonlyPassword,
      0,
      '阶段 A 不该有完成段的只读口令展示：' + JSON.stringify(a.legends),
    );
    assert.equal(a.stepCounter, 1, '向导进行中应恰有一行「第 N / M 步」：' + JSON.stringify(a));
    assert.deepEqual(
      a.circleLegends,
      [],
      `阶段 A（① 页用小节标题不用圈号）不该出现圈号编号：${JSON.stringify(a.circleLegends)}`,
    );

    // —— 阶段 B：第 2 步「服务器配置」核对页 ⇒ 仍不该有 ③/④
    await toServerStep(page);
    const b = await read(page);
    assert.equal(b.writablePassword, 0, '阶段 B（核对页）不该渲染 ③ 表单：' + JSON.stringify(b.legends));
    assert.equal(b.readonlyPassword, 0, '阶段 B 不该渲染 ④ 完成段：' + JSON.stringify(b.legends));

    // —— 阶段 C：第 3 步 ⇒ ③ 在场（两个可写口令框），④ 不在场
    await toAdminStep(page);
    const c = await read(page);
    assert.equal(c.writablePassword, 2, `阶段 C 应恰好是 ③ 的两个可写口令框：${JSON.stringify(c)}`);
    assert.equal(
      c.readonlyPassword,
      0,
      '阶段 C（apply 还没成功）不该渲染 ④ 的只读展示：' + JSON.stringify(c.legends),
    );
    assert.equal(
      c.circleLegends.length,
      1,
      `阶段 C 应只有一节带圈号编号：${JSON.stringify(c.circleLegends)}`,
    );

    await fillAdmin(page);
    await clickButton(page, /应用安装并创建管理员/);

    // —— 阶段 D：apply 成功 ⇒ ④ 必须在场，③ 必须**让位**（用户实测撞到的正是共存）
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('input')).some((el) => el.readOnly),
      undefined,
      { timeout: 20000 },
    );
    const d = await read(page);
    assert.equal(
      d.readonlyPassword,
      1,
      `阶段 D 应有且仅有完成段的 1 个只读口令展示：${JSON.stringify(d)}`,
    );
    assert.equal(
      d.writablePassword,
      0,
      `★防复发主断言：apply 成功后「③ 管理员账号」表单段（两个可写口令框）必须让位；` +
        `非 0 = ③ 与 ④ 同页共存 = 凭据在同一屏出现两遍。实际读数：${JSON.stringify(d)}`,
    );
    assert.equal(
      d.editableUsername,
      0,
      `★防复发：可编辑的用户名框必须随 ③ 一起让位（否则用户名两遍）：${JSON.stringify(d)}`,
    );
    assert.equal(
      d.readonlyUsername,
      1,
      `凭据回执本身不得被删掉（用户名只读展示应恰好 1 处；修法不能是「两段都不渲染」）：${JSON.stringify(d)}`,
    );
    assert.ok(
      d.circleLegends.length <= 1,
      `★同一时刻至多一套圈号编号在场（③/④ 并存 = 2）：${JSON.stringify(d.circleLegends)}`,
    );
    assert.equal(
      d.stepCounter,
      0,
      `★完成段不得再挂「第 N / M 步」计数行 —— 向导已无步可走，留着就是第二套编号：${JSON.stringify(d)}`,
    );

    // —— 阶段 E：complete 成功后整个表单让位给完成横幅
    await fillConfirm(page);
    await clickButton(page, /标记安装完成|完成安装|落锁/);
    await page.waitForFunction(
      () => (document.body.innerText || '').includes('restart_required'),
      undefined,
      { timeout: 20000 },
    );
    const e = await read(page);
    assert.equal(e.writablePassword, 0, `阶段 E 仍不得出现 ③ 的可写口令框：${JSON.stringify(e)}`);
    assert.ok(
      e.circleLegends.length <= 1,
      `阶段 E 至多一节带圈号编号：${JSON.stringify(e.circleLegends)}`,
    );
  } finally {
    if (problems.length > 0) {
      // 探针自身的运行时异常不能被吞成「断言失败」—— 必须可见（rv01 #2 同口径）
      console.error('探针页面异常：\n' + problems.join('\n'));
    }
    await page.close();
  }
});

test('重启口径一致性：安装面不得把「落锁后须重启」写成硬话，且须如实显示 restart_required:false', async (t) => {
  let h: Harness;
  try {
    h = await getHarness(t);
  } catch (e) {
    if (e === SKIP) return;
    throw e;
  }
  const { page, problems } = await openAdminStep(h);
  try {
    /**
     * ★这是**契约一致性**断言，不是文案偏好：
     * `install_flow::complete` 落锁后走**进程内热切换**（`hot_switch.rs:1-9 / :35-44`），
     * 回执恒为 `restart_required:false`（`install_flow/mod.rs:753-761`），后端日志原文
     * 就是「无需重启」（:751）；模块头注释 :11-14 还专门警告「后端说不需重启、前端仍
     * 提示重启 = 自相矛盾（rb01 在 #23 抓过同类 Critical）」。
     * 允许的重启表述只有**失败兜底**那一句（切换失败 ⇒ 进程退出，锁已在盘，重启即进主应用）
     * ⇒ 断言只拦「须重启 / 需要重启 / 请重启」这种**无条件硬话**。
     */
    const assertNoRestartClaim = (label: string, text: string) => {
      for (const phrase of ['须重启', '需要重启', '请重启']) {
        assert.ok(
          !text.includes(phrase),
          `★${label} 不得声称「${phrase}」—— 后端 complete 走进程内热切换返回 ` +
            `\`restart_required:false\`（mod.rs:753-761），同页上文还写着「热加载 / 不需重启」⇒ 自相矛盾。` +
            `实际文案尾部：${text.slice(-300)}`,
        );
      }
      assert.match(
        text,
        /不[需需]要?重启|无需重启|不用重启/,
        `${label} 须保留「热加载 ⇒ 不需重启」的如实表述（不得反向删掉）`,
      );
    };

    // —— 第 2 步核对页（ServerConfigSummary）
    await toServerStep(page);
    assertNoRestartClaim('服务器配置核对页', (await read(page)).text);

    // —— 过渡页（InstallProgressScreen）：apply 在飞时整页是它，故必须**延迟应答**才采得到
    await toAdminStep(page);
    await fillAdmin(page);
    await clickButton(page, /应用安装并创建管理员/);
    await page.waitForFunction(
      () => (document.body.innerText || '').includes('正在应用安装配置'),
      undefined,
      { timeout: 5000 },
    );
    assertNoRestartClaim('应用安装过渡页', (await read(page)).text);

    // —— 完成横幅：restart_required 必须来自后端回执（页面原写法是 `?? true` 兜底）
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('input')).some((el) => el.readOnly),
      undefined,
      { timeout: 20000 },
    );
    await fillConfirm(page);
    await clickButton(page, /标记安装完成|完成安装|落锁/);
    await page.waitForFunction(
      () => (document.body.innerText || '').includes('restart_required'),
      undefined,
      { timeout: 20000 },
    );
    const done = (await read(page)).text;
    // ★断言**值**而不是断言排版：JSX 里 `restart_required =` 与插值分两行 ⇒ 渲染成
    //   「restart_required =false」（无空格）；写死空格会把这条变成排版快照。
    assert.match(
      done,
      /restart_required\s*=\s*false/,
      `完成横幅须如实显示后端回执 \`restart_required:false\`：${done.slice(-320)}`,
    );
    assert.ok(
      !/restart_required\s*=\s*true/.test(done),
      '完成横幅不得显示 `restart_required = true`（后端返回 false ⇒ 显示 true 就是把 `?? true` ' +
        '兜底当成真值，掩盖回执丢失）',
    );
  } finally {
    if (problems.length > 0) {
      console.error('探针页面异常：\n' + problems.join('\n'));
    }
    await page.close();
  }
});

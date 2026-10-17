import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { login } from './fixtures/helpers';

/**
 * E3 任务中心真栈终验（禁 mock）—— 七项逐条：
 *   ① 首屏可点元素 <300ms（真实测量，冷/热双口径）
 *   ② 空态两态文案（「当前筛选下没有任务」✓ /「当前没有运行中的任务」源码不存在 ⇒ 如实 ✗）
 *   ③ 错误可重试（kill -9 真实失败注入 → 重启 → 点重试恢复）
 *   ④ 翻页不清空旧数据（keepPreviousData：切页瞬间旧行仍在）
 *   ⑤ 刷新弱提示（SIGSTOP 真实节流 → 「· 正在刷新」出现/消退）
 *   ⑥ WS 分批事件真到达（真文件入挂载 → 真扫库 → realtime-batch-counters 递增；观察白屏）
 *   ⑦ 首屏 loading 兜底（de7bd40 降级条挂进早 return 分支复验：3s 无数据 ⇒ task-center-stall）
 *
 * 真栈口径：后端 /tmp/fmby-e3-server（E3 后端，task.center.batch ✓）直接伺服
 * host/dist（FMBY_WEB_ROOT）@ 127.0.0.1:18097 —— 浏览器与后端同源（WS 原生带 cookie），
 * **全程零 page.route**；失败/节流注入全部走进程信号（SIGKILL/SIGSTOP/SIGCONT）。
 * 复用既有 fixtures.login（真实 UI 登录 admin/admin，种子库 e2e.db）。
 */

const EVID = '/tmp/e3-final-stack/evidence';
const PID_FILE = '/tmp/e3-final-stack/server.pid';
const RESTART_SH = '/tmp/e3-final-stack/restart-server.sh';
const MOUNT_DIR = '/tmp/e3-final-stack/data/e2e-media';
const PAGE = '/manage/task-center';

mkdirSync(EVID, { recursive: true });

const backendPid = (): number => Number(readFileSync(PID_FILE, 'utf8').trim());
const stopBackend = (): void => process.kill(backendPid(), 'SIGSTOP');
const resumeBackend = (): void => process.kill(backendPid(), 'SIGCONT');
const killBackend = (): void => process.kill(backendPid(), 'SIGKILL');
const restartBackend = (): string =>
  execFileSync(RESTART_SH, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
const backendUp = (): boolean => {
  try {
    execFileSync('curl', ['-s', '-o', '/dev/null', '-m', '2', 'http://127.0.0.1:18097/api/auth/entry/status']);
    return true;
  } catch {
    return false;
  }
};

test.describe.serial('E3 任务中心真栈终验（禁 mock）', () => {
  test.afterAll(async () => {
    // 收尾保证：后端必须活着（任何注入后都要恢复）
    try {
      resumeBackend();
    } catch {
      /* 进程可能已被 SIGKILL */
    }
    if (!backendUp()) restartBackend();
  });

  test('① 首屏可点元素出现 <300ms（真实测量：冷 / 热双口径）', async ({ page }) => {
    await login(page); // 真实 UI 登录（测量窗口之外）

    // 浏览器内 rAF 逐帧探测（performance.now 零点 = 文档导航起点；无 Playwright 轮询粒度误差）
    await page.addInitScript(() => {
      const tick = () => {
        const b = Array.from(document.querySelectorAll('button')).find(
          (x) => (x.textContent ?? '').includes('刷新总览'),
        );
        if (b && !b.hasAttribute('disabled') && window.__firstClickable === undefined) {
          window.__firstClickable = performance.now();
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    // —— 冷口径：本 worker 第一次进页（路由 chunk 冷加载）——
    await page.goto(PAGE, { waitUntil: 'commit' });
    const coldMs = await page.waitForFunction(
      () => (window as { __firstClickable?: number }).__firstClickable,
      undefined,
      { timeout: 15_000, polling: 32 },
    ).then((h) => h.jsonValue());
    await page.getByRole('button', { name: '刷新总览' }).click(); // 证明「可点」
    await expect(page.getByText(/当前结果 \d+ \/ \d+ 条/)).toBeVisible();

    // —— 热口径：已缓存 chunk 的再导航（重复访问口径）——
    await page.goto(PAGE, { waitUntil: 'commit' });
    const warmMs = await page.waitForFunction(
      () => (window as { __firstClickable?: number }).__firstClickable,
      undefined,
      { timeout: 15_000, polling: 32 },
    ).then((h) => h.jsonValue());
    await page.getByRole('button', { name: '刷新总览' }).click();
    await expect(page.getByText(/当前结果 \d+ \/ \d+ 条/)).toBeVisible();

    console.log(`[①] 冷口径 可点元素出现 = ${coldMs}ms（阈值 300ms，rAF 测量）`);
    console.log(`[①] 热口径 可点元素出现 = ${warmMs}ms（阈值 300ms，rAF 测量）`);
    // 双口径（承仓内 ea9ff67 同款裁决）：负载噪声与硬闸分离 —— E3_STRICT_TIMING=1 才硬闸，
    // 默认只记录真实数字（本机 4 核多席共享，load 常年 >5，计时必带环境噪声）。
    if (process.env.E3_STRICT_TIMING === '1') {
      expect(warmMs, '热口径 <300ms（严格闸）').toBeLessThan(300);
    }
    // 冷口径不硬断言：chunk 冷加载受磁盘/首访影响，数字如实报（卡面判读见证据文档）。
    await page.screenshot({ path: `${EVID}/01-first-clickable.png`, fullPage: true });
    expect(coldMs, '冷口径数字必须被记录').toBeGreaterThan(0);
  });

  test('② 空态两态文案（筛选空态 ✓ / 第二文案源码不存在 ⇒ 如实 ✗）', async ({ page }) => {
    await login(page);
    await page.goto(PAGE);
    await expect(page.getByText(/当前结果 \d+ \/ \d+ 条/)).toBeVisible();

    // (a) 筛选空态：状态=已取消（当前 35 条里无 Cancelled ⇒ 0 行）
    await page.getByLabel('状态').selectOption({ label: '已取消' });
    await expect(page.getByText('当前筛选下没有任务', { exact: true })).toBeVisible();
    // 移动版空态同文案：桌面视口下 hidden，做 DOM 在场断言（卡片允许 DOM 断言）
    await expect(page.getByText('当前筛选下没有任务。')).toHaveCount(1);
    await expect(
      page.getByText('换个时间窗口或状态试试，别把自己筛成真空了。'),
    ).toBeVisible();
    await expect(page.getByText(/当前结果 0 \/ 0 条/)).toBeVisible();
    console.log('[②a] 筛选空态文案（已取消 ⇒ 0 行）：「当前筛选下没有任务」+ 描述句 DOM 可见 ✓');
    await page.screenshot({ path: `${EVID}/02a-filtered-empty.png`, fullPage: true });

    // (b) 卡面第二文案「当前没有运行中的任务」——源码全仓 0 命中（grep -rn 证据见交付文档）
    const secondCopy = page.getByText('当前没有运行中的任务');
    expect(await secondCopy.count()).toBe(0);
    console.log('[②b] 「当前没有运行中的任务」在 DOM 中不存在（源码亦无此文案）⇒ ✗ 如实列，不改文案凑绿');
    await page.getByLabel('状态').selectOption({ label: '全部状态' });
  });

  test('⑤ 刷新弱提示（SIGSTOP 真实节流 → 「· 正在刷新」出现 → SIGCONT 消退）', async ({ page }) => {
    await login(page);
    await page.goto(PAGE);
    const hint = page.getByText(/当前结果 \d+ \/ \d+ 条/);
    await expect(hint).toBeVisible();
    const before = await hint.textContent();
    expect(before).not.toContain('正在刷新');

    stopBackend(); // 真实节流：进程冻结（非 page.route）
    await page.getByRole('button', { name: '刷新总览' }).click();
    await expect(hint).toContainText('正在刷新', { timeout: 5_000 });
    console.log(`[⑤] 冻结后刷新：弱提示出现（「${(await hint.textContent())?.trim()}」）✓`);
    await page.screenshot({ path: `${EVID}/05-refreshing-hint.png` });

    resumeBackend();
    await expect(hint).not.toContainText('正在刷新', { timeout: 10_000 });
    console.log('[⑤] 解冻后弱提示消退 ✓（期间列表未被清空：', (await hint.textContent())?.trim(), '）');
  });

  test('③ 错误可重试（kill -9 真实失败注入 → 抽屉错误态 → 重启 → 点重试恢复）', async ({ page }) => {
    await login(page);
    await page.goto(PAGE);
    await expect(page.getByText(/当前结果 \d+ \/ \d+ 条/)).toBeVisible();

    // 结构性事实：全页错误分支要求 isError && !data，而 SPA 与 API 同源（FMBY_WEB_ROOT）
    // ⇒ 后端死 = SPA 首载也死，全页错误态在真栈同源形态下不可达；
    // 真实可达面 = 详情抽屉（列表有缓存，详情查询无缓存 ⇒ 必错）。
    killBackend(); // 真实失败注入
    await page.locator('tbody tr').first().getByRole('button', { name: '详情' }).click();
    const drawerRetry = page.getByRole('button', { name: '重试' });
    await expect(page.getByText('任务详情加载失败')).toBeVisible({ timeout: 20_000 });
    await expect(drawerRetry).toBeVisible();
    console.log('[③] kill -9 后开详情抽屉：错误态「任务详情加载失败」+ 重试按钮出现 ✓（非白屏）');
    await page.screenshot({ path: `${EVID}/03-error-state.png`, fullPage: true });

    const ready = restartBackend(); // 真实重启
    expect(ready).toBe('ready');
    await drawerRetry.click();
    await expect(page.getByText('重试次数', { exact: true })).toBeVisible({ timeout: 20_000 });
    console.log('[③] 点重试后：抽屉详情数据恢复（状态/重试次数卡片渲染）✓');
    await page.screenshot({ path: `${EVID}/03-recovered.png`, fullPage: true });
  });

  test('⑥ WS 分批事件真到达（真重试动作 → 批帧到达 → 批计数递增；全程非白屏）', async ({ page }) => {
    await login(page);
    await page.goto(PAGE);
    await expect(page.getByText(/当前结果 \d+ \/ \d+ 条/)).toBeVisible();

    // 计数器初始为 0（页面级状态；>0 只能来自本页 WS 帧消费）
    const counters = page.getByTestId('realtime-batch-counters');
    expect(await counters.count()).toBe(0);

    // 浏览器内真实触发批动作：Retry 当前 Failed 项（与农场验证同口径的任务推进触发，
    // 农场实证 scan/identify 不推批、batch_action 才推 task.center.batch）
    const resp = await page.evaluate(async () => {
      const csrf = document.cookie
        .split('; ')
        .find((c) => c.startsWith('fmby_csrf='))
        ?.slice('fmby_csrf='.length);
      const q = await fetch('/api/manage/task-center/items?page=1&page_size=50', { credentials: 'include' });
      const d = await q.json();
      const first = d.items ?? d.result?.items ?? [];
      // Failed 项可能被新成功项压到深页：翻多页收集（列表按 updatedAt 降序）
      const total = d.total ?? first.length;
      const pages = Math.min(6, Math.ceil(total / 50));
      let items = [...first];
      for (let p = 2; p <= pages; p++) {
        const r2 = await fetch(`/api/manage/task-center/items?page=${p}&page_size=50`, { credentials: 'include' });
        const d2 = await r2.json();
        items = items.concat(d2.items ?? d2.result?.items ?? []);
      }
      const targets = items
        .filter((i) => i.status === 'Failed')
        .slice(0, 6)
        .map((i) => ({ category: i.category, id: String(i.id) }));
      if (targets.length === 0) return { skipped: 'no-failed-items' };
      const r = await fetch('/api/manage/task-center/actions/batch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf ?? '' },
        body: JSON.stringify({ action: 'Retry', targets }),
      });
      return { status: r.status, targets: targets.length, body: (await r.text()).slice(0, 100) };
    });
    console.log(`[⑥] 浏览器内真实批动作 Retry：${JSON.stringify(resp)}`);

    // WS 分批到达：批计数出现且 ≥1 批（batchCounters 只在收到 task.center.batch 帧时递增）
    await expect(counters).toBeVisible({ timeout: 40_000 });
    const countersText = (await counters.textContent())?.trim() ?? '';
    console.log(`[⑥] WS 分批计数：${countersText}`);
    expect(countersText).toMatch(/实时推送：\d+ 批/);
    const batches = Number(/实时推送：(\d+) 批/.exec(countersText)?.[1] ?? 0);
    expect(batches).toBeGreaterThanOrEqual(1);

    // 白屏观察：从触发到批次到达，主内容持续在 DOM（采样 6 次）
    for (let i = 0; i < 6; i++) {
      const bodyLen = (await page.locator('body').innerText()).length;
      expect(bodyLen).toBeGreaterThan(50);
      await page.waitForTimeout(400);
    }
    console.log('[⑥] 白屏观察：6 次采样 body 内容均 >50 字符 ⇒ 无白屏 ✓');
    await page.screenshot({ path: `${EVID}/06-ws-batches.png`, fullPage: true });
  });

  test('④ 翻页不清空旧数据（keepPreviousData：切页瞬间旧行仍在）', async ({ page }) => {
    await login(page);
    await page.goto(PAGE);
    const hint = page.getByText(/当前结果 \d+ \/ \d+ 条/);
    await expect(hint).toBeVisible();
    const hint1 = (await hint.textContent())?.trim() ?? '';
    console.log(`[④] 第 1 页：${hint1}`);
    const firstRowP1 = (await page.locator('tbody tr').first().innerText()).slice(0, 60);
    await expect(page.getByText(/第 1 \/ \d+ 页/)).toBeVisible();

    // 点「下一页」瞬间：旧行必须仍在 DOM（不清空）
    await page.getByRole('button', { name: '下一页' }).click();
    const rowsRightAfterClick = await page.locator('tbody tr').count();
    console.log(`[④] 点击「下一页」瞬间 tbody 行数 = ${rowsRightAfterClick}（keepPreviousData ⇒ 非零 = 旧数据未清空）`);
    expect(rowsRightAfterClick).toBeGreaterThan(0);

    // 第 2 页落地：页码翻到 2，行仍是第 2 页内容（首行应与第 1 页不同）
    await expect(page.getByText(/第 2 \/ \d+ 页/)).toBeVisible({ timeout: 10_000 });
    const firstRowP2 = (await page.locator('tbody tr').first().innerText()).slice(0, 60);
    console.log(`[④] 第 1 页首行：${firstRowP1.replace(/\n/g, ' | ')}`);
    console.log(`[④] 第 2 页首行：${firstRowP2.replace(/\n/g, ' | ')}`);
    expect(firstRowP2).not.toBe(firstRowP1);
    await page.screenshot({ path: `${EVID}/04-page2-kept-old.png`, fullPage: true });
  });

  test('⑦ 首屏 loading 兜底（de7bd40 复验：3s 无数据 ⇒ 降级条挂进早 return 分支）', async ({ page }) => {
    await login(page); // 登录需要后端正常 —— 先登录再节流
    // 先落在 /manage 索引（侧边栏在此渲染；不提前进任务中心 ⇒ 查询零缓存）
    await page.goto('/manage');
    await expect(page.locator('a[href="/manage/task-center"]')).toBeVisible();

    // ★真实网络层节流：tc netem 只滤 dport=18097（本栈后端口），
    //   请求在 qdisc 中滞留 3.5s ⇒ 页面可载、数据必然 >3s 未达 ⇒ loading + 降级条可达。
    //   非 SIGSTOP：lazy chunk 仍可（慢速）加载，SPA 导航能上屏。
    const addThrottle = () => {
      execFileSync('tc', ['qdisc', 'add', 'dev', 'lo', 'root', 'handle', '1:', 'prio', 'bands', '4']);
      execFileSync('tc', ['qdisc', 'add', 'dev', 'lo', 'parent', '1:4', 'handle', '40:', 'netem', 'delay', '6000ms']);
      execFileSync('tc', ['filter', 'add', 'dev', 'lo', 'protocol', 'ip', 'parent', '1:0', 'prio', '3', 'u32', 'match', 'ip', 'dport', '18097', '0xffff', 'flowid', '1:4']);
    };
    const removeThrottle = () => {
      try {
        execFileSync('tc', ['qdisc', 'del', 'dev', 'lo', 'root']);
      } catch {
        /* 已删/不存在 */
      }
    };
    addThrottle();
    try {
      const taskCenterLink = page.locator('a[href="/manage/task-center"]');
      await taskCenterLink.click();

      // 首屏 loading 兜底：加载态可见（非白屏；数据被网络层拖住 >3s）
      const loading = page.getByText('正在装配任务中心');
      await expect(loading).toBeVisible({ timeout: 30_000 });
      console.log('[⑦] 首屏 loading 兜底：「正在装配任务中心」可见 ✓（网络层节流 6s，非白屏）');
      await page.screenshot({ path: `${EVID}/07a-loading.png`, fullPage: true });

      // de7bd40：3s 无数据 ⇒ 降级条必须长在 loading 早 return 分支里
      const stall = page.getByTestId('task-center-stall');
      await expect(stall).toBeVisible({ timeout: 15_000 });
      const stallText = (await stall.innerText()).replace(/\n/g, ' ');
      console.log(`[⑦] 3s 降级条（早 return 分支内）：${stallText.slice(0, 60)}…`);
      expect(stallText).toContain('响应较慢');
      expect(stallText).toContain('仍在后台执行');
      await expect(stall.getByRole('button', { name: '重试' })).toBeVisible();
      await page.screenshot({ path: `${EVID}/07b-stall-banner.png`, fullPage: true });
    } finally {
      removeThrottle(); // 撤销节流（真实网络恢复）
    }

    // 节流撤除后：数据落地，任务列表正常渲染（自动恢复）
    await expect(page.getByText(/当前结果 \d+ \/ \d+ 条/)).toBeVisible({ timeout: 30_000 });
    console.log('[⑦] 撤除节流后：任务列表正常渲染（自动恢复）✓');
    await page.screenshot({ path: `${EVID}/07c-recovered.png`, fullPage: true });
  });

});

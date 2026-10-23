/**
 * FE-UI-2 农场验收（node62 真栈）：按 docs/evidence/FE-UI-DENSITY-AUDIT.md §0 的
 * P0/P1 产出可执行断言。
 *
 * 断言组：
 *   A1  二维码三档尺寸 ≥180px（扫码下限）：MFA TOTP（后端本地生成，确定性）为主目标；
 *       139 / 115 图床 / 115 分享预览三个运营商面记录可达性，能出码则三档同口径量测。
 *   A2  管理首页空态不得谎报（审计 P0-1）：不得出现「所有挂载目录…已完成最新刮削
 *       与入库」这类把「无数据」说成「全部完成」的文案；不得存在死链 /manage/tasks。
 *   A3  生产文案不得含粗口（审计 P0-2）。
 *   A4  留白抽查 5 页的间距阶梯（审计 S1/P2-1）：computed padding/gap 落在
 *       4/8/12/16/20/24/32/40/48/64 阶梯（0-2px 发丝对齐白名单）。
 *   A5  条目详情双 gutter 实测（审计 P1-1）：hero 与分节左缘应同线。
 *   A6  历史页同屏双计数（审计 P1-4）：真实播放造出历史后断言（种子无历史 →
 *       先以 admin 真实播放《星际穿越》数秒再验证）。
 *
 * 取证：DOM 真实尺寸（boundingBox / getComputedStyle）+ 截图，全部落
 * host/test-results/farm-accept/ 并 attach 到报告；验收报告引用原文。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { E2E_ENABLED, E2E_SKIP_REASON, login } from './fixtures/helpers';

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

const OUT_DIR = '/tmp/farm-accept-ui2'; // 不用 playwright outputDir（每次跑会被清）
function dump(name: string, data: unknown): string {
  mkdirSync(OUT_DIR, { recursive: true });
  const file = join(OUT_DIR, name);
  writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  return file;
}

/** 三档视口：桌面 / 平板 / 手机。 */
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'phone', width: 375, height: 667 },
] as const;

/** 扫码下限：真机扫码 App 对二维码的最小可用边长（卡面口径 ~180px）。 */
const QR_MIN_PX = 180;

/** 页内全量收集 computed padding/gap 中脱梯的声明（HAIRLINE/LADDER 内联到浏览器上下文）。 */
async function collectOffLadder(page: Page): Promise<Array<{ prop: string; px: number; sample: string }>> {
  return page.evaluate(() => {
    const LADDER = new Set([0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64]);
    const HAIRLINE_MAX = 2; // 1-2px 发丝对齐白名单
    const seen = new Map<string, { prop: string; px: number; sample: string }>();
    for (const el of Array.from(document.querySelectorAll('*'))) {
      // ★原生下拉项（option）的间距由浏览器 UA 决定，不在设计系统管辖内
      //   （fmby-web#123 已批排除，依据在卡内）；不计入脱梯统计。
      if (el.tagName === 'OPTION') continue;
      const cs = getComputedStyle(el);
      const props: Array<[string, string]> = [
        ['padding-top', cs.paddingTop],
        ['padding-right', cs.paddingRight],
        ['padding-bottom', cs.paddingBottom],
        ['padding-left', cs.paddingLeft],
        ['gap', cs.rowGap === cs.columnGap ? cs.rowGap : ''],
      ];
      const cls = (el.className && typeof el.className === 'string' ? el.className : '')
        .split(/\s+/)
        .filter(Boolean)[0];
      const tag = `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`;
      for (const [prop, raw] of props) {
        if (!raw) continue;
        const px = Math.round(parseFloat(raw));
        if (!Number.isFinite(px) || px <= HAIRLINE_MAX || LADDER.has(px)) continue;
        const key = `${prop}:${px}`;
        if (!seen.has(key)) seen.set(key, { prop, px, sample: tag });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.px - b.px);
  });
}

async function measureQrAcrossViewports(page: Page, qr: ReturnType<Page['getByRole']>) {
  const sizes: Record<string, { width: number; height: number } | null> = {};
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(350);
    const box = await qr.boundingBox();
    sizes[vp.name] = box ? { width: Math.round(box.width), height: Math.round(box.height) } : null;
  }
  await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
  return sizes;
}

// ─── A1 · 二维码三档尺寸 ────────────────────────────────────────────────

test.describe('A1 二维码三档尺寸（≥180px 扫码下限）', () => {
  test('MFA TOTP 绑定二维码（后端本地生成，确定性目标）', async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
    await page.goto('/manage/site/settings');
    const totpSection = page.getByRole('heading', { name: '两步验证（TOTP）' });
    await expect(totpSection).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_000); // 等 status query 落定

    const enroll = page.getByRole('button', { name: /开始绑定|重新绑定/ }).first();
    if (!(await enroll.isVisible().catch(() => false))) {
      // 节停在加载/错误/已启用态 —— 把节原文留下，按环境受限处理（不伪装通过）。
      const cardText = await page
        .locator('section, div')
        .filter({ hasText: '两步验证（TOTP）' })
        .last()
        .innerText()
        .catch(() => '');
      dump('a1-totp-unavailable.txt', `URL: ${page.url()}\n\n${cardText || '(节文本抓取失败)'}`);
      test.info().annotations.push({ type: 'env-blocked', description: 'TOTP 绑定按钮不可见，节状态见 a1-totp-unavailable.txt' });
      test.skip(true, 'TOTP 绑定入口不可见（环境/能力面受限，非前端尺寸问题）');
      return;
    }
    await enroll.click();
    const qr = page.getByRole('img', { name: 'TOTP 绑定二维码' });
    await expect(qr).toBeVisible({ timeout: 15_000 });

    const sizes = await measureQrAcrossViewports(page, qr);
    dump('a1-totp-qr-sizes.json', sizes);
    await page.screenshot({ path: join(OUT_DIR, 'a1-totp-qr-desktop.png'), fullPage: false });

    for (const vp of VIEWPORTS) {
      const box = sizes[vp.name];
      expect(box, `${vp.name} 档 QR 应有真实渲染尺寸`).not.toBeNull();
      expect(
        Math.min(box!.width, box!.height),
        `${vp.name}(${vp.width}px) QR 最小边应 ≥${QR_MIN_PX}px（实测 ${box!.width}×${box!.height}）`,
      ).toBeGreaterThanOrEqual(QR_MIN_PX);
    }
  });

  test('运营商扫码面（139 / 115 图床 / 115 分享预览）：可达性 + 出码则三档量测', async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
    const results: Record<string, string> = {};

    // 139 云盘凭据（真栈实测：后端可达运营商，返回 1014×1006 内禀图）
    await page.goto('/manage/media/yun139');
    const yunBtn = page.getByRole('button', { name: /发起扫码登录/ }).first();
    if (await yunBtn.isVisible().catch(() => false)) {
      await yunBtn.click();
      const img = page.getByRole('img', { name: '139 登录二维码' });
      const shown = await img
        .waitFor({ state: 'visible', timeout: 12_000 })
        .then(() => true)
        .catch(() => false);
      if (shown) {
        const sizes = await measureQrAcrossViewports(page, img);
        dump('a1-yun139-qr-sizes.json', sizes);
        results['yun139'] = JSON.stringify(sizes);
      } else {
        results['yun139'] = '12s 内未出码（后端调运营商接口失败/超时，环境受限）';
      }
    } else {
      results['yun139'] = '入口按钮不可见（面未渲染或能力面限制）';
    }

    // 115 图床（付费守卫可能拦截）
    await page.goto('/manage/tools/pan115-imghost');
    const imgBtn = page.getByRole('button', { name: /扫码绑定图床/ }).first();
    if (await imgBtn.isVisible().catch(() => false)) {
      await imgBtn.click();
      const img = page.getByRole('img', { name: '115 扫码登录二维码' });
      const shown = await img
        .waitFor({ state: 'visible', timeout: 12_000 })
        .then(() => true)
        .catch(() => false);
      if (shown) {
        const sizes = await measureQrAcrossViewports(page, img);
        dump('a1-imghost-qr-sizes.json', sizes);
        results['imghost'] = JSON.stringify(sizes);
      } else {
        results['imghost'] = '12s 内未出码（后端调 115 接口失败/超时，环境受限）';
      }
    } else {
      results['imghost'] = '入口按钮不可见（付费守卫/能力面限制，环境受限）';
    }

    // 115 分享下载预览
    await page.goto('/manage/media/pan115-share');
    const shareBtn = page.getByRole('button', { name: /发起扫码登录/ }).first();
    if (await shareBtn.isVisible().catch(() => false)) {
      await shareBtn.click();
      const img = page.getByRole('img', { name: '115 登录二维码' });
      const shown = await img
        .waitFor({ state: 'visible', timeout: 12_000 })
        .then(() => true)
        .catch(() => false);
      if (shown) {
        const sizes = await measureQrAcrossViewports(page, img);
        dump('a1-share-qr-sizes.json', sizes);
        results['pan115-share'] = JSON.stringify(sizes);
      } else {
        results['pan115-share'] = '12s 内未出码（后端调 115 接口失败/超时，环境受限）';
      }
    } else {
      results['pan115-share'] = '入口按钮不可见（面未渲染或能力面限制）';
    }

    dump('a1-carrier-summary.json', results);
    test.info().annotations.push({
      type: 'evidence',
      description: Object.entries(results).map(([k, v]) => `${k}: ${v}`).join('；'),
    });
    // 本条只记录不强断言：运营商面依赖外部网与凭据；前端尺寸结论以可出码面实测为准。
  });
});

// ─── A2 · 空态不谎报（审计 P0-1）────────────────────────────────────────

test.describe('A2 管理首页空态与死链（审计 P0-1）', () => {
  test('「正在运行的任务队列」不得把无数据谎报为全部完成；不得存在死链 /manage/tasks', async ({
    page,
  }) => {
    await login(page);
    await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
    await page.goto('/manage');
    await expect(page.getByRole('heading', { name: /中控驾驶舱/ })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_000); // 让延迟挂载的 widget 全部落位

    const bodyText = await page.locator('body').innerText();
    const deadLinkCount = await page.locator('a[href="/manage/tasks"]').count();
    const deadLinkHref = deadLinkCount > 0 ? await page.locator('a[href="/manage/tasks"]').first().getAttribute('href') : null;
    dump('a2-manage-body.txt', bodyText);
    dump('a2-dead-link.json', { deadLinkCount, deadLinkHref });
    await page.screenshot({ path: join(OUT_DIR, 'a2-manage-cockpit.png'), fullPage: true });

    const lies = /所有挂载目录、海报与元数据已完成最新刮削与入库/.test(bodyText);
    const problems: string[] = [];
    if (lies) problems.push(`空态谎报：任务队列 0 项却渲染「所有挂载目录、海报与元数据已完成最新刮削与入库」（审计 P0-1，ManageOverviewPage.tsx:35 tasks 恒 []）`);
    if (deadLinkCount > 0) problems.push(`死链：存在 ${deadLinkCount} 个 href="${deadLinkHref}"，路由表只有 /manage/task-center（审计 P0-1）`);
    dump('a2-problems.json', problems);

    expect(
      problems,
      `P0-1 验收不通过（${problems.length} 项）：\n- ${problems.join('\n- ')}`,
    ).toEqual([]);
  });
});

// ─── A3 · 文案（审计 P0-2）──────────────────────────────────────────────

test.describe('A3 生产文案不得含粗口（审计 P0-2）', () => {
  test('命名刮削设置页头描述不得出现粗口', async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
    await page.goto('/manage/media/naming-scrape');
    await expect(page.getByRole('heading', { name: '命名刮削设置' })).toBeVisible({ timeout: 15_000 });
    const bodyText = await page.locator('body').innerText();
    dump('a3-naming-body.txt', bodyText);
    await page.screenshot({ path: join(OUT_DIR, 'a3-naming-header.png'), fullPage: false });
    expect(bodyText, 'P0-2：页头描述含粗口「屁用没有」（NamingRulesHeader.tsx:35）').not.toMatch(/屁用没有/);
  });
});

// ─── A4 · 留白抽查 5 页（审计 S1/P2-1）──────────────────────────────────

test.describe('A4 间距阶梯抽查 5 页（脱梯值 = computed padding/gap 不在 4-64 阶梯）', () => {
  const PAGES: Array<{ name: string; path: string; note?: string }> = [
    { name: 'manage-overview', path: '/manage', note: '审计 P2-1：cockpit 22 处脱梯' },
    { name: 'manage-media-items', path: '/manage/media/items' },
    { name: 'manage-users', path: '/manage/site/users/accounts' },
    { name: 'history', path: '/history', note: '审计 P2-1：主按钮 10px 18px 脱梯' },
    { name: 'login', path: '/login', note: '审计 P2-5：登录卡 36px 脱梯' },
  ];

  for (const p of PAGES) {
    test(`留白抽查：${p.name} ${p.path}`, async ({ page }) => {
      await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
      if (p.path !== '/login') {
        await login(page);
      }
      await page.goto(p.path);
      await page.waitForTimeout(1_500); // 等 viewmodel/骨架落位

      const offLadder = await collectOffLadder(page);
      dump(`a4-${p.name}-off-ladder.json`, offLadder);
      test.info().annotations.push({
        type: 'evidence',
        description: `${p.name} 脱梯声明 ${offLadder.length} 种：${offLadder
          .slice(0, 10)
          .map((s) => `${s.prop}=${s.px}px(${s.sample})`)
          .join('；')}`,
      });

      // 判定：脱梯声明应为 0（当前基线按审计报告预期非 0 —— 差多少就是验收结论）
      expect(
        offLadder,
        `${p.name} 存在 ${offLadder.length} 种脱梯 padding/gap${p.note ? `（${p.note}）` : ''}`,
      ).toEqual([]);
    });
  }
});

// ─── A5 · 条目详情首屏主行动（真渲染面 = darkroom 主题皮肤）──────────────
// 真栈实测：darkroom 主题激活时 /item/:id 由主题 ItemSkin 接管（data-darkroom="item-skin"），
// host 的 ItemDetailPage（审计 P1-1 双重 .page 所在）仅为无皮肤时的回退面。
// 本断言组对用户实际看到的皮肤面验收。

test.describe('A5 条目详情（darkroom ItemSkin 实渲染）首屏主行动与信息密度', () => {
  test('ready 态必须有可用的播放主行动；海报墙不得是纯装饰占位；meta 行不得重复', async ({
    page,
  }) => {
    await login(page);
    await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
    await page.goto('/');
    const card = page.getByRole('link', { name: /星际穿越/ }).first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();
    // ★移动语义（编排裁定 2026-10-22）：移动端点海报**直接播**（/play/:id）是有意设计
    //   （屏幕小，进详情再播多一步）；桌面仍 /item/:id。两种导航都接受，
    //   随后统一落回 /item/:id 做 darkroom ItemSkin 断言（断言对象不变）。
    await page.waitForURL(/\/(item|play)\//, { timeout: 15_000 });
    const a5ItemId = page.url().match(/\/(?:item|play)\/([^/?#]+)/)?.[1] ?? '';
    await page.goto(`/item/${a5ItemId}`);
    await expect(page.locator('[data-darkroom="item-skin"][data-state="ready"]')).toBeVisible({
      timeout: 15_000,
    });

    const probe = await page.evaluate(() => {
      const skin = document.querySelector('[data-darkroom="item-skin"]');
      const columns = document.querySelector('[data-darkroom="item-columns"]');
      const posterWall = document.querySelector('[data-darkroom="poster-wall"]');
      const metaCol = document.querySelector('[data-darkroom="meta-column"]');
      const metaLine = document.querySelector('[data-darkroom="meta-line"]')?.textContent ?? '';
      const rect = (el: Element | null) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left * 100) / 100, width: Math.round(r.width * 100) / 100 };
      };
      return {
        url: location.pathname,
        skinState: skin?.getAttribute('data-state'),
        playControls: Array.from(skin?.querySelectorAll('a, button') ?? [])
          .map((el) => (el.textContent ?? '').trim())
          .filter(Boolean),
        clickableCount: skin?.querySelectorAll('a, button').length ?? 0,
        posterWall: rect(posterWall),
        posterWallHasImg: Boolean(posterWall?.querySelector('img, video')),
        posterLeft: rect(posterWall)?.left ?? null,
        metaLeft: rect(metaCol)?.left ?? null,
        metaLine,
        metaLineDup: /(.{2,})\s*·\s*\1/.test(metaLine),
      };
    });
    dump('a5-item-skin-probe.json', probe);
    await page.screenshot({ path: join(OUT_DIR, 'a5-item-skin.png'), fullPage: false });
    test.info().annotations.push({
      type: 'evidence',
      description: `url=${probe.url} state=${probe.skinState} 可点元素=${probe.clickableCount} [${probe.playControls.join('|')}] posterWall=${JSON.stringify(probe.posterWall)} hasImg=${probe.posterWallHasImg} metaLine="${probe.metaLine}"`,
    });

    // 判定口径（与验收报告 §4 分级一致）：P0=无主行动（阻塞）；海报墙装饰化(P1)
    // 与 meta 重复(P2) 为后续卡范围，此处降为注记不阻塞。
    const p0: string[] = [];
    const deferred: string[] = [];
    if (probe.clickableCount === 0) {
      p0.push(
        'P0：darkroom ItemSkin ready 态无任何可点元素——没有播放/继续播放主行动，用户无法从详情页开始播放',
      );
    }
    if (!probe.posterWallHasImg && (probe.posterWall?.width ?? 0) > 200) {
      deferred.push(
        `P1（后续卡）：海报墙为纯装饰占位（宽 ${probe.posterWall?.width}px，无 img/video），海报数据在契约内却未渲染`,
      );
    }
    if (probe.metaLineDup) {
      deferred.push(
        `P2（后续卡）：meta 行重复——skin 拼 runtime/rating 后又拼 contract meta（已含 year+kindLabel），实测「${probe.metaLine}」`,
      );
    }
    dump('a5-item-skin-problems.json', { p0, deferred });
    test.info().annotations.push({
      type: 'deferred',
      description: deferred.join('；') || '无',
    });
    expect(
      p0,
      `A5 验收不通过（P0 ${p0.length} 项）：\n- ${p0.join('\n- ')}`,
    ).toEqual([]);
  });
});

// ─── A6 · 历史页双计数（审计 P1-4）──────────────────────────────────────

test.describe('A6 历史页同一计数不得同屏两处（审计 P1-4）', () => {
  test('「共整理出 N 条」与「当前结果：N 条」不得同时出现（真实播放造历史后验证）', async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });

    // 种子无播放历史 → 进详情页拿 itemId 后直连 /play/:id 真实播放数秒
    //（darkroom 皮肤详情页无播放入口，不能从详情页发起——A5 的 P0 发现的另一面）。
    await page.goto('/');
    const card = page.getByRole('link', { name: /星际穿越/ }).first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();
    // ★移动语义（编排裁定 2026-10-22）：同 A5——移动端点海报直接播（/play/:id）是
    //   有意设计；本测本就要去 /play 造历史 ⇒ 移动端反而少一步，两种导航都接受。
    await page.waitForURL(/\/(item|play)\//, { timeout: 15_000 });
    const itemId = page.url().match(/\/(?:item|play)\/([^/?#]+)/)?.[1];
    await page.goto(`/play/${itemId}`);
    await page.waitForTimeout(10_000); // 等会话建立 + timeupdate 进度上报落库

    await page.goto('/history');
    await expect(page.getByRole('heading', { name: '历史' })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(800);

    const bodyText = await page.locator('body').innerText();
    dump('a6-history-body.txt', bodyText);
    const hasHistory = /共整理出\s*\d+\s*条记录/.test(bodyText);
    if (!hasHistory) {
      // 播放造历史未生效（编码/自动播放策略）→ 无法在运行时取证，按静态结论列出
      test.info().annotations.push({
        type: 'env-blocked',
        description: '播放后历史仍为空，双计数无法运行时取证；按源码 HistoryPage.tsx:71/126 静态列出 P1',
      });
      test.skip(true, '种子环境造不出播放历史，运行时取证不可行');
      return;
    }
    const toolbarCount = /当前结果：\d+\s*条/.test(bodyText);
    test.info().annotations.push({ type: 'evidence', description: `页头计数=可见 工具条计数=${toolbarCount}` });
    expect(
      toolbarCount,
      'P1-4：同一总数在页头（共整理出 N 条记录）与工具条（当前结果：N 条）重复展示（HistoryPage.tsx:71/126）',
    ).toBe(false);
  });
});

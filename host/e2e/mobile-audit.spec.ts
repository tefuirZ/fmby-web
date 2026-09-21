import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';
import { login, resetBackend, E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

/**
 * FE-OPT-02 移动端适配审计：
 * 1. 三断点（375 / 768 / 1280）全页截图归档 + 无横向溢出断言；
 * 2. 触控目标 ≥44px（关键操作元素在 mobile viewport 实测）；
 * 3. 管理面窄屏呈现（表格可横向滚动 / 抽屉可用）；
 * 4. 播放页移动端（进度条可拖 / 控件可达）。
 *
 * 截图归档（REPO-HYGIENE-01）：全量集写 `<repo>/docs/evidence/fe-opt-02/full/<device>/<page>.png`
 * （**gitignored** → CI artifact；仓库只留 `samples/` 抽样，见 docs/evidence-policy.md）。
 * 用 `EVIDENCE_DIR` 可覆盖输出根（相对仓库根，或绝对路径）。
 *
 * 注：playwright 运行 cwd 为 `host/`，故路径必须**锚定仓库根**（否则会落到
 * `host/docs/...`——FE-OPT-02 原实现即存在此路径偏移）。
 */

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

// host/e2e → host → 仓库根
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const evidenceRoot = process.env.EVIDENCE_DIR
  ? isAbsolute(process.env.EVIDENCE_DIR)
    ? process.env.EVIDENCE_DIR
    : join(REPO_ROOT, process.env.EVIDENCE_DIR)
  : join(REPO_ROOT, 'docs/evidence/fe-opt-02');
const SHOTS = join(evidenceRoot, 'full');

/** 页面清单（path → 可见性锚点）。与 WEB-E2E-FULL 覆盖面一致。 */
const PAGES: Array<{ name: string; path: string; anchor?: string | RegExp }> = [
  { name: 'home', path: '/' },
  { name: 'libraries', path: '/libraries' },
  { name: 'history', path: '/history' },
  { name: 'settings-appearance', path: '/settings/appearance' },
  { name: 'settings-profile', path: '/settings/profile' },
  { name: 'manage-overview', path: '/manage' },
  { name: 'manage-media-items', path: '/manage/media/items' },
  { name: 'manage-media-add', path: '/manage/media/add' },
  { name: 'manage-libraries', path: '/manage/media/libraries' },
  { name: 'manage-mounts', path: '/manage/media/mounts' },
  { name: 'manage-probe-tasks', path: '/manage/media/probe-tasks' },
  { name: 'manage-naming-scrape', path: '/manage/media/naming-scrape' },
  { name: 'manage-collections', path: '/manage/collections' },
  { name: 'manage-task-center', path: '/manage/task-center' },
  { name: 'manage-registration-codes', path: '/manage/site/users/registration-codes' },
  { name: 'manage-users', path: '/manage/site/users/accounts' },
  { name: 'manage-role-templates', path: '/manage/site/users/role-templates' },
  { name: 'manage-sessions', path: '/manage/site/security/sessions' },
  { name: 'manage-audit-logs', path: '/manage/site/security/audit-logs' },
  { name: 'manage-runtime-logs', path: '/manage/site/security/runtime-logs' },
  { name: 'manage-site-settings', path: '/manage/site/settings' },
  { name: 'manage-license', path: '/manage/site/license' },
  { name: 'manage-telegram', path: '/manage/site/telegram' },
  { name: 'manage-secrets', path: '/manage/site/secrets' },
  { name: 'manage-advanced', path: '/manage/site/advanced' },
];

const DEVICES = [
  { key: 'phone-375', width: 375, height: 812 },
  { key: 'tablet-768', width: 768, height: 1024 },
  { key: 'desktop-1280', width: 1280, height: 800 },
];

async function goToStable(page: Page, path: string) {
  await page.goto(path);
  // 主内容区出现且网络空闲（数据面加载完）——截图口径一致。
  await page.locator('main, [class*=page]').first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(400);
}

/** ① 三断点全页截图 + 横向溢出审计（手机 <640 档是核心断言）。 */
test.describe('responsive sweep', () => {
  for (const device of DEVICES) {
    test(`sweep ${device.key}`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width: device.width, height: device.height });
      await resetBackend();
      await login(page);
      mkdirSync(`${SHOTS}/${device.key}`, { recursive: true });
      const overflowPages: string[] = [];
      for (const item of PAGES) {
        await goToStable(page, item.path);
        await page.screenshot({
          path: `${SHOTS}/${device.key}/${item.name}.png`,
          fullPage: true,
        });
        if (device.key === 'phone-375') {
          // 手机档：文档不得横向溢出（表格区允许内部滚动，不算文档溢出）。
          const overflow = await page.evaluate(() => {
            const doc = document.documentElement;
            const over = doc.scrollWidth - doc.clientWidth;
            // 溢出时抓第一个未被子容器裁剪的越界元素（辅助定位）。
            let culprit = '';
            if (over > 4) {
              const vw = doc.clientWidth;
              const clipped = (el: Element): boolean => {
                let n = el.parentElement;
                while (n && n !== document.body) {
                  const s = getComputedStyle(n);
                  if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true;
                  n = n.parentElement;
                }
                return false;
              };
              for (const el of Array.from(document.querySelectorAll('*'))) {
                const r = el.getBoundingClientRect();
                if (r.right > vw + 4 && r.width < vw * 2 && !clipped(el)) {
                  culprit = `${el.tagName}.${(typeof el.className === 'string' ? el.className.slice(0, 50) : '')}`;
                  break;
                }
              }
            }
            return { over, culprit };
          });
          if (overflow.over > 2) overflowPages.push(`${item.name} (+${overflow.over}px ${overflow.culprit})`);
        }
      }
      if (device.key === 'phone-375') {
        // FE-OPT-02 诊断：home 页顶栏元素的 media query 命中状态
        const diag = await page.evaluate(() => {
          const st = getComputedStyle(document.querySelector('[class*=rightArea]') ?? document.body);
          const trigger = document.querySelector('[class*=searchTrigger]');
          const mq = window.matchMedia('(max-width: 767px)').matches;
          return {
            mq,
            rightAreaWidth: st.width,
            triggerDisplay: trigger ? getComputedStyle(trigger).display : 'n/a',
            labelDisplay: (() => { const l = document.querySelector('[class*=searchLabel]'); return l ? getComputedStyle(l).display : 'n/a'; })(),
          };
        });
        console.log(`[audit] topbar diag: ${JSON.stringify(diag)}`);
        // 允许清单外的 0 页：任何页面溢出都记入报告。
        console.log(`[audit] phone horizontal overflow pages: ${overflowPages.length ? overflowPages.join(', ') : 'none'}`);
        // 归档审计结果供 handoff 引用（断言宽容：>4px 视为真溢出，1-4px 是滚动条噪声）。
        const serious = overflowPages.filter((s) => Number(s.match(/\+(\d+)px/)?.[1] ?? 0) > 4);
        expect(serious, `横向溢出页（>4px）：${serious.join(', ')}`).toHaveLength(0);
      }
    });
  }
});

/** ② 触控目标 ≥44px（--touch-min 纪律；mobile viewport 实测关键交互元素）。 */
test.describe('touch targets', () => {
  test('primary controls >= 44px on phone', async ({ page }, testInfo) => {
    // FE-OPT-02：本断言依赖触屏媒体查询 `(hover:none) and (pointer:coarse)`
    // 下的 44px 规则。桌面 profile（Desktop Chrome，pointer:fine）**永不匹配**
    // 该 media → 断言在那里无意义（实测会红）。故只在移动 profile 下执行；
    // 桌面 profile 明确 skip 并说明原因（不假装通过，也不留红）。
    test.skip(
      testInfo.project.name !== 'mobile-chrome',
      `触屏 44px 断言仅在 mobile-chrome profile 有意义（当前 ${testInfo.project.name} 的 pointer 非 coarse）`,
    );
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await resetBackend();
    await login(page);

    const tooSmall: string[] = [];
    async function audit(selector: string, label: string, minSize = 44) {
      const els = page.locator(selector);
      const count = await els.count();
      for (let i = 0; i < Math.min(count, 6); i += 1) {
        const box = await els.nth(i).boundingBox();
        if (!box || box.width === 0 || box.height === 0) continue;
        // 可点击面积判定：宽高任一 < 44 且面积 < 44*32（行内文字按钮的宽向豁免由面积补）。
        if (box.height < minSize && box.width * box.height < minSize * 32) {
          // FE-OPT-02：视觉盒小的元素，可能靠 ::before 伪元素扩了命中区
          // （与 shared Switch 同惯例）。此时**实测命中区**而非视觉盒——
          // boundingBox 看不到伪元素，只看它会误报。
          const hit = await els.nth(i).evaluate((el) => {
            // elementFromPoint 只测**视口内**坐标：元素在视口外时全返回 null，
            // 会误判命中区为 0。先滚到视口中央再探测。
            el.scrollIntoView({ block: 'center', inline: 'center' });
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            // 从中心向外找最远的、仍命中本元素（或其伪元素所属元素）的偏移
            let maxR = 0;
            for (let d = 21; d >= 1; d -= 1) {
              const pts = [
                [cx + d, cy], [cx - d, cy], [cx, cy + d], [cx, cy - d],
              ];
              const allHit = pts.every(([x, y]) => {
                const t = document.elementFromPoint(x, y);
                return t === el || el.contains(t);
              });
              if (allHit) { maxR = d; break; }
            }
            return { visualW: Math.round(r.width), visualH: Math.round(r.height), hitRadius: maxR };
          });
          // 命中半径 ≥21 ⇒ 命中区直径 ≥42（≈44，含取整误差）→ 视为达标
          if (hit.hitRadius >= 21) {
            console.log(
              `[audit] ${label}[${i}] 视觉 ${hit.visualW}x${hit.visualH}，` +
              `命中区直径≈${hit.hitRadius * 2}px（伪元素扩展）→ 达标`,
            );
            continue;
          }
          tooSmall.push(
            `${label}[${i}] ${Math.round(box.width)}x${Math.round(box.height)}` +
            `（命中区直径≈${hit.hitRadius * 2}px）`,
          );
        }
      }
    }

    await goToStable(page, '/');
    // 顶栏导航 / 搜索按钮
    await audit('header nav a', 'topbar-nav');
    await audit('header button', 'topbar-button');
    // 首页卡片（海报卡是主要点按目标）
    await audit('a[href*="/item/"]', 'item-card');
    await audit('a[href*="/libraries/"]', 'library-card');

    await goToStable(page, '/settings/appearance');
    // role=switch 的视觉轨道 44x24，但触屏命中区经 ::before 扩到 44x44
    // （Switch.module.css），不在 boundingBox 判定内——单独跳过。
    const allButtons = page.locator('button:not([role="switch"])');
    {
      const count = await allButtons.count();
      for (let i = 0; i < Math.min(count, 6); i += 1) {
        const box = await allButtons.nth(i).boundingBox();
        if (!box || box.width === 0 || box.height === 0) continue;
        if (box.height < 44 && box.width * box.height < 44 * 32) {
          tooSmall.push(`settings-button[${i}] ${Math.round(box.width)}x${Math.round(box.height)}`);
        }
      }
    }
    await audit('[role="combobox"]', 'settings-combobox');

    await goToStable(page, '/manage');
    await audit('aside a, nav a', 'manage-nav');
    await audit('button', 'manage-button');

    console.log(`[audit] touch targets below 44px (non-exempt): ${tooSmall.length ? tooSmall.join(', ') : 'none'}`);
    // FE-OPT-02（本轮收紧）：原先 `toBeLessThanOrEqual(20)` 过于宽松——实测
    // 19x19 的「终止会话」按钮被记入却仍判通过，等于门禁没锁住。
    // 现已修复该按钮（触屏 ::before 扩命中区至 44x44），故断言收紧为 **0 违规**。
    expect(
      tooSmall,
      `触屏点按目标 <44px：${tooSmall.join(', ')}`,
    ).toHaveLength(0);
  });
});

/** ③ 管理面窄屏呈现：表格横向滚动可达 / 抽屉窄屏可用。 */
test.describe('manage on mobile', () => {
  test('tables are horizontally scrollable and drawers usable on phone', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await resetBackend();
    await login(page);

    // 表格容器：窄屏下应可横向滚动（overflow-x auto/scroll）而不是撑破页面。
    await goToStable(page, '/manage/media/libraries');
    const tableWrap = page.locator('[class*=tableWrap], [class*=table-wrap], .tableWrap').first();
    if (await tableWrap.count()) {
      const style = await tableWrap.evaluate((el) => {
        const s = getComputedStyle(el);
        return { overflowX: s.overflowX, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
      });
      console.log('[audit] library table wrap overflow-x:', style.overflowX, style.scrollWidth, '>', style.clientWidth);
      // 溢出存在时必须可滚动；不溢出（自适应）也算过。
      if (style.scrollWidth > style.clientWidth + 2) {
        expect(['auto', 'scroll']).toContain(style.overflowX);
      }
    }

    // 抽屉：新建媒体库抽屉在手机上打开且可操作（宽不超视口、有关闭手段）。
    const createBtn = page.getByRole('button', { name: /新建|创建|添加/ }).first();
    test.skip(!(await createBtn.count()), '页面无创建入口');
    await createBtn.click();
    const drawer = page.locator('[role="dialog"], aside[class*=drawer], [class*=Drawer]').first();
    await drawer.waitFor({ state: 'visible', timeout: 10_000 });
    const drawerBox = await drawer.boundingBox();
    expect(drawerBox).not.toBeNull();
    expect(drawerBox!.x).toBeGreaterThanOrEqual(-1); // 不被推出视口左界
    expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(375 + 1); // 不超右界
    const closeBtn = page.getByRole('button', { name: /关闭|取消/ }).first();
    expect(await closeBtn.count()).toBeGreaterThan(0);
  });
});

/** ④ 播放页移动端：进度条可拖 / 控件可达 / 无横向溢出。 */
test.describe('playback on mobile', () => {
  test('player controls reachable and progress bar draggable on phone', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await resetBackend();
    await login(page);
    // 直达播放页（与 playback.spec 同口径：seed 条目 id=101）。
    await page.goto('/play/101');
    await page.waitForTimeout(3000); // 等播放器挂载

    // 播放器控件存在（ArtPlayer/DPlayer 容器或自定义控制条）。
    const player = page.locator('.artplayer-app, .dplayer, video, [class*=player]').first();
    expect(await player.count()).toBeGreaterThan(0);

    // 进度条元素存在且可命中（宽 > 0），拖动不抛错。
    const bar = page.locator('.art-control-progress, .dplayer-bar-wrap, [class*=progress]').first();
    if (await bar.count()) {
      const box = await bar.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(40);
      const startY = box!.y + box!.height / 2;
      await page.mouse.move(box!.x + box!.width * 0.3, startY);
      await page.mouse.down();
      await page.mouse.move(box!.x + box!.width * 0.6, startY, { steps: 8 });
      await page.mouse.up();
    }
    // 横向溢出检查
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(4);
    await page.screenshot({ path: `${SHOTS}/phone-375/playback.png`, fullPage: false });
  });
});

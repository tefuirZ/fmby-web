import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { login, resetBackend, E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

/**
 * FE-OPT-03：无障碍（a11y）系统化——真实栈全页面 WCAG 2.1 A/AA 自动扫描 + 键盘导航。
 *
 * 真实栈：真实 fmby-v2-server + 真实 SQLite 三库 + 真实 HTTP。非 skip。
 *
 * 覆盖：
 *  1. **全页面 axe 扫描**（管理面 18 + 用户面 7 + 登录）：`wcag2a/wcag2aa/wcag21a/wcag21aa`
 *     零违规（含对比度 color-contrast、select-name、aria-prohibited-attr 等）。
 *  2. **键盘导航**：Tab 顺序、焦点可见、Esc 关闭弹层（搜索覆盖层 / 用户菜单）、
 *     组合键（Ctrl/Cmd+K）、弹层内输入自动聚焦。
 *  3. **语义标签**：landmark（header/main/nav[aria-label]）、表单控件可访问名、
 *     装饰图标 aria-hidden。
 */

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

/** 全站页面清单（label → path）。管理面 18 + 用户面 7 + login。 */
const PAGES: Array<[string, string]> = [
  ['login', '/login'],
  // 用户面
  ['首页', '/'],
  ['观看历史', '/history'],
  ['媒体库列表', '/libraries'],
  ['媒体库详情', '/libraries/1'],
  ['条目详情', '/item/101'],
  ['设置·资料', '/settings/profile'],
  ['设置·播放', '/settings/playback'],
  ['设置·外观', '/settings/appearance'],
  // 管理面
  ['管理首页', '/manage'],
  ['媒体来源', '/manage/media/mounts'],
  ['媒体库管理', '/manage/media/libraries'],
  ['收藏合集', '/manage/collections'],
  ['任务中心', '/manage/task-center'],
  ['探测任务', '/manage/media/probe-tasks'],
  ['命名刮削', '/manage/media/naming-scrape'],
  ['注册码', '/manage/site/users/registration-codes'],
  ['用户管理', '/manage/site/users/accounts'],
  ['权限模板', '/manage/site/users/role-templates'],
  ['积分与签到', '/manage/site/rewards'],
  ['会话管理', '/manage/site/security/sessions'],
  ['审计日志', '/manage/site/security/audit-logs'],
  ['运行日志', '/manage/site/security/runtime-logs'],
  ['站点设置', '/manage/site/settings'],
  ['授权与订阅', '/manage/site/license'],
  ['Telegram 配置', '/manage/site/telegram'],
  ['密钥链管理', '/manage/site/secrets'],
  ['高级维护', '/manage/site/advanced'],
];

/** axe tag 集：WCAG 2.1 A + AA。 */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.describe('A11y — 全页面 axe 扫描（WCAG 2.1 A/AA）', () => {
  for (const [label, path] of PAGES) {
    test(`${label}（${path}）零违规`, async ({ page }) => {
      await resetBackend();
      if (label === 'login') {
        await page.goto('/login', { waitUntil: 'domcontentloaded' });
      } else {
        await login(page);
        await page.goto(path, { waitUntil: 'domcontentloaded' });
      }
      await page.waitForTimeout(900);

      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      const summary = results.violations
        .map(
          (v) =>
            `[${v.impact}] ${v.id}×${v.nodes.length} — ${v.help}\n` +
            v.nodes
              .slice(0, 3)
              .map((n) => `      ${n.target.join(' ')}`)
              .join('\n'),
        )
        .join('\n');
      expect(summary, `axe 违规：\n${summary}`).toBe('');
    });
  }
});

test.describe('A11y — 键盘导航与焦点', () => {
  test.beforeEach(async () => {
    await resetBackend();
  });

  test('登录表单 Tab 顺序无焦点陷阱（用户名 → 密码 → 显示密码 → 登录）', async ({ page }) => {
    await page.goto('/login');
    const username = page.getByRole('textbox', { name: '用户名' });
    const password = page.getByRole('textbox', { name: '密码' });
    const toggle = page.getByRole('button', { name: '显示密码' });
    const submit = page.getByRole('button', { name: '登录', exact: true });

    await username.focus();
    await expect(username).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(password).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(submit).toBeFocused();
  });

  test('Tab 焦点可见（每个焦点元素有 outline 或 box-shadow）', async ({ page }) => {
    await login(page);
    await page.goto('/manage/media/mounts');
    await page.waitForTimeout(600);
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      const visible = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return true; // body 不要求
        const cs = getComputedStyle(el);
        const hasOutline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
        const hasShadow = cs.boxShadow !== 'none';
        return hasOutline || hasShadow;
      });
      expect(visible, `Tab #${i + 1} 焦点元素无可见指示`).toBe(true);
    }
  });

  test('全局搜索：Ctrl+K 打开、输入自动聚焦、Esc 关闭', async ({ page }) => {
    await login(page);
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: '全局搜索' });
    await expect(dialog).toBeVisible();
    // 打开即聚焦搜索输入框
    await expect(
      page.getByPlaceholder('搜索电影、剧集，支持拼音首字母…'),
    ).toBeFocused();
    // 弹层自身也须无 axe 违规
    const res = await new AxeBuilder({ page }).withTags(AXE_TAGS).include('[role="dialog"]').analyze();
    expect(res.violations, JSON.stringify(res.violations.map((v) => v.id))).toEqual([]);
    // Esc 关闭
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('用户菜单：aria-haspopup/expanded 语义 + Esc 关闭', async ({ page }) => {
    await login(page);
    const trigger = page.getByRole('button', { name: /admin/ });
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('A11y — 语义标签与可访问名', () => {
  test.beforeEach(async () => {
    await resetBackend();
  });

  test('landmark 结构：header / main / nav[aria-label] 在场', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
  });

  test('管理面导航 landmark 具名', async ({ page }) => {
    await login(page);
    await page.goto('/manage');
    await expect(page.getByRole('navigation', { name: '管理中心导航' })).toBeVisible();
  });

  test('登录表单控件均有可访问名', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('textbox', { name: '用户名' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '密码' })).toBeVisible();
    await expect(page.getByRole('button', { name: '显示密码' })).toBeVisible();
    await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible();
  });

  test('媒体库详情筛选器具可访问名（select-name 回归）', async ({ page }) => {
    // 默认主题 darkroom 声明了 `browse.library` skin（卡墙布局，无 host 筛选器）；
    // host 页的 4 个筛选 <select> 仅在**无该 skin 的主题**下渲染（template）。
    // 以 localStorage 预置主题并重载，验证真实渲染路径下的可访问名。
    await page.addInitScript(() => {
      try {
        localStorage.setItem('fmby:theme', 'template');
      } catch {
        /* ignore */
      }
    });
    await login(page);
    await page.goto('/libraries/1');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'template');
    for (const name of ['媒体类型筛选', '分辨率筛选', '观看状态筛选', '排序方式']) {
      await expect(page.getByRole('combobox', { name })).toBeVisible();
    }
  });

  test('媒体库列表类型筛选具可访问名', async ({ page }) => {
    await login(page);
    await page.goto('/libraries');
    await expect(page.getByRole('combobox', { name: '媒体库类型筛选' })).toBeVisible();
  });
});

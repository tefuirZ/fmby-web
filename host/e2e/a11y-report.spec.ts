import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { login, resetBackend, E2E_ENABLED, E2E_SKIP_REASON } from './fixtures/helpers';

/**
 * FE-OPT-03：逐页 a11y 报告（**不引 axe**——用 playwright 内建能力）。
 *
 * 产出两类证据（写 `docs/evidence/fe-opt-03/`，纯文本，不占 repo-size 预算）：
 *  1. `aria-snapshot/<device>/<page>.yml`：playwright `page.accessibility.snapshot()`
 *     的无障碍树（读屏器实际能读到的结构）——用于人工核对关键流程可朗读；
 *  2. `report.md`：逐页汇总（可聚焦元素数、无名控件数、landmark 清单、图片
 *     缺 alt 数），并对**关键项做断言**（不用宽松阈值放过，FE-OPT-02 N-3 教训）。
 *
 * 注意：本 spec 只做**补充报告**；WCAG A/AA 自动扫描在 `a11y.spec.ts`（axe，
 * 仓内既有依赖，非新增）。
 */

test.skip(!E2E_ENABLED, E2E_SKIP_REASON);

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(REPO_ROOT, 'docs', 'evidence', 'fe-opt-03');

/** 与 a11y.spec.ts 同源页面清单（登录 + 用户面 + 管理面）。 */
const PAGES: Array<[string, string]> = [
  ['login', '/login'],
  ['home', '/'],
  ['history', '/history'],
  ['libraries', '/libraries'],
  ['item-detail', '/item/101'],
  ['settings-profile', '/settings/profile'],
  ['manage-overview', '/manage'],
  ['manage-media-items', '/manage/media/items'],
  ['manage-mounts', '/manage/media/mounts'],
  ['manage-probe-tasks', '/manage/media/probe-tasks'],
  ['manage-naming-scrape', '/manage/media/naming-scrape'],
  ['manage-users', '/manage/site/users/accounts'],
  ['manage-site-settings', '/manage/site/settings'],
  ['manage-secrets', '/manage/site/secrets'],
  ['manage-advanced', '/manage/site/advanced'],
];

interface PageAudit {
  page: string;
  path: string;
  focusable: number;
  unnamedControls: string[];
  landmarks: string[];
  imagesMissingAlt: number;
  ariaNodes: number;
}

test.describe('A11y — 逐页报告（playwright 内建，无 axe）', () => {
  test('生成逐页无障碍树 + 汇总报告，并断言关键项', async ({ page }, testInfo) => {
    test.setTimeout(600_000);
    const device = testInfo.project.name;
    const snapDir = join(OUT, 'aria-snapshot', device);
    mkdirSync(snapDir, { recursive: true });

    const rows: PageAudit[] = [];

    for (const [name, path] of PAGES) {
      await resetBackend();
      if (name === 'login') {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
      } else {
        await login(page);
        await page.goto(path, { waitUntil: 'domcontentloaded' });
      }
      await page.waitForTimeout(900);

      // ① 无障碍树快照（读屏器视角）。
      // playwright 1.62：`page.accessibility` 已移除，改用 `locator.ariaSnapshot()`
      // （返回 YAML 文本）。对整页 body 取快照。
      const snapshot = await page.locator('body').ariaSnapshot();
      writeFileSync(join(snapDir, `${name}.yml`), snapshot, 'utf8');

      // ② 关键项统计（自定义断言，不依赖 axe）
      const audit = await page.evaluate(() => {
        const controls = Array.from(
          document.querySelectorAll(
            'button, a[href], input, select, textarea, [role="button"], [role="link"]',
          ),
        ) as HTMLElement[];
        const accessibleName = (el: HTMLElement): string => {
          const aria = el.getAttribute('aria-label');
          if (aria && aria.trim()) return aria.trim();
          const labelledBy = el.getAttribute('aria-labelledby');
          if (labelledBy) {
            const t = document.getElementById(labelledBy)?.textContent ?? '';
            if (t.trim()) return t.trim();
          }
          const title = el.getAttribute('title');
          if (title && title.trim()) return title.trim();
          // 包裹式 <label>（如 settings 的 <label class=field><input/>）：
          // 不像 label[for] 那样靠 id 关联，须向上找祖先 label。
          const wrapping = el.closest('label');
          if (wrapping?.textContent?.trim()) return wrapping.textContent.trim();
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            const ph = el.getAttribute('placeholder');
            if (ph && ph.trim()) return ph.trim();
          }
          if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
            const id = el.id;
            if (id) {
              const lab = document.querySelector(`label[for="${id}"]`);
              if (lab?.textContent?.trim()) return lab.textContent.trim();
            }
          }
          return (el.textContent ?? '').trim();
        };
        const unnamed = controls
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0; // 仅可见控件
          })
          .filter((el) => accessibleName(el) === '')
          .slice(0, 5)
          .map((el) => `${el.tagName}.${String(el.className).slice(0, 40)}`);

        const landmarks = Array.from(
          document.querySelectorAll(
            'header, main, nav, footer, aside, [role="banner"], [role="main"], [role="navigation"], [role="contentinfo"]',
          ),
        )
          .slice(0, 8)
          .map((el) => {
            const label = el.getAttribute('aria-label') ?? '';
            return `${el.tagName.toLowerCase()}${label ? `[${label}]` : ''}`;
          });

        const focusable = Array.from(
          document.querySelectorAll(
            'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => {
          const r = (el as HTMLElement).getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }).length;

        const imagesMissingAlt = Array.from(document.querySelectorAll('img')).filter(
          (img) => !img.hasAttribute('alt'),
        ).length;

        const ariaNodes = document.querySelectorAll('[aria-label], [aria-labelledby], [role]')
          .length;

        return { focusable, unnamedControls: unnamed, landmarks, imagesMissingAlt, ariaNodes };
      });

      rows.push({ page: name, path, ...audit });
    }

    // ③ 汇总报告落盘
    const lines: string[] = [];
    lines.push(`# FE-OPT-03 逐页 a11y 报告（${device}）`);
    lines.push('');
    lines.push('> 生成：`host/e2e/a11y-report.spec.ts`（playwright 内建 accessibility snapshot，无 axe）。');
    lines.push('');
    lines.push('| 页面 | 可聚焦元素 | 无名控件 | landmark | 图片缺 alt | aria 节点 |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const r of rows) {
      lines.push(
        `| ${r.page} | ${r.focusable} | ${r.unnamedControls.length} | ${r.landmarks.join(', ') || '—'} | ${r.imagesMissingAlt} | ${r.ariaNodes} |`,
      );
    }
    lines.push('');
    const bad = rows.filter((r) => r.unnamedControls.length > 0);
    if (bad.length) {
      lines.push('## 无名控件明细');
      for (const r of bad) {
        lines.push(`- **${r.page}**（${r.path}）：${r.unnamedControls.join('; ')}`);
      }
    } else {
      lines.push('## 无名控件明细');
      lines.push('');
      lines.push('无（所有可见控件均有可访问名）。');
    }
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `report-${device}.md`), lines.join('\n'), 'utf8');

    // ④ 断言：不放宽（FE-OPT-02 N-3 教训——宽松阈值会让真违规被判通过）
    const offenders = rows
      .filter((r) => r.unnamedControls.length > 0)
      .map((r) => `${r.page}: ${r.unnamedControls.join(', ')}`);
    expect(offenders, `存在无可访问名的可见控件：\n${offenders.join('\n')}`).toEqual([]);

    const missingAlt = rows.filter((r) => r.imagesMissingAlt > 0);
    expect(
      missingAlt.map((r) => `${r.page}(${r.imagesMissingAlt})`),
      '存在缺 alt 的 <img>',
    ).toEqual([]);

    // 每页都必须有可聚焦元素（否则键盘完全不可用）
    const noFocus = rows.filter((r) => r.focusable === 0).map((r) => r.page);
    expect(noFocus, '存在无任何可聚焦元素的页面').toEqual([]);
  });
});

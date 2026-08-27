// P0-08 ①②：剧集导航 XSS 转义与按钮标记唯一性测试。
// - 恶意剧集标题（"><img onerror=...>）经 ArtPlayer innerHTML 挂载路径不得执行脚本；
// - VideoPlayer 游离按钮删除后，剧集导航按钮标记只能来自 ArtPlayer control（唯一）。
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEpisodeNavigationControlSet,
  createNavigationButtonMarkup,
  escapeHtmlAttribute,
} from '../src/features/player/episodeNavigation.ts';

const XSS_PAYLOAD = `"><img src=x onerror="globalThis.__xssFired=1"><script>globalThis.__xssFired=2<\/script>`;

test('escapeHtmlAttribute 覆盖属性逃逸所需的全部特殊字符', () => {
  assert.equal(
    escapeHtmlAttribute(`&"'<>`),
    '&amp;&quot;&#39;&lt;&gt;',
  );
});

test('恶意剧集标题在按钮 markup 中被属性级转义', () => {
  const html = createNavigationButtonMarkup('previous', XSS_PAYLOAD);
  // 转义后 payload 不再能闭合属性或开启新标签
  assert.ok(!html.includes(`"><img`), 'markup 中不得出现未转义的属性逃逸序列');
  assert.ok(!html.includes('<script'), 'markup 中不得出现注入的 script 标签');
  assert.ok(
    html.includes('aria-label="&quot;&gt;&lt;img'),
    '恶意标题应以 HTML 实体形式出现在 aria-label 属性值内',
  );
});

test('正常中文标题不受转义影响', () => {
  const html = createNavigationButtonMarkup('next', '下一集：第 12 集');
  assert.ok(html.includes('aria-label="下一集：第 12 集"'));
});

test('controlSet 只生成一组剧集导航按钮标记（previous/next 各一）', () => {
  const controlSet = createEpisodeNavigationControlSet();
  const previousButtons = controlSet.controls.filter((control) =>
    control.html.includes('data-testid="player-previous-episode"'),
  );
  const nextButtons = controlSet.controls.filter((control) =>
    control.html.includes('data-testid="player-next-episode"'),
  );
  assert.equal(previousButtons.length, 1);
  assert.equal(nextButtons.length, 1);
});

test('chromium：恶意标题经 innerHTML 挂载后不执行脚本（组件级验证）', async (t) => {
  const { chromium } = await import('@playwright/test');
  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    t.skip('playwright chromium 不可用，跳过浏览器级 XSS 验证');
    return;
  }

  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body><div id="host"></div></body></html>');
    const html = createNavigationButtonMarkup('previous', XSS_PAYLOAD);

    // 模拟 ArtPlayer 挂载 control html 的方式（innerHTML 注入）
    await page.evaluate((markup) => {
      document.getElementById('host')!.innerHTML = markup;
    }, html);
    await page.waitForTimeout(150);

    const result = await page.evaluate(() => ({
      fired: (globalThis as unknown as { __xssFired?: unknown }).__xssFired ?? null,
      imgCount: document.querySelectorAll('#host img').length,
      scriptCount: document.querySelectorAll('#host script').length,
      buttonCount: document.querySelectorAll('#host button').length,
      ariaLabel: document.querySelector('#host button')?.getAttribute('aria-label') ?? null,
    }));

    assert.equal(result.fired, null, 'onerror 脚本不得执行');
    assert.equal(result.imgCount, 0, '不得解析出 img 元素');
    assert.equal(result.scriptCount, 0, '不得解析出 script 元素');
    assert.equal(result.buttonCount, 1, '应恰好渲染一个导航按钮');
    assert.equal(result.ariaLabel, XSS_PAYLOAD, 'aria-label 属性值应保留原始标题文本（转义仅作用于 HTML 结构）');
  } finally {
    await browser.close();
  }
});

test('chromium：动态剧集标题更新走 DOM 属性 API，不触发 HTML 解析', async (t) => {
  const { chromium } = await import('@playwright/test');
  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    t.skip('playwright chromium 不可用，跳过浏览器级验证');
    return;
  }

  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body><div id="host"></div></body></html>');
    // 先以真实 markup 挂载按钮（与 ArtPlayer 一致），再模拟 update() 的动态 label 行为：
    // episodeNavigation.update() 通过 button.title 赋值与 setAttribute('aria-label') 更新，
    // 属 DOM 属性 API，不经过 HTML 解析器——此处验证该路径对恶意标题免疫。
    const html = createNavigationButtonMarkup('previous', '上一集');
    const domResult = await page.evaluate((markup) => {
      const host = document.getElementById('host')!;
      host.innerHTML = markup;
      const button = host.querySelector('button') as HTMLButtonElement;
      const malicious = `"><img src=x onerror="globalThis.__xssFired=1">`;
      button.title = malicious;
      button.setAttribute('aria-label', malicious);
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            fired: (globalThis as unknown as { __xssFired?: unknown }).__xssFired ?? null,
            imgCount: document.querySelectorAll('#host img').length,
            title: (document.querySelector('#host button') as HTMLButtonElement).title,
          });
        }, 150);
      });
    }, html);

    assert.equal(domResult.fired, null, 'DOM 属性赋值路径不得执行脚本');
    assert.equal(domResult.imgCount, 0, 'DOM 属性赋值不得产生 img 元素');
    assert.equal(
      domResult.title,
      `"><img src=x onerror="globalThis.__xssFired=1">`,
      'title 属性应保留原始标题文本',
    );
  } finally {
    await browser.close();
  }
});

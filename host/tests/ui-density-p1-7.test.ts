// P1-7（FE-UI-DENSITY-AUDIT §4）DOM 断言：资源详情 8 节锚点导航 + 低频三节默认折叠。
//
// 审计原文建议（§4 P1-7）：
//   ManageMediaItemDetailPage 8 个同级 ManageSectionCard 全展开长页 ⇒
//   ① 页头下加一行锚点导航（8 个文字链接，复用 .chip 词汇）；
//   ② 低频三节（Pipeline/IdentityGovernance/DangerZone）默认折叠
//     （<details> 或受控 disclosure，站内已有 StreamDisclosureGroup 先例）。
//
// 折叠实现选 native <details>（ponytail：平台特性 > JS 受控组件；与 browse 侧
// StreamDisclosureGroup 同范式）。summary 内 actions 按钮：按 HTML 规范，
// summary 激活行为仅命中 summary 本身与非交互后代，按钮点击不触发折叠。
//
// 运行：node --import ./host/tests/register-aliases.mjs --test host/tests/ui-density-p1-7.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..'); // host/
const read = (p) => readFileSync(join(repoRoot, p), 'utf8');

/** 剔除 JSX 块注释与行注释后再断言（防实现注释里的字符串触发假红）。 */
function stripComments(src) {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const pagePath = 'src/pages/manage/ManageMediaItemDetailPage.tsx';
const cardPath = 'src/pages/manage/components.tsx';
const page = () => stripComments(read(pagePath));

test('P1-7①: 页头下有 8 节锚点导航（复用 chip 词汇）', () => {
  const src = page();
  assert.match(src, /aria-label="资源详情分节导航"/, '应有分节导航 nav');
  const anchors = src.match(/href="#sec-[a-z]+"/g) ?? [];
  assert.equal(anchors.length, 8, `锚点应为 8 个；实测 ${anchors.length}：${anchors.join(' ')}`);
  assert.match(src, /className=\{sharedStyles\.chip\}\s*href="#sec-|href="#sec-[a-z]+"[^>]*className=\{sharedStyles\.chip\}|className=\{sharedStyles\.chip\}/, '锚点应复用 chip 词汇');
});

test('P1-7①: 8 个锚点各有落点（id 与 href 一一对应）', () => {
  const src = page();
  const hrefs = new Set((src.match(/href="#sec-([a-z]+)"/g) ?? []).map((h) => h.slice(7, -1)));
  const ids = new Set((src.match(/id="sec-([a-z]+)"/g) ?? []).map((h) => h.slice(4, -1)));
  assert.equal(ids.size, 8, `应有 8 个锚点落点 id；实测 ${ids.size}`);
  for (const h of hrefs) {
    assert.ok(ids.has(h), `锚点 #sec-${h} 缺少落点`);
  }
});

test('P1-7②: 共享 ManageSectionCard 支持 collapsible（native details 分支）', () => {
  const src = read(cardPath);
  assert.match(src, /collapsible\?: boolean/, 'ManageSectionCardProps 应有 collapsible');
  assert.match(src, /if \(collapsible\)/, '应有 collapsible 渲染分支');
  assert.match(src, /<details className=\{styles\.sectionCard\}>/, '折叠分支用 native <details>');
});

test('P1-7②: 低频三节默认折叠（流水线/身份治理/危险操作）', () => {
  for (const [file, label] of [
    ['src/pages/manage/media-item-detail/components/MediaItemPipelineSection.tsx', '元数据流水线'],
    ['src/pages/manage/media-item-detail/components/IdentityGovernancePanel.tsx', '身份与可见性治理'],
    ['src/pages/manage/media-item-detail/components/MediaItemDangerZoneSection.tsx', '危险操作'],
  ]) {
    const src = stripComments(read(file));
    assert.match(src, /collapsible/, `${label} 应默认折叠（collapsible）`);
  }
  // 高频节不受影响：基础信息/元数据编辑保持默认展开
  const overview = stripComments(
    read('src/pages/manage/media-item-detail/components/MediaItemOverviewSection.tsx')
  );
  assert.ok(!overview.includes('collapsible'), '高频节（基础信息）不应被折叠');
});

test('P1-7: 锚点落点有 scroll-margin，防 sticky 顶栏遮挡', () => {
  const css = read('src/pages/manage/ManagePages.module.css');
  assert.match(css, /\.anchorTarget/, '应有锚点落点类');
  assert.match(css, /scroll-margin-top/, '落点类应带 scroll-margin-top');
  assert.match(css, /summary\.sectionHeader/, 'summary 应复用 sectionHeader 词汇（含 cursor）');
});

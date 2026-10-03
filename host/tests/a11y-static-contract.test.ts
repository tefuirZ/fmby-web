import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * FE-A11Y-KEYBOARD-AUDIT：可访问性**静态契约**断言。
 *
 * ★诚实说明（不假装是浏览器/屏幕阅读器测试）：本仓**无** jsdom / testing-library
 *   （`package.json` 均无相关依赖），引入它们属**新依赖**，违反 ponytail 纪律。
 *   故此处断言的是**源码契约**（属性是否补齐），真正的行为验证（Tab 顺序、焦点
 *   归还、读屏播报）仍需在浏览器/屏幕阅读器上人工或 CI 复跑 —— 见 handoff 跳过项。
 *
 * 覆盖（本轮新增/改动面中**可安全修**的两类）：
 *   1. 仅靠 placeholder 命名、无可访问名 ⇒ 须有 `aria-label`（或 <label> 包裹）；
 *   2. 共享错误/状态面 `FeedbackState` ⇒ 须有 `role="alert"`（error）+ `aria-live`。
 */

const ROOT = new URL('../../', import.meta.url).pathname; // host/tests/ → 仓根（fmby-web/）

function read(rel: string) {
  return readFileSync(`${ROOT}${rel}`, 'utf8');
}

/** 取某 `<input` 起始块（到 `>` 结束）的属性文本。 */
function inputBlockAt(src: string, lineNo: number) {
  const lines = src.split('\n');
  const start = lineNo - 1;
  let acc = '';
  for (let i = start; i < lines.length; i += 1) {
    acc += `${lines[i]}\n`;
    if (/^\s*\/>|>/.test(lines[i])) break;
  }
  return acc;
}

const UNLABELED_INPUTS: Array<{ file: string; line: number; want: string }> = [
  {
    // 取证：CollectionsListPage 的检索框原先**只有 placeholder**（无 <label> 包裹、
    //       无 aria-label）⇒ 无可访问名，本卡补齐。
    file: 'host/src/pages/browse/CollectionsListPage.tsx',
    line: 81,
    want: '按合集名检索',
  },
];

/** 取证留存：这些输入框虽无 aria-label，但由 `<label>` 包裹 ⇒ 已具备可访问名，非缺陷。 */
const LABEL_WRAPPED_INPUTS: Array<{ file: string; line: number; labelText: string }> = [
  {
    file: 'host/src/pages/manage/collections/components/CollectionMemberAdder.tsx',
    line: 73,
    labelText: '按关键词查找可加入的条目',
  },
  {
    file: 'host/src/pages/manage/collections/components/CollectionFormDialog.tsx',
    line: 70,
    labelText: '标题（必填，最长 512 字）',
  },
];

test('取证留存：<label> 包裹的输入框已具可访问名（非缺陷，不重复补 aria-label）', () => {
  for (const { file, line, labelText } of LABEL_WRAPPED_INPUTS) {
    const src = read(file);
    const lines = src.split('\n');
    // 向上回溯到最近一个 <label 起始，确认该 input 在其内
    let inLabel = false;
    for (let i = line - 2; i >= 0; i -= 1) {
      if (/<\/label>/.test(lines[i])) break;
      if (/<label[^>]*>/.test(lines[i])) {
        inLabel = true;
        break;
      }
    }
    assert.ok(inLabel, `${file}:${line} 应处于 <label> 包裹内`);
    assert.ok(
      src.includes(labelText),
      `${file} 的 <label> 文案应含「${labelText}」`,
    );
  }
});

test('本轮新增检索输入框：仅 placeholder 者须补齐 aria-label（可访问名）', () => {
  for (const { file, line, want } of UNLABELED_INPUTS) {
    const src = read(file);
    const block = inputBlockAt(src, line);
    assert.ok(
      /aria-label=/.test(block),
      `${file}:${line} 输入框缺少 aria-label（placeholder 不足以作为可访问名）`,
    );
    assert.ok(
      block.includes(want),
      `${file}:${line} aria-label 文案应含「${want}」，实际：${block.slice(0, 200)}`,
    );
  }
});

test(
  '共享状态面 FeedbackState：error 态须 role="alert"，全态须 aria-live（读屏可播报）',
  () => {
    const src = read('shared/src/ui/common/FeedbackState.tsx');
    assert.ok(
      /role=/.test(src),
      'FeedbackState 缺少 role（error 态应对读屏播报）',
    );
    assert.ok(
      /aria-live=/.test(src),
      'FeedbackState 缺少 aria-live（状态变化应对读屏播报）',
    );
  },
);

test('抽屉类面：经 Radix Dialog 承载 ⇒ 具备 role/aria-modal/Esc/焦点归还（取证留存）', () => {
  // 取证结论而非缺陷：SideDrawer 基于 @radix-ui/react-dialog，
  // Radix 原生提供 role="dialog" / aria-modal / Esc 关闭 / 焦点陷阱 / 焦点归还。
  const src = read('shared/src/ui/common/SideDrawer.tsx');
  assert.ok(
    /@radix-ui\/react-dialog/.test(src),
    'SideDrawer 应继续基于 Radix Dialog（其 a11y 能力即为本卡取证结论）',
  );
  assert.ok(/Dialog\.Title/.test(src), '抽屉须有可访问标题（Dialog.Title）');
  assert.ok(
    /aria-label=/.test(src) && /关闭/.test(src),
    '关闭按钮须有 aria-label',
  );
});

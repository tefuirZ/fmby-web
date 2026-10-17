// P1-6（FE-UI-DENSITY-AUDIT §4）DOM 断言：播放页外部播放/复制链入口收敛。
//
// 审计原文建议（§4 P1-6）：
//   ① InfoBar 的「外部播放器」裸直链 anchor 删除（ExternalPlayerBar 六深链按钮
//      是专门面，裸 anchor 与其同义且更低级）；
//   ② 复制链接保留 InfoBar 与 overlay 各一处（overlay 全屏接管时 InfoBar 不可见，
//      属合理冗余）；但 overlay 的「新标签打开」与「外部打开」指向同一
//      portableStreamUrl + target=_blank，行为完全相同 ⇒ 合并为一个；
//   ③ 「兼容性待确认」徽标只在一处渲染（现状已只在 InfoBar，断言钉住防复发）。
//
// 为什么用文本断言：本仓前端测试无 jsdom/RTL（同 ui-density-p1-8.test.ts 理由）。
//
// 运行：node --import ./host/tests/register-aliases.mjs --test host/tests/ui-density-p1-6.test.ts

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
    .replace(/^\/\*[\s\S]*?\*\//gm, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

test('P1-6①: InfoBar 删「外部播放器」裸直链 anchor（专门面在 ExternalPlayerBar）', () => {
  const src = stripComments(read('src/pages/browse/play/PlaybackInfoBar.tsx'));
  assert.ok(!src.includes('外部播放器'), 'InfoBar 不应再有「外部播放器」裸直链入口');
  assert.ok(
    !src.includes('portableStreamUrl'),
    '删 anchor 后 portableStreamUrl prop 应一并退场'
  );
  assert.match(src, /复制链接/, '复制链接保留 InfoBar 一处（审计 ②）');
});

test('P1-6②: overlay「新标签打开」删除（与「外部打开」同 URL 同行为）', () => {
  const src = stripComments(read('src/pages/browse/play/PlaybackStage.tsx'));
  assert.ok(!src.includes('新标签打开'), '同行为的第二个 anchor 应删除');
  assert.match(src, /在外部播放器中打开/, 'overlay 保留唯一外部打开入口');
  const occurrences = src.split('portableStreamUrl ?').length - 1;
  assert.equal(occurrences, 1, `overlay 里 portableStreamUrl 条件渲染应只剩 1 处；实测 ${occurrences}`);
});

test('P1-6②: 复制链接保留两处（overlay 全屏接管时 InfoBar 不可见，合理冗余）', () => {
  const stage = stripComments(read('src/pages/browse/play/PlaybackStage.tsx'));
  const bar = stripComments(read('src/pages/browse/play/PlaybackInfoBar.tsx'));
  assert.match(stage, /onCopyLink/, 'overlay 保留复制链接');
  assert.match(bar, /onCopyLink/, 'InfoBar 保留复制链接');
});

test('P1-6③: 「兼容性待确认」徽标全播放页只渲染一处', () => {
  let total = 0;
  for (const p of [
    'src/pages/browse/play/PlaybackStage.tsx',
    'src/pages/browse/play/PlaybackInfoBar.tsx',
    'src/pages/browse/play/ExternalPlayerBar.tsx',
    'src/pages/browse/PlayPage.tsx',
  ]) {
    total += stripComments(read(p)).split('兼容性待确认').length - 1;
  }
  assert.equal(total, 1, `兼容提示徽标应只在一处渲染；实测 ${total} 处`);
});

test('P1-6: ExternalPlayerBar 六深链按钮不受影响（专门面保留）', () => {
  const src = read('src/pages/browse/play/ExternalPlayerBar.tsx');
  for (const player of ['PotPlayer', 'VLC', 'IINA', 'nPlayer', 'Infuse', 'MX']) {
    assert.ok(src.includes(player), `深链按钮 ${player} 应保留`);
  }
});

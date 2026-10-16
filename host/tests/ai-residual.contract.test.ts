// FE-AI-RESIDUAL：AI 干预**遗留缺口**的回归契约（源级，可证伪）。
//
// 背景：w5 已把 7 个会话端点接完（见 `ai-interventions.contract.test.ts`，那份钉的是**契约/JSON 形状**）。
// 本文件钉的是**另两处遗留缺口**（fe01 用 codegraph 复核为真缺口）：
//   ① `POST /media/{id}/suggest`（A2 只读）此前**零 UI 入口** —— codegraph：
//      `suggestForMediaItem` 无调用者；两个 hooks 里 `suggest` 出现 0 次。
//   （② 任务中心「AI 介入概览」段另见本条实现时的追加契约。）
//
// 为什么源级而不是 DOM 级：本仓对「入口/接线是否在场」既有范式就是源级（照
// `license-gated-modules.contract.test.ts` 的 ②/③/⑤）；行为面归各页单测与 e2e。
//
// 跑法：cd host && node --import ./tests/register-aliases.mjs --test tests/ai-residual.contract.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const HOST_ROOT = join(import.meta.dirname, '..');
const readSrc = (rel: string) => readFile(join(HOST_ROOT, 'src', rel), 'utf8');
const AI = 'pages/manage/naming-rules/ai-intervention';

test('① suggest（A2 只读）必须有真实 UI 入口：hook 调用 → 面板按钮 → section 接线', async () => {
  const hooks = await readSrc(`${AI}/hooks/useAiInterventionMutations.ts`);
  const panel = await readSrc(`${AI}/components/AiInterventionDetailPanel.tsx`);
  const section = await readSrc(`${AI}/AiInterventionSection.tsx`);

  // (a) hook 真的调契约 API（不是只 import）
  assert.match(
    hooks,
    /aiInterventionsApi\.suggestForMediaItem\(/,
    '必须实际调用 `suggestForMediaItem`（此前 codegraph 显示零调用者）',
  );
  assert.match(hooks, /suggestMutation/, 'suggest 必须以具名 mutation 暴露（供页面接线）');

  // (b) 面板有可点入口 + 渲染结果
  assert.match(panel, /获取 AI 建议/, '面板必须有「获取 AI 建议」入口');
  assert.match(panel, /onSuggest/, '入口必须回调到上层（不自己发请求）');
  assert.match(panel, /suggestion\.suggestedTitle/, '必须呈现建议结果（只读可见）');

  // (c) section 把三者接起来（少了任一环 ⇒ 入口不可达）
  assert.match(section, /suggestMutation/, 'section 必须解构 suggestMutation');
  assert.match(section, /onSuggest=\{/, 'section 必须把 onSuggest 传给面板');

  // (d) 只读语义：不得因 suggest 失效查询（避免无谓重取）
  const suggestBlock = hooks.slice(hooks.indexOf('suggestMutation') - 400);
  assert.ok(
    !/suggestMutation[\s\S]{0,300}?onSuccess:\s*invalidateAll/.test(suggestBlock),
    'suggest 是只读建议，不得像写操作那样 invalidateAll（否则每次点都全量重取）',
  );
});

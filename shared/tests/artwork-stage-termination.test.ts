// USEPOSTERURL-CYCLE 终止性穷举锁：降级状态机对**任意 URL 组合 × 任意 error 序列**
// 都必须在有限步内到达 done，且**不得重访任何档位**（成环即红）。
//
// 来源：FE-posterUrl 卡的 DOM 观察曾误诊「thumb↔backdrop 成环」——本测试把该
// 疑点钉死为**不存在**（两个状态机的 next 都严格沿有序链下行、default→done）。
// 当时的真因是测试基建假象（blank 页上相对 URL img 请求挂起 + 合成事件首派发
// 在 React 异步提交前丢失），详见 W-FE-RED/USEPOSTERURL-CYCLE 报告。
//
// 方法：hook 的 4 个纯函数（initial/next × poster/backdrop 两机）已导出；
// 枚举全部 2^4 = 16 种 URL 存在性组合，对每种组合模拟任意 error 序列
//（每步：当前档 URL 视为失败 → next），断言 ≤ 链长步内 done 且无重访。

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPosterInitialStage,
  getNextPosterStage,
  getBackdropInitialStage,
  getNextBackdropStage,
} from '../src/hooks/usePosterUrl.ts';

type UrlKey = 'posterUrl' | 'thumbUrl' | 'backdropUrl' | 'bannerUrl';
const KEYS: UrlKey[] = ['posterUrl', 'thumbUrl', 'backdropUrl', 'bannerUrl'];

/** 枚举全部 2^4 存在性组合（每键 有/无）。 */
function* allCombinations(): Generator<Record<UrlKey, string>> {
  for (let mask = 0; mask < 16; mask += 1) {
    const art = {} as Record<UrlKey, string>;
    KEYS.forEach((key, bit) => {
      if (mask & (1 << bit)) art[key] = `https://img.test/${key}-${bit}.jpg`;
    });
    yield art;
  }
}

function simulate(machine: 'poster' | 'backdrop', art: Record<UrlKey, string>) {
  const maxSteps = machine === 'poster' ? 3 : 4; // 链长上界（档位数）
  let stage =
    machine === 'poster' ? getPosterInitialStage(art as never) : getBackdropInitialStage(art as never);
  const visited = new Set<string>([stage]);
  let steps = 0;
  while (stage !== 'done') {
    steps += 1;
    assert.ok(steps <= maxSteps, `${machine} 机组合 ${JSON.stringify(art)} 超过 ${maxSteps} 步未到 done`);
    assert.ok(!visited.has(machine === 'poster' ? `next:${stage}` : `next:${stage}`), '重访档位 = 成环');
    visited.add(`next:${stage}`);
    stage =
      machine === 'poster'
        ? getNextPosterStage(stage as never, art as never)
        : getNextBackdropStage(stage as never, art as never);
  }
  return steps;
}

test('poster 机：16 种组合全部有限步终止、无重访（成环不存在）', () => {
  for (const art of allCombinations()) {
    simulate('poster', art);
  }
});

test('backdrop 机：16 种组合全部有限步终止、无重访（成环不存在）', () => {
  for (const art of allCombinations()) {
    simulate('backdrop', art);
  }
});

test('四 URL 全给的组合（mapArtwork{itemId} 形态）也在 3 步内到 done', () => {
  const art = {
    posterUrl: 'https://img.test/p.jpg',
    thumbUrl: 'https://img.test/t.jpg',
    backdropUrl: 'https://img.test/b.jpg',
    bannerUrl: 'https://img.test/banner.jpg',
  };
  // poster 机：primary → thumb → backdrop → done = 3 步。
  let stage = getPosterInitialStage(art as never);
  const seq: string[] = [stage];
  while (stage !== 'done') {
    stage = getNextPosterStage(stage as never, art as never);
    seq.push(stage);
  }
  assert.deepEqual(seq, ['primary', 'thumb', 'backdrop', 'done'], 'poster 机链序锁定');
});

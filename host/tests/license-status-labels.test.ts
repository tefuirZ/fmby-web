/**
 * LICENSE-UX-STATUS-LABELS：授权状态在界面上必须**看得懂**（用户买断后唯一能自查的东西）。
 *
 * 要钉住的缺陷（用户面是"看不懂"，不是排版）：
 *   `LicenseStatusOverview.tsx` 把后端枚举**原样**当标签渲染
 *   （`const runtimeLabel = status.runtimeState ?? '未知'` ⇒ StatusBadge 显示 `unactivated`/`grace`），
 *   而中文映射在 `shared/.../license/status.ts` 里**早已存在**（`getLicenseRuntimeStateLabel`）
 *   —— 既有 `shared/tests/license-contract.test.ts` 只测了**那个函数**，
 *   没有任何判据锁「**页面有没有用它**」⇒ 所以函数一直绿、界面一直英文。
 *
 * ★为什么不测 .tsx：node strip-types 不接 .tsx（仓内 `theme-skins.test.ts` 已注明），
 *   真渲染要拖 vite+Chromium（`cas-*.dom.test.ts` 那一套）。
 *   故本文件测**两层**，都不引入新依赖：
 *   ① 行为层：呈现层 `.ts` 的 `formatRuntimeStatusLabel/formatRealtimeStatusLabel`
 *      六态/六态**全部**必须出中文，未知值不得把英文枚举漏给用户；
 *   ② 契约层：组件源码**不得**再把 `status.runtimeState` / `status.realtimeStatus`
 *      直接当标签（必须经①的函数）——沿用仓内 `install-wizard-honesty.test.ts` 的
 *      「剥注释后读源码」判据形态，只剥注释不跨行通配（防把真代码吞掉造成假红）。
 *
 * 跑法：cd host && node --import ./tests/register-aliases.mjs --test tests/license-status-labels.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  formatRuntimeStatusLabel,
  formatRealtimeStatusLabel,
} from '../src/pages/manage/license/licenseSummaryPresentation';

const CJK = /[\u4e00-\u9fff]/;

/** 与后端 DTO 值域逐字一致的六态（`shared/.../license/types.ts`）。 */
const RUNTIME_STATES = ['unactivated', 'pending', 'active', 'grace', 'expired', 'invalid'] as const;
/** realtime 六态（同上）。 */
const REALTIME_STATES = ['disabled', 'idle', 'ready', 'connected', 'error', 'blocked'] as const;

test('① runtime 六态标签全部是中文（不得漏英文枚举给用户）', () => {
  for (const state of RUNTIME_STATES) {
    const label = formatRuntimeStatusLabel(state);
    assert.match(label, CJK, `态 ${state} 的标签应为中文，实际：${label}`);
    assert.doesNotMatch(
      label,
      new RegExp(`\\b${state}\\b`),
      `标签不得把枚举原样 ${state} 露给用户`,
    );
  }
  // 关键三态必须可区分（未激活 / 已过期 / 宽限期 不能都说成"未知"）
  const distinct = new Set(RUNTIME_STATES.map(formatRuntimeStatusLabel));
  assert.equal(distinct.size, RUNTIME_STATES.length, '六态标签必须两两不同');
});

test('② realtime 六态标签全部是中文，且"未启用"与"空闲"可区分', () => {
  for (const st of REALTIME_STATES) {
    const label = formatRealtimeStatusLabel(st);
    assert.match(label, CJK, `态 ${st} 应为中文，实际：${label}`);
    assert.doesNotMatch(label, new RegExp(`\\b${st}\\b`), `标签不得露出枚举 ${st}`);
  }
  assert.notEqual(
    formatRealtimeStatusLabel('disabled'),
    formatRealtimeStatusLabel('idle'),
    '未启用 / 空闲 必须可区分（都显示"—"就等于没告诉用户通道是否开着）',
  );
});

test('③ 未知/缺失值 ⇒ 中文兜底并保留原值可诊断（不静默、不崩）', () => {
  const weird = formatRuntimeStatusLabel('weird_state' as never);
  assert.match(weird, CJK, '未知态也必须给中文说明');
  assert.match(weird, /weird_state/, '未知态要保留原值便于报障（不得只说"未知"丢信息）');
  assert.match(formatRuntimeStatusLabel(null as never), CJK);
});

/** 剥掉注释后的组件源码（沿用 install-wizard-honesty.test.ts 的做法：只剥整行注释）。 */
function rendered(rel: string): string {
  const lines = readFileSync(new URL(rel, import.meta.url), 'utf8').split('\n');
  const out: string[] = [];
  let inBlock = false;
  for (const line of lines) {
    const t = line.trim();
    if (inBlock) {
      if (t.startsWith('*/')) inBlock = false;
      continue;
    }
    if (t.startsWith('/*')) {
      if (!t.includes('*/')) inBlock = true;
      continue;
    }
    if (t.startsWith('//')) continue;
    out.push(line);
  }
  return out.join('\n');
}

test('④ 组件不得再把枚举原样当标签（必须经呈现层函数）', () => {
  const src = rendered('../src/pages/manage/license/components/LicenseStatusOverview.tsx');
  assert.doesNotMatch(
    src,
    /const\s+runtimeLabel\s*=\s*status\.runtimeState\s*\?\?/,
    'runtimeLabel 必须是 formatRuntimeStatusLabel(status.runtimeState) 的结果，不能直取枚举',
  );
  assert.doesNotMatch(
    src,
    /const\s+realtimeStatusLabel\s*=\s*status\.realtimeStatus\s*\?\?/,
    'realtimeStatusLabel 同上，必须走呈现层',
  );
  assert.match(src, /formatRuntimeStatusLabel/, '组件应调用呈现层的中文标签函数');
  assert.match(src, /formatRealtimeStatusLabel/, '组件应调用呈现层的 realtime 中文标签函数');
});

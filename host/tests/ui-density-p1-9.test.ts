// P1-9（FE-UI-DENSITY-AUDIT §4）DOM 断言：管理首页一屏 13 块收敛。
//
// 审计原文建议（§4 P1-9，不动数据面）：
//   ① 移除 ActiveTaskQueueWidget（P0-1 同步处理）→12；本分支上该 widget 本就是
//      硬编码空数组 + 死链的空壳，页面侧拔除后其「谎报空态」不再可达；
//   ② TaskPipelineWidget 的 quickLinks 上移为 KPI 胶囊下方一行 chip；活动流并入
//      RiskRadar（「风险与动态」）→ 底部看板整块退场；
//   ③ ServerVitalsPanel 收敛为 4 指标一行（vitalsGrid 由纵向堆叠改单行 flex）；
//      附带删除两处不诚实/重复展示：硬编码 38% 的假带宽 gauge、与页头 meta
//      同值的「最近刷新」footer（同一 refreshedAt 渲染两遍）。
//
// 组件文件处置：ActiveTaskQueueWidget/TaskDetailModal 文件保留（lovely-skunk
// 分支 P0-1 修复 99a171a 正在编辑 widget 本体，删文件制造合并冲突；仅拔除
// 页面消费使其成为未接线导出）。TaskPipelineWidget 无跨分支在途编辑 → 删除。
//
// 运行：node --import ./host/tests/register-aliases.mjs --test host/tests/ui-density-p1-9.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
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

const page = () => stripComments(read('src/pages/manage/ManageOverviewPage.tsx'));

test('P1-9①: 空壳任务队列 widget 从首屏拔除（级联死代码一并退场）', () => {
  const src = page();
  for (const gone of [
    'ActiveTaskQueueWidget',
    'TaskDetailModal',
    'ActiveTaskQueueItem',
    'handleOpenTaskDetail',
    'handleBoostPriority',
    'handleCancelTask',
    'handleRetryTask',
    'isTaskDetailOpen',
    'selectedTask',
  ]) {
    assert.ok(!src.includes(gone), `页面不应再引用 ${gone}`);
  }
  assert.ok(!/const tasks[ :=]/.test(src), '硬编码空数组 tasks 应删除');
});

test('P1-9②: quickLinks 上移为 KPI 胶囊下方一行 chip', () => {
  const src = page();
  assert.match(src, /quickLinks/, '页面应直接消费 quickLinks');
  assert.match(
    src,
    /className=\{styles\.chip\}[\s\S]{0,120}\{link\.label\}/,
    'quickLinks 应渲染为 chip（复用 ManagePages chip 词汇）'
  );
});

test('P1-9②: 底部看板 TaskPipelineWidget 整块退场，活动流并入风险雷达', () => {
  assert.equal(
    existsSync(join(repoRoot, 'src/pages/manage/overview/components/TaskPipelineWidget.tsx')),
    false,
    'TaskPipelineWidget.tsx 应删除'
  );
  const index = read('src/pages/manage/overview/index.ts');
  assert.ok(!index.includes('TaskPipelineWidget'), 'overview/index.ts 不应再导出 TaskPipelineWidget');
  const src = page();
  assert.ok(!src.includes('TaskPipelineWidget'), '页面不应再引用底部看板');
  const radar = stripComments(read('src/pages/manage/overview/components/RiskRadarPanel.tsx'));
  assert.match(radar, /activities/, '风险雷达应承接活动流（activities prop）');
  assert.match(src, /activities=\{overview\.activities\}/, '页面应把活动流传给风险雷达');
});

test('P1-9③: 服务器脉搏收敛为 4 指标一行，假 gauge 与重复刷新时间退场', () => {
  const css = read('src/pages/manage/overview/ManageOverviewCockpit.module.css');
  const grid = css.slice(css.indexOf('.vitalsGrid'), css.indexOf('}', css.indexOf('.vitalsGrid')));
  assert.match(grid, /flex-wrap: wrap/, 'vitalsGrid 应为单行可换行布局');
  const panel = stripComments(read('src/pages/manage/overview/components/ServerVitalsPanel.tsx'));
  assert.ok(!panel.includes("width: '38%'"), '硬编码 38% 的假带宽 gauge 应删除');
  assert.ok(!panel.includes('指标每 10 秒自动巡检'), '与页头 meta 同值的「最近刷新」footer 应删除');
  assert.match(panel, /实时网络推流吞吐/, '带宽文本值保留');
});

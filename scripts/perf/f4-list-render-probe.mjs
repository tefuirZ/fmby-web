// F4 性能探针：列表直出页的渲染成本（.map() 直出 vs memo/content-visibility/窗口化）。
//
// 审计 F4：20 个页面 .map() 直出、React.memo 0 处。本探针对**真组件**测两组数字：
//   1. RuntimeLogsDesktopTable（运行日志表，'全部' 档无上限 + 5s refetchInterval）
//   2. ItemDetailEpisodeSection（剧集分集区，children ≤2000 横向全量挂载）
// 各测：冷挂载（createRoot → 双 RAF = commit+paint）与重渲染（父组件 state tick）。
//
// 用法（仓内 scripts/perf 惯例；需先 pnpm install）：
//   node scripts/perf/f4-list-render-probe.mjs [N_logs] [N_episodes]
// 输出 JSON：{ logs: {n, mountMs, rerenderMs}, episodes: {n, mountMs, rerenderMs} }
// 口径：每场景 3 轮取中位数；同一浏览器实例内跑，避免环境噪声。
// 「未装依赖」→ 退出码 3 + 明确报错（不吞成假成功）。

import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOST_ROOT = join(ROOT, 'host');

if (!existsSync(join(HOST_ROOT, 'node_modules', 'react'))) {
  console.error('未安装依赖（先 pnpm install）');
  process.exit(3);
}

const NM = join(HOST_ROOT, 'node_modules');
const nmUrl = (rel) => pathToFileURL(join(NM, rel)).href;
const NM_REACT = nmUrl('react/index.js');
const NM_REACT_DOM_CLIENT = nmUrl('react-dom/client.js');
const NM_REACT_ROUTER = nmUrl('react-router/dist/development/index.mjs');
const EPISODE_SECTION = pathToFileURL(
  join(HOST_ROOT, 'src/pages/browse/item-detail/components/ItemDetailEpisodeSection.tsx'),
).href;
const LOGS_TABLE = pathToFileURL(
  join(HOST_ROOT, 'src/pages/manage/runtime-logs/RuntimeLogsDesktopTable.tsx'),
).href;

const N_LOGS = Number(process.argv[2] ?? 3000);
const N_EPISODES = Number(process.argv[3] ?? 1200);

// 探针场景：两组件各自的最小可行 props（只喂渲染真实消费的字段；
// vite/esbuild 剥类型不做检查，多余/缺失字段 = undefined 渲染兜底）。
const PROBE_ENTRY = `
import { createElement, useState } from '${NM_REACT}';
import { createRoot } from '${NM_REACT_DOM_CLIENT}';
import { MemoryRouter } from '${NM_REACT_ROUTER}';
import { ItemDetailEpisodeSection } from '${EPISODE_SECTION}';
import { RuntimeLogsDesktopTable } from '${LOGS_TABLE}';

const makeEpisode = (i) => ({
  id: 'ep' + i,
  title: '第 ' + (i + 1) + ' 集',
  kind: 'episode',
  kindLabel: '分集',
  playbackTargetId: 'ep' + i,
  hasPlayableSource: true,
  artwork: {},
  description: '',
  meta: [],
  genres: [],
  tags: [],
  directors: [],
  directorPeople: [],
  actors: [],
  studios: [],
  progress: undefined,
  item: undefined,
});

const makeItem = () => ({
  id: 'series1',
  title: '超长篇测试番',
  kind: 'series',
  kindLabel: '剧集',
  description: '',
  meta: [],
  genres: [],
  tags: [],
  directors: [],
  directorPeople: [],
  actors: [],
  studios: [],
  artwork: {},
  itemCount: ${N_EPISODES},
});

const makeLogView = (i) => ({
  record: { id: 'log' + i, timestamp: '2026-10-23T12:00:00Z', level: 'info', target: 'worker.scan' },
  targetLabel: '扫描 worker #' + (i % 7),
  headline: '完成媒体库全量扫描 media_' + i + '（耗时 42s，新增 3 项）',
  eventLabel: 'scan.completed',
  resultLabel: '成功',
  actorLabel: 'user-' + (i % 5),
  requestLabel: 'req-' + i,
  primaryFields: [],
  extraFields: [],
});

const makeViews = (n) => Array.from({ length: n }, (_, i) => makeLogView(i));

const EPISODE_ITEM = makeItem();
const EPISODES = Array.from({ length: ${N_EPISODES} }, (_, i) => makeEpisode(i));
const SEASONS = [makeEpisode(0)];
const SEASON_QUERY = { isPending: false, isError: false, error: undefined, data: undefined };

// 重渲染压力：父组件持有 tick state，每次 root.render 换 tick 强制整树 reconcile。
function EpisodeScene({ tick }) {
  const [seasonId, setSeasonId] = useState('ep0');
  return createElement(MemoryRouter, null,
    createElement(ItemDetailEpisodeSection, {
      item: EPISODE_ITEM,
      seasonOptions: SEASONS,
      episodeOptions: EPISODES,
      selectedSeasonId: seasonId,
      setSelectedSeasonId: setSeasonId,
      selectedSeasonQuery: SEASON_QUERY,
      key: undefined,
      // tick 只为强制重渲染：父状态变化 = 页面级 setState 的代理
      'data-tick': tick,
    }),
  );
}

function LogsScene({ tick }) {
  const logViews = makeViews(${N_LOGS});
  return createElement(RuntimeLogsDesktopTable, {
    logViews,
    hasItems: true,
    tbodyRef: { current: null },
    onDetail: () => {},
    'data-tick': tick,
  });
}

const twoRaf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

async function benchScene(Scene, rounds) {
  const host = document.getElementById('bench-root');
  const root = createRoot(host);
  const timings = [];
  for (let i = 0; i < rounds; i += 1) {
    const t0 = performance.now();
    root.render(createElement(Scene, { tick: i }));
    await twoRaf();
    const mountMs = performance.now() - t0;
    // 重渲染：同 props 形态 + tick 变化 ⇒ 整树 reconcile（代理 5s refetch / 页面级 setState）
    const t1 = performance.now();
    root.render(createElement(Scene, { tick: i + 100 }));
    await twoRaf();
    const rerenderMs = performance.now() - t1;
    timings.push({ mountMs, rerenderMs });
  }
  root.unmount();
  return timings;
}

window.__bench = {
  async logs(rounds) {
    return benchScene(LogsScene, rounds);
  },
  async episodes(rounds) {
    return benchScene(EpisodeScene, rounds);
  },
};
`;

const SKIP = 3;

async function medianBench(page, kind, rounds = 3) {
  const runs = await page.evaluate((kind2) => window.__bench[kind2](3), kind);
  const med = (arr) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)];
  return {
    mountMs: +med(runs.map((r) => r.mountMs)).toFixed(1),
    rerenderMs: +med(runs.map((r) => r.rerenderMs)).toFixed(1),
  };
}

const work = await mkdtemp(join(tmpdir(), 'f4-perf-'));
try {
  const entryFile = join(work, '__f4Perf-entry.tsx');
  const outDir = join(work, 'dist');
  await writeFile(entryFile, PROBE_ENTRY, 'utf8');
  await (
    await import(nmUrl('vite/dist/node/index.js'))
  ).build({
    configFile: false,
    root: HOST_ROOT,
    logLevel: 'error',
    define: { 'process.env.NODE_ENV': '"development"' },
    resolve: {
      alias: {
        '@fmby/v2-shared': join(HOST_ROOT, '..', 'shared', 'src'),
        '@': join(HOST_ROOT, 'src'),
      },
    },
    build: {
      outDir,
      emptyOutDir: true,
      minify: false,
      lib: { entry: entryFile, formats: ['iife'], name: 'F4Perf', fileName: () => 'probe.js' },
    },
  });

  const { chromium } = await import(nmUrl('@playwright/test/index.mjs'));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setContent('<!doctype html><html><body><div id="bench-root"></div></body></html>');
  await page.addScriptTag({ path: join(outDir, 'probe.js') });

  const logs = await medianBench(page, 'logs');
  const episodes = await medianBench(page, 'episodes');
  await browser.close();

  if (errors.length > 0) {
    console.error('探针抛错:', errors.join('\n'));
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        logs: { n: N_LOGS, ...logs },
        episodes: { n: N_EPISODES, ...episodes },
      },
      null,
      2,
    ),
  );
} finally {
  await rm(work, { recursive: true, force: true });
}

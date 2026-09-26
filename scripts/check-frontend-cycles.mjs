#!/usr/bin/env node

/**
 * scripts/check-frontend-cycles.mjs
 *
 * 前端模块循环依赖门禁（FE-MOD-P2-BATCH ② FE-BARREL-CYCLE）。
 *
 * 背景：仓内 `index.ts` barrel + `export *` 密集（85 个 index.ts / 50+ 行 export *），
 * barrel 与成员互引会形成环（成员从 `'.'` 取兄弟 ⇒ barrel ⇒ 成员）。环本身不必然
 * 编译失败，但会掩盖初始化顺序、拖慢 tree-shaking、并让「谁依赖谁」失真。
 *
 * 判据：`shared/src` + `host/src` + `themes/<theme>/src` 的静态 import/export
 * 依赖图上**不得存在任何环**（零容忍，无基线白名单）。
 * 解析：与 scripts/check-frontend-dupes.mjs 同风格（fs walk + 正则抽模块说明符），
 * 不引新依赖（根 node_modules 无 typescript，不依赖 TS API）。
 * 解析范围：`./x` / `../x` 相对导入；`@/*`（host src）；`@fmby/v2-shared` 与
 * `@fmby/v2-shared/*`（shared src）。外部包（react 等）不入图。
 *
 * 用法：node scripts/check-frontend-cycles.mjs         # 全仓扫，有环 ⇒ exit 1
 *      node scripts/check-frontend-cycles.mjs --selftest  # 自测（造环必红 + 无环必绿）
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const SRC_EXT = ['.ts', '.tsx'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.vite', '.tmp']);

function walkSourceFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(full, out);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.d.ts')) continue;
      if (entry.name === 'vite.config.ts') continue;
      if (SRC_EXT.some((ext) => entry.name.endsWith(ext))) out.push(full);
    }
  }
  return out;
}

/**
 * 剔除注释（行/块）但**保留字符串字面量**——避免把 JSDoc `@example` 里的
 * `import ... from '...'` 当真实依赖（client.ts 顶部示例就会造成自环假阳性）。
 * 逐字符状态机（非正则），保住字符串内的 `//`（如 URL）不被误删。
 */
function stripComments(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      while (i < n && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') out += '\n';
        i += 1;
      }
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < n) {
        out += source[i];
        if (source[i] === '\\') {
          out += source[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (source[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** 静态 import/export 说明符抽取（含 `export * from` 与动态 import()）。 */
const STATIC_FROM_RE = /(?:^|[\s;})])(?:import|export)\b[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/g;
const BARE_IMPORT_RE = /(?:^|[\s;})])import\s*['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function extractSpecifiers(source) {
  const specs = new Set();
  const code = stripComments(source);
  for (const re of [STATIC_FROM_RE, BARE_IMPORT_RE, DYNAMIC_IMPORT_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(code)) !== null) specs.add(m[1]);
  }
  return [...specs];
}

function resolveFile(base) {
  const candidates = [base];
  for (const ext of SRC_EXT) candidates.push(base + ext);
  for (const ext of SRC_EXT) candidates.push(path.join(base, 'index' + ext));
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.resolve(c);
  }
  return null;
}

function resolveSpecifier(fromFile, spec, repoRoot) {
  if (spec.startsWith('.')) {
    return resolveFile(path.resolve(path.dirname(fromFile), spec));
  }
  if (spec === '@fmby/v2-shared') {
    return resolveFile(path.join(repoRoot, 'shared', 'src', 'index.ts'));
  }
  if (spec.startsWith('@fmby/v2-shared/')) {
    return resolveFile(path.join(repoRoot, 'shared', 'src', spec.slice('@fmby/v2-shared/'.length)));
  }
  if (spec.startsWith('@/')) {
    return resolveFile(path.join(repoRoot, 'host', 'src', spec.slice(2)));
  }
  return null; // 外部包，不入图
}

export function buildGraph(files, repoRoot) {
  const graph = new Map();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const edges = [];
    for (const spec of extractSpecifiers(source)) {
      const resolved = resolveSpecifier(file, spec, repoRoot);
      if (resolved) edges.push(resolved);
    }
    graph.set(path.resolve(file), edges);
  }
  return graph;
}

/** DFS 三色找环；返回环列表（每个环 = 文件绝对路径序列，首尾同一文件）。 */
export function findCycles(graph) {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map();
  for (const node of graph.keys()) color.set(node, WHITE);
  const stack = [];
  const cycles = [];

  const visit = (u) => {
    color.set(u, GRAY);
    stack.push(u);
    for (const v of graph.get(u) ?? []) {
      if (!color.has(v)) continue; // 图外（不应发生）
      const c = color.get(v);
      if (c === GRAY) {
        cycles.push(stack.slice(stack.indexOf(v)).concat(v));
      } else if (c === WHITE) {
        visit(v);
      }
    }
    stack.pop();
    color.set(u, BLACK);
  };

  for (const node of graph.keys()) {
    if (color.get(node) === WHITE) visit(node);
  }
  return cycles;
}

function defaultRoots(repoRoot) {
  const roots = [path.join(repoRoot, 'shared', 'src'), path.join(repoRoot, 'host', 'src')];
  const themesDir = path.join(repoRoot, 'themes');
  if (fs.existsSync(themesDir)) {
    for (const entry of fs.readdirSync(themesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const src = path.join(themesDir, entry.name, 'src');
      if (fs.existsSync(src)) roots.push(src);
    }
  }
  return roots;
}

function rel(repoRoot, file) {
  return path.relative(repoRoot, file).replace(/\\/g, '/');
}

function collectAll(repoRoot) {
  const files = [];
  for (const root of defaultRoots(repoRoot)) walkSourceFiles(root, files);
  return files;
}

function runGate() {
  const files = collectAll(REPO_ROOT);
  const graph = buildGraph(files, REPO_ROOT);
  const cycles = findCycles(graph);
  if (cycles.length > 0) {
    console.error(`FAIL(frontend-cycles)：检测到 ${cycles.length} 条模块循环依赖：`);
    for (const cycle of cycles) {
      console.error(`  - ${cycle.map((f) => rel(REPO_ROOT, f)).join(' → ')}`);
    }
    process.exit(1);
  }
  console.log(
    `PASS(frontend-cycles)：${files.length} 个源文件依赖图无环（shared/src + host/src + themes/*/src）`,
  );
  process.exit(0);
}

function runSelftest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-cycles-selftest-'));
  try {
    const root = path.join(tmp, 'repo');
    const sharedSrc = path.join(root, 'shared', 'src');
    const hostSrc = path.join(root, 'host', 'src');
    fs.mkdirSync(sharedSrc, { recursive: true });
    fs.mkdirSync(hostSrc, { recursive: true });

    // 夹具 A：相对导入有环（a → b → a）⇒ 必检出。
    fs.writeFileSync(path.join(sharedSrc, 'a.ts'), "export * from './b';\n");
    fs.writeFileSync(path.join(sharedSrc, 'b.ts'), "import { a } from './a';\n");
    const cyclesA = findCycles(buildGraph(collectAll(root), root));
    if (cyclesA.length === 0) {
      console.error('SELFTEST FAILED：造环夹具未被检出（gate 是哑的）');
      process.exit(1);
    }

    // 夹具 B：无环（c → d）⇒ 不得误报。
    fs.rmSync(path.join(sharedSrc, 'a.ts'));
    fs.rmSync(path.join(sharedSrc, 'b.ts'));
    fs.writeFileSync(path.join(sharedSrc, 'c.ts'), "export * from './d';\n");
    fs.writeFileSync(path.join(sharedSrc, 'd.ts'), 'export const d = 1;\n');
    const cyclesB = findCycles(buildGraph(collectAll(root), root));
    if (cyclesB.length !== 0) {
      console.error(`SELFTEST FAILED：无环夹具被误报（false positive）：${JSON.stringify(cyclesB)}`);
      process.exit(1);
    }

    // 夹具 C：`@/` 别名环（host f ↔ g）⇒ 必检出（证明别名被解析、不是图外）。
    fs.writeFileSync(path.join(hostSrc, 'f.ts'), "import { g } from '@/g';\n");
    fs.writeFileSync(path.join(hostSrc, 'g.ts'), "import { f } from '@/f';\n");
    const cyclesC = findCycles(buildGraph(collectAll(root), root));
    if (cyclesC.length === 0) {
      console.error('SELFTEST FAILED：`@/` 别名环未被检出（别名解析失效）');
      process.exit(1);
    }

    // 夹具 D：`@fmby/v2-shared/*` 跨包说明符解析到 shared（边存在）。
    fs.writeFileSync(
      path.join(hostSrc, 'e.ts'),
      "export { c } from '@fmby/v2-shared/c';\n",
    );
    const graphD = buildGraph(collectAll(root), root);
    const eEdges = graphD.get(path.resolve(path.join(hostSrc, 'e.ts'))) ?? [];
    if (!eEdges.includes(path.resolve(path.join(sharedSrc, 'c.ts')))) {
      console.error('SELFTEST FAILED：`@fmby/v2-shared/*` 跨包说明符未解析到 shared/src');
      process.exit(1);
    }

    console.log('SELFTEST PASSED：相对环必检出 / 无环不误报 / `@/` 环必检出 / 跨包别名可解析');
    process.exit(0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv.includes('--selftest')) {
  runSelftest();
} else {
  runGate();
}

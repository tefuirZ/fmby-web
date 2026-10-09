/**
 * 构建可用性回归锁：管理面组件的 CSS 相对导入必须真实可达。
 *
 * 缺陷来源：`MountLibraryBindingSection.tsx` 从
 *   `mounts/components/MountDrawer/sections/`（距 `longtail-shared/` **4 级**）
 * 写成 `../../../longtail-shared/ManageShared.module.css`（**3 级**），少一级。
 * ⇒ `pnpm build` 硬红：
 *   Could not resolve "../../../longtail-shared/ManageShared.module.css"
 *
 * 为什么值得单独立一条测试：
 *   host 全量单测跑的是 `node --import ./tests/register-aliases.mjs`，
 *   **不解 CSS 导入**，所以这个断链对单测完全隐形（425/425 全绿）；
 *   只有 `pnpm build`（vite/rollup 解析）才炸 ⇒ 断链能一路合进 main。
 *   故本测试直接做**路径可达性检查**，把「构建期错误」前移到单测期。
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');

/** 递归收集 .tsx/.ts 源文件。 */
function collectSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectSources(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** 抓取相对导入的 css 路径字面量。 */
function relativeCssImports(source: string): string[] {
  const out: string[] = [];
  const re = /from\s+['"](\.[^'"]+\.css)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) out.push(m[1]);
  return out;
}

describe('CSS 相对导入可达性（构建期错误的单测期前移）', () => {
  it('全仓相对 CSS 导入都能在磁盘上解析到真实文件', () => {
    const broken: string[] = [];
    for (const file of collectSources(SRC_ROOT)) {
      for (const spec of relativeCssImports(readFileSync(file, 'utf-8'))) {
        const target = resolve(dirname(file), spec);
        if (!existsSync(target)) {
          broken.push(`${file.slice(SRC_ROOT.length + 1)} → ${spec}`);
        }
      }
    }
    assert.deepEqual(
      broken,
      [],
      `以下相对 CSS 导入无法解析（pnpm build 会硬红，但 host 单测对 CSS 导入隐形）：\n${broken.join('\n')}`,
    );
  });

  it('MountLibraryBindingSection 的样式导入层级正确（针对本缺陷的定点锁）', () => {
    const file = join(
      SRC_ROOT,
      'pages/manage/mounts/components/MountDrawer/sections/MountLibraryBindingSection.tsx',
    );
    const specs = relativeCssImports(readFileSync(file, 'utf-8'));
    assert.ok(specs.length > 0, '该组件应导入共享样式');
    for (const spec of specs) {
      assert.ok(
        existsSync(resolve(dirname(file), spec)),
        `样式导入不可达：${spec}（sections/ 距 longtail-shared/ 是 4 级，须用 ../../../../）`,
      );
    }
  });
});
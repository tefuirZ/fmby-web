/**
 * 前端 `node:test` 解析器钩子（WEB-B1 测试基建）。
 *
 * 背景：`apps/shared/src/**` 与 `apps/host/src/**` 沿用 TS 的**无扩展名相对导入**
 * （如 `import { x } from './api'`），tsc/vite 下正常，但 Node ESM 要求显式扩展名，
 * 直接 `node --test` 跑 `.ts` 测试会 ERR_MODULE_NOT_FOUND / ERR_UNSUPPORTED_DIR_IMPORT。
 * 仓库此前无前端单测 runner，本钩子补齐：Node 24 原生 strip-types + 本解析器。
 *
 * 用法：
 *   node --import ./tests/ts-resolver.mjs --test tests/*.test.ts
 */

import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as resolvePath, extname, join } from 'node:path';

const SHARED_SRC = resolvePath(import.meta.dirname, '..', 'src');

function firstExisting(candidates) {
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // 忽略权限/竞态，继续尝试下一个候选
    }
  }
  return undefined;
}

/** 无扩展名/目录说明符 → 候选文件列表。 */
function expand(base) {
  // ★F9 修正：extname(base) 非空 ≠ 「base 已是最终文件名」。`error-catalog.generated`
  // 的 extname 是 '.generated'，旧逻辑据此不再补 '.ts' ⇒ 凡 import 链触到
  // errors/error.ts 的测试（auth-failure / viewmodels 任意 contract 链）裸跑
  // node --test 一律 ERR_MODULE_NOT_FOUND（与 host/tests/host-alias-loader.mjs
  // 的 as-is → .ts → /index.ts 逐级回退对齐）。改为：base 本体存在就用本体；
  // 已是 ts/js 扩展名的维持原候选；否则一律展开候选，firstExisting 收口。
  if (existsSync(base) && statSync(base).isFile()) {
    return [base];
  }
  const ext = extname(base);
  if (ext === '.ts' || ext === '.tsx' || ext === '.js') {
    return [base];
  }
  return [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
    `${base}.js`,
    join(base, 'index.js'),
  ];
}

/** `@fmby/v2-shared/...` → 本地 src 路径。 */
function selfReference(specifier) {
  const prefix = '@fmby/v2-shared';
  if (!specifier.startsWith(prefix)) {
    return undefined;
  }
  const rest = specifier.slice(prefix.length).replace(/^\//, '');
  if (rest === '') {
    return firstExisting(expand(join(SHARED_SRC, 'index')));
  }
  return firstExisting(expand(join(SHARED_SRC, rest)));
}

export async function resolve(specifier, context, nextResolve) {
  // 1) 本包自引用 → 本地 src
  const self = selfReference(specifier);
  if (self) {
    return nextResolve(pathToFileURL(self).href, context);
  }

  // 2) 相对导入 → 补扩展名
  if (specifier.startsWith('.') && context.parentURL) {
    let parentPath;
    try {
      parentPath = context.parentURL.startsWith('file:')
        ? fileURLToPath(context.parentURL)
        : context.parentURL;
    } catch {
      parentPath = context.parentURL;
    }
    const parentDir = dirname(parentPath);
    const resolved = firstExisting(expand(resolvePath(parentDir, specifier)));
    if (resolved) {
      return nextResolve(pathToFileURL(resolved).href, context);
    }
  }

  return nextResolve(specifier, context);
}

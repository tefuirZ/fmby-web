// node:test 模块别名 loader（仅测试基建，不参与构建产物）。
// 项目未引入 vitest/jest，node 原生跑 TS 单测时需要把
// `@fmby/v2-shared/*` 包别名映射到 monorepo 源码，并为
// moduleResolution: bundler 风格的无扩展名相对导入补全 `.ts`。
import { fileURLToPath, pathToFileURL } from 'node:url';

const loaderDir = fileURLToPath(new URL('.', import.meta.url));
const sharedSrcUrl = pathToFileURL(`${loaderDir}../src/`).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@fmby/v2-shared') {
    return nextResolve(`${sharedSrcUrl}index.ts`, context);
  }
  if (specifier.startsWith('@fmby/v2-shared/')) {
    const rest = specifier.slice('@fmby/v2-shared/'.length);
    return nextResolve(`${sharedSrcUrl}${rest}.ts`, context);
  }
  if (specifier.startsWith('.')) {
    try {
      return await nextResolve(specifier, context);
    } catch (error) {
      // TS 源内 './error' 这类无扩展名导入，node ESM 解析失败时补 .ts 重试
      return nextResolve(`${specifier}.ts`, context);
    }
  }
  return nextResolve(specifier, context);
}

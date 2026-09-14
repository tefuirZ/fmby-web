// host 模块别名 loader（仅测试基建）。在 shared loader 基础上追加 host
// `@/*` → src/* 解析（TS 无扩展名补全 + 目录 index 回退）。
import { fileURLToPath, pathToFileURL } from 'node:url';

const loaderDir = fileURLToPath(new URL('.', import.meta.url));
const hostSrcUrl = pathToFileURL(`${loaderDir}../src/`).href;
const sharedSrcUrl = pathToFileURL(`${loaderDir}../../shared/src/`).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const rest = specifier.slice(2);
    try {
      return await nextResolve(`${hostSrcUrl}${rest}.ts`, context);
    } catch {
      return nextResolve(`${hostSrcUrl}${rest}/index.ts`, context);
    }
  }
  if (specifier === '@fmby/v2-shared') {
    return nextResolve(`${sharedSrcUrl}index.ts`, context);
  }
  if (specifier.startsWith('@fmby/v2-shared/')) {
    const rest = specifier.slice('@fmby/v2-shared/'.length);
    try {
      return await nextResolve(`${sharedSrcUrl}${rest}.ts`, context);
    } catch {
      return nextResolve(`${sharedSrcUrl}${rest}/index.ts`, context);
    }
  }
  if (specifier.startsWith('.')) {
    try {
      return await nextResolve(specifier, context);
    } catch {
      return nextResolve(`${specifier}.ts`, context);
    }
  }
  return nextResolve(specifier, context);
}

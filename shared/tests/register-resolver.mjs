/**
 * 前端 `node:test` 模块解析器注册（WEB-B1 测试基建）。
 *
 * 背景：`apps/shared/src/**` / `apps/host/src/**` 沿用 TS 的**无扩展名相对导入**
 * （如 `from './api'`），tsc/vite 正常，但 Node ESM 要求显式扩展名 → 直接
 * `node --test` 跑 `.ts` 测试会 ERR_MODULE_NOT_FOUND / ERR_UNSUPPORTED_DIR_IMPORT。
 * 仓库此前无前端单测 runner，本文件补齐该能力（Node 24 原生 strip-types + 本解析器）。
 *
 * 用法：
 *   node --import ./tests/register-resolver.mjs --test tests/*.test.ts
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./ts-resolver.mjs', pathToFileURL(import.meta.dirname + '/'));

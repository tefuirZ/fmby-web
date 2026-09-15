import { existsSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

/**
 * THEME-BUILD-01：主题独立产物构建（library 模式）。
 *
 * 产出 `dist/index.js`（ESM，default export ThemeEntryModule）——host 运行时
 * 经 `/themes/<id>/index.js` 外挂加载（ADR-001 §4 运行时路径），host bundle
 * 不再内联主题代码。
 *
 * external：react（宿主提供单例）+ @fmby/v2-shared（主题协议/类型，宿主已有）。
 * 主题产物内不允许打包第二份 react/shared——check-frontend-size.mjs 隔离闸
 * 会反查产物内容。
 */
export default defineConfig({
  build: {
    lib: {
      // C（2026-09-15 用户裁定）：主题源码**同时支持 .ts / .tsx / .js / .jsx**——
      // 第三方主题作者可自由选择语言（旧主题常用纯 JS；TS 类型安全可选）。
      // 自动探测入口（按优先级），不存在则报错提示。
      entry: (() => {
        const candidates = ['./src/index.ts', './src/index.tsx', './src/index.jsx', './src/index.js'];
        for (const c of candidates) {
          const abs = fileURLToPath(new URL(c, import.meta.url));
          if (existsSync(abs)) return abs;
        }
        throw new Error(`主题入口未找到（尝试过 ${candidates.join(' / ')}）`);
      })(),
      // IIFE + globals：产物可经 <script> 注入执行（浏览器无 importmap 也能跑），
      // react/react-dom/@fmby/v2-shared 由宿主以全局变量提供，杜绝第二份 react。
      formats: ['iife'],
      name: 'FmbyTheme',
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        /^@fmby\/v2-shared(\/.*)?$/,
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'ReactJSXRuntime',
          '@fmby/v2-shared': 'FmbyShared',
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
  },
});

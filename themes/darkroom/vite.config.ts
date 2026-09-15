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
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        /^@fmby\/v2-shared(\/.*)?$/,
      ],
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
  },
});

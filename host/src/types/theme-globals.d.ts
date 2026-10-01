/**
 * 主题宿主全局桥的类型声明（FE-STRICT-TYPES）。
 *
 * `themeGlobals.ts` 在宿主启动早期把**宿主同一份** react / react-dom /
 * jsx-runtime 实例挂到 `window`；`registry.ts` 读主题 IIFE 产物落下的
 * `window.FmbyTheme`。这些是 host 专属的运行时约定，集中在此声明后，读取处可
 * 直接 `window.React` / `window.FmbyTheme`，无需 `window as unknown as
 * Record<string, unknown>` 把全局对象打回 unknown 再断言。
 *
 * 注：`FmbyShared` 暂未预绑定（主题对 shared 目前仅 `import type` 类型引用，
 * 构建期擦除），故不声明；第三方主题若需运行时消费 shared，应先扩展
 * `themeGlobals.ts` 的桥再接类型。
 */
interface Window {
  React?: typeof import('react');
  ReactDOM?: typeof import('react-dom');
  ReactJSXRuntime?: typeof import('react/jsx-runtime');
  FmbyTheme?: import('@fmby/v2-shared/theme').ThemeEntryModule;
}

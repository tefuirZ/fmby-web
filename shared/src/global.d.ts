/**
 * 环境声明（shared 包独立 typecheck 用）
 *
 * CSS Module 类型：本包不依赖 vite（无构建步骤），此处给出与
 * vite/client 等价的 *.module.css 声明，由消费方（host）的 Vite 管线编译。
 */

declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

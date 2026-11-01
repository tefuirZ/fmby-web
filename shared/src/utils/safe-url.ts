/**
 * 只放行 `http:` / `https:` 的 href 净化（防 `javascript:` / `data:` / `vbscript:` / `file:` 等）。
 *
 * 为什么需要：远端刮削元数据（海报/远程资源/字幕的 `url`）与 OAuth `authorize_url` 都由
 * **外部来源**给出，前端原先 `href={record.url}` 原样透传。被污染的刮削源可让管理员点一次
 * 「查看原图」即以管理员身份执行脚本（配合同源 CSRF 回显，写请求会被判合法）
 * = 存储型 XSS → 越权写。
 *
 * ★威胁前提的**实测更正**（2026-11-01 评审实测 React 19.2.8 + react-dom/server）：
 *   - `<a href="javascript:...">` 现版本**会被框架拦**（React 把该 href 换成一段
 *     `throw new Error('React has blocked a javascript: URL…')` 的占位串）；
 *   - 但 `location.assign(url)` / `window.open(url)` 这类**非 href sink** React 管不到，
 *     实测仍会执行 —— 那才是本卡真正可被利用的那一处（本 PR 已修）。
 *   ⇒ 本工具的意义是**纵深防御**：不把安全押在框架版本行为上（旧版本/其它渲染路径不保证）。
 *   （原文写「React 只告警、不拦截」不实，此处按实测改正。）
 *
 * 语义对齐仓内既有 `licenseFormat.ts::safeExternalHref`：只放行 http/https，其余返回 null。
 * 额外拒绝 ASCII 控制字符——`java\nscript:` 这类「换行/制表符插入」在部分解析器里会被
 * 读成 `javascript:`，先拒比交给 URL 解析器猜更稳。
 *
 * 用法：`href={safeExternalHref(record.url) ?? undefined}` —— `undefined` 时 React 不写
 * href 属性，链接保留样式但不可点击、不执行任何协议。
 */
export function safeExternalHref(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  // trim 后为空 ⇒ null。★别省这一步：`new URL('', base)` 会解析成 **base 自身**，
  // 于是空串会返回 `https://<origin>/` 而不是 null（本文件自带的判据测试当场抓到）。
  if (!trimmed) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  const base =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://localhost';
  try {
    const url = new URL(trimmed, base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * 只放行**站内路径**（`/foo`）—— 用于 `<Link to>` 这类**站内路由** sink。
 *
 * 为什么单列：`<Link to>` 底出的是 `<a href>`，由 router 原样透传（实测 react-router 7
 * 对 `to="javascript:alert(1)"` 与 `to="data:text/html,..."` **原样直出**；
 * `javascript:` 仅靠 React 的 href 拦截兜底，而 React 对 `data:` **不拦**）。
 * 数据源是**服务端下发的** `admin_shortcuts[].to|href`（远端刮削）⇒ 与 `safeExternalHref`
 * 同威胁模型，但**站内链接不该允许任何外部 scheme/主机**。
 *
 * 判据：单斜杠开头；排除 `//host` 与 `/\host`（浏览器按**协议相对 URL**处理 ⇒ 会变外站）；
 * 排除 ASCII 控制字符（`java\nscript:` 式伪装）。其余原样返回，非字符串/空 ⇒ null。
 */
export function safeInAppPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return null;
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  return trimmed;
}

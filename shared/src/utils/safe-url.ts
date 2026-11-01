/**
 * 只放行 `http:` / `https:` 的 href 净化（防 `javascript:` / `data:` / `vbscript:` / `file:` 等）。
 *
 * 为什么需要：远端刮削元数据（海报/远程资源/字幕的 `url`）与 OAuth `authorize_url` 都由
 * **外部来源**给出，前端原先 `href={record.url}` 原样透传。React 对 `javascript:` href
 * **只告警、不拦截** ⇒ 被污染的刮削源可让管理员点一次「查看原图」即以管理员身份执行任意
 * 脚本（配合同源的 CSRF 回显，写请求会被判合法）= 存储型 XSS → 越权写。
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

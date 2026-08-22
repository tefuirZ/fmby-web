/**
 * 图片可用性探测器
 *
 * 背景：后端对不存在的图片返回 204 No Content，<img> 收到 204 既不触发
 * onload 也不触发 onerror，导致降级链卡死出现裂图。
 *
 * 只探测前端投机拼接的 /api/assets/ 前缀 URL（这类 URL 总是存在但资源可能为空）；
 * 其它 URL（后端明确返回的外链）直接视为可用，交给 <img> 的 onError 兜底。
 *
 * 探测用 GET：响应进浏览器 HTTP 缓存，后续 <img> 命中缓存不放大流量；
 * 204/4xx 响应体为空，代价极小。同 URL 并发共享同一 Promise，终态常驻缓存。
 */

export type ProbeResult = 'ok' | 'bad';

const cache = new Map<string, ProbeResult | Promise<ProbeResult>>();

const PROBE_PREFIX = '/api/assets/';

export function needsProbe(url: string): boolean {
  return url.startsWith(PROBE_PREFIX);
}

/**
 * 返回缓存中的终态结果；未探测过或仍在探测中返回 undefined。
 */
export function getProbeResult(url: string): ProbeResult | undefined {
  const entry = cache.get(url);
  return entry === 'ok' || entry === 'bad' ? entry : undefined;
}

/**
 * 探测图片 URL 是否真实可用。
 *
 * - 非 /api/assets/ 前缀：同步返回 'ok'
 * - 已有终态：同步返回终态
 * - 探测中：返回共享的 Promise
 */
export function probeImage(url: string): ProbeResult | Promise<ProbeResult> {
  if (!needsProbe(url)) {
    return 'ok';
  }

  const existing = cache.get(url);
  if (existing !== undefined) {
    return existing;
  }

  const pending = fetch(url, { method: 'GET' })
    .then((response): ProbeResult => {
      const contentType = response.headers.get('content-type') ?? '';
      const ok = response.ok && response.status !== 204 && contentType.startsWith('image/');
      return ok ? 'ok' : 'bad';
    })
    .catch((): ProbeResult => 'bad')
    .then((result) => {
      cache.set(url, result);
      return result;
    });

  cache.set(url, pending);
  return pending;
}

/**
 * 站点品牌字段的纯校验（EMAIL-CHANNEL / WEB-EMAIL-UI ⑤）。
 *
 * 与后端校验对齐（后端权威，前端只做即时提示，仍以服务端 400 为准）：
 * - site_name ≤ 256 字符；空串表示清除（合法）。
 * - brand_logo_url ≤ 2048，且须同源路径 `/…` 或 http(s)://；空串表示清除（合法）。
 *   拒绝 javascript:/data: 等 scheme（会渲染进邮件 <img src>）。
 */

export const BRAND_SITE_NAME_MAX = 256;
export const BRAND_LOGO_URL_MAX = 2048;

/** 是否同源路径（`/...`，且不是 `//host` 协议相对外链）或 http(s) 绝对 URL。 */
export function isSameOriginPathOrHttpUrl(value: string): boolean {
  if (value === '') return true;
  if (value.startsWith('/')) {
    // `//evil.com` 是协议相对外链，不算同源路径
    return !value.startsWith('//');
  }
  return /^https?:\/\//i.test(value);
}

export interface BrandDraftLike {
  siteName: string;
  brandLogoUrl: string;
}

/** 返回错误信息；两者皆合法返回 null。 */
export function validateBrandDraft(draft: BrandDraftLike): string | null {
  if (draft.siteName.length > BRAND_SITE_NAME_MAX) {
    return `品牌名不能超过 ${BRAND_SITE_NAME_MAX} 个字符`;
  }
  if (draft.brandLogoUrl.length > BRAND_LOGO_URL_MAX) {
    return `Logo 地址不能超过 ${BRAND_LOGO_URL_MAX} 个字符`;
  }
  if (!isSameOriginPathOrHttpUrl(draft.brandLogoUrl)) {
    return 'Logo 地址须为同源路径（/…）或 http(s) 链接';
  }
  return null;
}

/**
 * 站点品牌 API（EMAIL-CHANNEL / WEB-EMAIL-UI ⑤）。
 *
 * 端点：GET / PUT /api/admin/site-settings（admin, manage:settings）。
 *
 * 关键契约（已核后端 e2e）：
 * - DTO 含 theme_mode / timezone_display / site_name? / brand_logo_url?。
 * - theme_mode / timezone_display 在 DTO 中**必填**（无 default）→ PUT 必须把
 *   GET 拿到的这两个值原样回传，否则 400。
 * - site_name / brand_logo_url 是 #[serde(default)]：缺省=不改；""（含纯空白）=清除。
 * - 校验：site_name ≤ 256；brand_logo_url ≤ 2048 且须同源路径 /… 或 http(s)://，
 *   后端拒 javascript:/data:（会渲染进邮件 <img src>）→ 非法 400。
 * - 403 非管理员；500 服务未装配。
 *
 * 既有 /api/settings/server/general 的 general.siteName 是另一个面，不要互相覆盖。
 */

import { httpClient } from '@fmby/v2-shared/api/client';

interface RawSiteSettings {
  theme_mode: string;
  timezone_display: string;
  site_name?: string | null;
  brand_logo_url?: string | null;
}

/** GET 回显（camelCase）。品牌字段缺失时回退 null。 */
export interface SiteSettingsBrand {
  themeMode: string;
  timezoneDisplay: string;
  siteName: string | null;
  brandLogoUrl: string | null;
}

/** 页面草稿：保留 GET 的必填字段原值，只改品牌两字段。 */
export interface SiteBrandDraft {
  themeMode: string;
  timezoneDisplay: string;
  siteName: string;
  brandLogoUrl: string;
}

function mapSiteSettings(raw: RawSiteSettings): SiteSettingsBrand {
  return {
    themeMode: raw.theme_mode,
    timezoneDisplay: raw.timezone_display,
    siteName: raw.site_name ?? null,
    brandLogoUrl: raw.brand_logo_url ?? null,
  };
}

export const siteSettingsApi = {
  async getBrand(): Promise<SiteSettingsBrand> {
    const raw = await httpClient.get<RawSiteSettings>('/api/admin/site-settings');
    return mapSiteSettings(raw);
  },

  /**
   * 保存品牌。theme_mode / timezone_display 必须原样回传（必填字段）。
   * 品牌字段缺省（null）不改变；空串 "" 表示清除。
   */
  async putBrand(draft: SiteBrandDraft): Promise<SiteSettingsBrand> {
    const raw = await httpClient.put<RawSiteSettings>('/api/admin/site-settings', {
      body: {
        theme_mode: draft.themeMode,
        timezone_display: draft.timezoneDisplay,
        site_name: draft.siteName,
        brand_logo_url: draft.brandLogoUrl,
      },
    });
    return mapSiteSettings(raw);
  },
};

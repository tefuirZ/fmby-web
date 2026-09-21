/**
 * 站点设置 · 品牌区（EMAIL-CHANNEL / WEB-EMAIL-UI ⑤）。
 *
 * 自包含：独立查询/保存 GET/PUT /api/admin/site-settings，不并入既有 general 草稿
 * （general.siteName 是另一个端点，勿互相覆盖）。
 *
 * ⚠️ 后端坑：DTO 的 theme_mode / timezone_display 是必填（无 default），
 * PUT 必须把 GET 拿到的原值回传，只改品牌两字段。
 * 语义：品牌字段缺省=不改；""=清除。非法 logo scheme/超长由前端即时提示 + 后端 400。
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { siteSettingsApi, type SiteBrandDraft } from '@fmby/v2-shared/contracts/settings';
import { isServiceUnwiredError } from '@fmby/v2-shared/contracts/manage/peripherals';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { queryKeys } from '@fmby/v2-shared/query';
import { ManageSectionCard } from '../../longtail-shared/components';
import styles from '../../longtail-shared/ManageShared.module.css';
import { validateBrandDraft } from '../brandValidation';

const siteBrandKey = queryKeys.manage.siteBrand();

export function SiteSettingsBrandSection() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SiteBrandDraft | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const brandQuery = useQuery({
    queryKey: siteBrandKey,
    queryFn: async () => {
      try {
        return await siteSettingsApi.getBrand();
      } catch (err) {
        if (isServiceUnwiredError(err)) {
          return null;
        }
        throw err;
      }
    },
  });

  useEffect(() => {
    if (brandQuery.data) {
      setDraft({
        themeMode: brandQuery.data.themeMode,
        timezoneDisplay: brandQuery.data.timezoneDisplay,
        // 缺省 null → 草稿空串（保存时原样回传，等价于不变）
        siteName: brandQuery.data.siteName ?? '',
        brandLogoUrl: brandQuery.data.brandLogoUrl ?? '',
      });
    }
  }, [brandQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error('品牌草稿尚未就绪');
      return siteSettingsApi.putBrand(draft);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(siteBrandKey, saved);
      setDraft({
        themeMode: saved.themeMode,
        timezoneDisplay: saved.timezoneDisplay,
        siteName: saved.siteName ?? '',
        brandLogoUrl: saved.brandLogoUrl ?? '',
      });
      setBanner('品牌设置已保存。邮件模板中的品牌名/logo 将读取此设置。');
    },
  });

  const unavailable = brandQuery.data === null;
  const previewUrl = draft?.brandLogoUrl ?? '';
  const previewValid = previewUrl !== '' && validateBrandDraft({
    siteName: '',
    brandLogoUrl: previewUrl,
  }) === null;

  function handleSave() {
    if (!draft) return;
    setBanner(null);
    const error = validateBrandDraft(draft);
    setLocalError(error);
    if (error) return;
    saveMutation.mutate();
  }

  return (
    <ManageSectionCard
      title="品牌（邮件与重置页）"
      description="邮件中的品牌名与 logo 读取此设置；无 logo 时邮件省略 logo 段（不假造）。"
    >
      {brandQuery.isPending ? (
        <div className={styles.mutedText}>正在加载品牌设置…</div>
      ) : brandQuery.isError ? (
        <InlineBanner
          variant="error"
          title="品牌设置读取失败"
          description={getErrorMessage(brandQuery.error)}
        />
      ) : unavailable || !draft ? (
        <InlineBanner
          variant="info"
          title="品牌端点未装配"
          description="GET/PUT /api/admin/site-settings 暂不可用（500 端口未装配）。"
        />
      ) : (
        <div id="site-brand" className={styles.fieldGroup}>
          {banner ? <InlineBanner variant="success" title={banner} /> : null}
          {localError ? (
            <InlineBanner variant="error" title="品牌设置校验未通过" description={localError} />
          ) : null}
          {saveMutation.isError ? (
            <InlineBanner
              variant="error"
              title="品牌设置保存失败"
              description={getErrorMessage(saveMutation.error)}
            />
          ) : null}

          <label className={styles.label}>
            品牌名（site_name，≤256）
            <input
              className={styles.input}
              value={draft.siteName}
              placeholder="留空 = 清除品牌名"
              onChange={(event) => {
                setBanner(null);
                setLocalError(null);
                setDraft((current) =>
                  current ? { ...current, siteName: event.target.value } : current,
                );
              }}
            />
            <span className={styles.fieldHint}>空串表示清除；缺省不改。</span>
          </label>

          <label className={styles.label}>
            Logo 地址（brand_logo_url，同源路径 /… 或 http(s)，≤2048）
            <input
              className={styles.input}
              value={draft.brandLogoUrl}
              placeholder="/assets/logo.svg 或 https://…"
              onChange={(event) => {
                setBanner(null);
                setLocalError(null);
                setDraft((current) =>
                  current ? { ...current, brandLogoUrl: event.target.value } : current,
                );
              }}
            />
            <span className={styles.fieldHint}>
              空串表示清除；拒绝 javascript:/data:（会被渲染进邮件 img src）。
            </span>
          </label>

          <div className={styles.fieldRow}>
            <div className={styles.label}>
              Logo 预览
              <div
                style={{
                  marginTop: 8,
                  minHeight: 64,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                {previewValid ? (
                  <img
                    src={previewUrl}
                    alt="品牌 Logo 预览"
                    style={{ maxHeight: 64, maxWidth: 240, objectFit: 'contain' }}
                  />
                ) : (
                  <span className={styles.mutedText}>
                    {previewUrl === '' ? '未设置 logo（邮件将省略 logo 段）' : '地址非法或无法预览'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className={styles.buttonRow}>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={saveMutation.isPending}
              onClick={handleSave}
            >
              {saveMutation.isPending ? '保存中…' : '保存品牌设置'}
            </button>
          </div>
        </div>
      )}
    </ManageSectionCard>
  );
}

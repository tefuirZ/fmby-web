/** 命名刮削页头部 + 横幅（V1F 拆分：ManageNamingRulesPage → 子组件）。 */

import { RotateCcw, Save, Wand2 } from 'lucide-react';
import { InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import type { BannerState } from '@fmby/v2-shared/ui/types';
import { ManagePageHeader } from '../../longtail-shared/components';
import sharedStyles from '../../longtail-shared/ManageShared.module.css';
import type { useNamingRulesPageState } from '../hooks';

interface NamingRulesHeaderProps {
  draft: ReturnType<typeof useNamingRulesPageState>['draft'];
  savedRulePackVersion: number | string;
  isDirty: boolean;
  savePending: boolean;
  banner: BannerState | null;
  onResetDraftToSaved: () => void;
  onResetToDefaults: () => void;
  onSaveDraft: () => void;
}

export function NamingRulesHeader({
  draft,
  savedRulePackVersion,
  isDirty,
  savePending,
  banner,
  onResetDraftToSaved,
  onResetToDefaults,
  onSaveDraft,
}: NamingRulesHeaderProps) {
  return (
    <>
      <ManagePageHeader
        title="命名刮削设置"
        description="这页收口命名清洗、识别后自动刮削、主元数据来源、元数据语言和缺失海报补刮。数据库是元数据真相源，海报会落本地缓存，不再只存一条屁用没有的外链。"
        meta={
          <div className={sharedStyles.metaRow}>
            <StatusBadge label="TMDB 主链路已接通" variant="success" />
            <StatusBadge
              label={draft.metadataSource === 'douban' ? '豆瓣主元数据已启用' : 'TMDB 主元数据'}
              variant={draft.metadataSource === 'douban' ? 'info' : 'success'}
            />
            <StatusBadge
              label={isDirty ? '存在未保存修改' : '设置已同步'}
              variant={isDirty ? 'warning' : 'info'}
            />
            <span className={sharedStyles.metaText}>
              当前清洗规则版本：{savedRulePackVersion}
            </span>
          </div>
        }
        actions={
          <div className={sharedStyles.headerActions}>
            <button
              className={sharedStyles.ghostButton}
              disabled={!isDirty || savePending}
              onClick={onResetDraftToSaved}
            >
              <RotateCcw size={16} />
              重置未保存
            </button>
            <button className={sharedStyles.secondaryButton} onClick={onResetToDefaults}>
              <Wand2 size={16} />
              恢复默认草稿
            </button>
            <button
              className={sharedStyles.primaryButton}
              disabled={!isDirty || savePending}
              onClick={onSaveDraft}
            >
              <Save size={16} />
              {savePending ? '保存中…' : '保存设置'}
            </button>
          </div>
        }
      />

      {banner ? (
        <InlineBanner
          variant={banner.variant}
          title={banner.title}
          description={banner.description}
        />
      ) : null}
    </>
  );
}

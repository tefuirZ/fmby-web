import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';
import type { SiteSettingsDraft } from './site-settings/types';
import { useSiteSettingsQuery, useSiteSettingsMutations } from './site-settings/hooks';
import {
  SiteSettingsBasicSection,
  SiteSettingsRegistrationSection,
  SiteSettingsSecuritySection,
  SiteSettingsSessionSection,
} from './site-settings/components';

export function ManageSiteSettingsPage() {
  const settingsQuery = useSiteSettingsQuery();
  const [draft, setDraft] = useState<SiteSettingsDraft | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (settingsQuery.data) {
      setDraft(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  const { saveMutation } = useSiteSettingsMutations({
    onSettledSuccess: (message) => {
      setSuccess(message);
      if (settingsQuery.data) {
        setDraft(settingsQuery.data);
      }
    },
  });

  if (settingsQuery.isPending || !draft) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载站点设置"
        description="正在把常规、安全和会话设置合到一页里。"
      />
    );
  }

  if (settingsQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="站点设置加载失败"
        description={getErrorMessage(settingsQuery.error)}
        action={
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => settingsQuery.refetch()}
          >
            重试
          </button>
        }
      />
    );
  }

  const dirty = JSON.stringify(settingsQuery.data) !== JSON.stringify(draft);

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="站点设置"
        description="把注册、登录安全和会话时长放在一页改完，不用在后台里来回翻。"
        actions={
          <>
            <Link className={styles.secondaryButton} to="/manage/site/advanced">
              去高级维护
            </Link>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => draft && saveMutation.mutate(draft)}
              disabled={!dirty || saveMutation.isPending}
            >
              {saveMutation.isPending ? '保存中…' : '保存站点设置'}
            </button>
          </>
        }
      />

      <InlineBanner
        variant="info"
        title="这里只放站点级常用设置。"
        description="媒体来源、媒体库、命名与刮削的高级项仍然留在各自页面里，不再把模块设置拆到全局页里。"
      />

      {success ? (
        <InlineBanner
          variant="success"
          title={success}
          description="三组站点设置已经一起写回服务端。"
        />
      ) : null}

      {saveMutation.isError ? (
        <InlineBanner
          variant="error"
          title="保存站点设置失败"
          description={getErrorMessage(saveMutation.error)}
        />
      ) : null}

      <ManageSectionCard
        title="快速定位"
        description="直接跳到你现在要改的那一组，不用扫完整页。"
      >
        <div className={styles.buttonRow}>
          <a className={styles.smallButton} href="#site-basic">
            站点信息
          </a>
          <a className={styles.smallButton} href="#site-registration">
            注册与公告
          </a>
          <a className={styles.smallButton} href="#site-security">
            登录安全
          </a>
          <a className={styles.smallButton} href="#site-session">
            会话时长
          </a>
          <a className={styles.smallButton} href="#site-compat">
            兼容与高级
          </a>
        </div>
      </ManageSectionCard>

      <SiteSettingsBasicSection
        draft={draft}
        setDraft={setDraft}
        setSuccess={setSuccess}
      />

      <SiteSettingsRegistrationSection
        draft={draft}
        setDraft={setDraft}
        setSuccess={setSuccess}
      />

      <SiteSettingsSecuritySection
        draft={draft}
        setDraft={setDraft}
        setSuccess={setSuccess}
      />

      <SiteSettingsSessionSection
        draft={draft}
        setDraft={setDraft}
        setSuccess={setSuccess}
      />

      {dirty ? (
        <div className={styles.stickyBar}>
          <div className={styles.stackText}>
            <strong>有未保存修改</strong>
            <span className={styles.mutedText}>
              这一页会一次性保存站点常规、登录安全和会话策略。
            </span>
          </div>
          <div className={styles.rowActions}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => {
                setSuccess(null);
                setDraft(settingsQuery.data);
              }}
              disabled={saveMutation.isPending}
            >
              放弃修改
            </button>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => draft && saveMutation.mutate(draft)}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? '保存中…' : '保存站点设置'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ManageSiteSettingsPage;

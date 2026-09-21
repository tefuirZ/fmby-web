/**
 * 邮件通道配置页（EMAIL-CHANNEL / WEB-EMAIL-UI ① ②）。
 *
 * ① 配置表单 + 只读徽标 configured；② 发送测试邮件。
 * 表单区拆到 ./email-channel/*（component-size 门禁 >400 行）。
 *
 * 照 ManageTelegramPage 范式：GET 载入回显（密码不回显），PUT 提交（password 留空=不改）。
 * 后端未装配（500/FMBY_SECRET_BOX_KEY 不可用）页面 fail-closed 显示「邮件通道服务未启用」。
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  emailChannelApi,
  mapEmailChannelToDraft,
  type EmailChannelDraft,
} from '@fmby/v2-shared/contracts/settings';
import { isServiceUnwiredError } from '@fmby/v2-shared/contracts/manage/peripherals';
import { FeedbackState, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { queryKeys } from '@fmby/v2-shared/query';
import styles from './longtail-shared/ManageShared.module.css';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';
import { EmailChannelConfigSection } from './email-channel/EmailChannelConfigSection';
import { EmailChannelTestSection, type EmailTestBanner } from './email-channel/EmailChannelTestSection';

const emailChannelKey = queryKeys.settings.emailChannel();

export function ManageEmailChannelPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<EmailChannelDraft | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [testTo, setTestTo] = useState('');
  const [testBanner, setTestBanner] = useState<EmailTestBanner | null>(null);

  const settingsQuery = useQuery({
    queryKey: emailChannelKey,
    queryFn: async () => {
      try {
        return await emailChannelApi.getEmailChannel();
      } catch (err) {
        if (isServiceUnwiredError(err)) {
          return null;
        }
        throw err;
      }
    },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setDraft(mapEmailChannelToDraft(settingsQuery.data));
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!draft) {
        throw new Error('配置草稿尚未就绪');
      }
      return emailChannelApi.putEmailChannel(draft);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(emailChannelKey, saved);
      setDraft(mapEmailChannelToDraft(saved));
      setBanner('邮件通道配置已保存。密码未填写时保持不变。');
    },
  });

  const testMutation = useMutation({
    mutationFn: () => emailChannelApi.testEmail(testTo),
    onSuccess: (res) => {
      // ② 成功：收件地址来自后端回显（不自行编造「已发送」）
      setTestBanner({ kind: 'success', text: `已发送至 ${res.to}` });
    },
    onError: (err) => {
      // ② fail-closed：原样显示后端文案
      setTestBanner({ kind: 'error', text: getErrorMessage(err) });
    },
  });

  if (settingsQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在读取邮件通道"
        description="正在拉取 SMTP 配置与发送条件状态。"
      />
    );
  }

  const settingsUnavailable = settingsQuery.data === null;
  const configured = settingsQuery.data?.configured ?? false;

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="邮件通道（Email）"
        description="配置 SMTP 发信与密码重置投递方式。密码走密钥链，本页不展示明文。"
        meta={
          <StatusBadge
            label={configured ? '已具备发送条件' : '尚未具备发送条件'}
            variant={configured ? 'success' : 'danger'}
          />
        }
      />

      {settingsQuery.isError ? (() => {
        const unwired = isServiceUnwiredError(settingsQuery.error);
        return (
          <ManageSectionCard title={unwired ? '邮件通道服务未启用' : '邮件通道读取失败'}>
            <InlineBanner
              variant={unwired ? 'warning' : 'error'}
              title={unwired ? '邮件通道服务未启用' : '读取失败'}
              description={
                unwired
                  ? '邮件通道服务未装配（FMBY_SECRET_BOX_KEY 不可用），配置端口暂不可用。请先部署密钥链后再配置。'
                  : getErrorMessage(settingsQuery.error)
              }
            />
          </ManageSectionCard>
        );
      })() : settingsUnavailable || !draft ? (
        <ManageSectionCard
          title="配置端口未装配"
          description="GET/PUT /api/settings/server/email 由本卡冻结，后端写端口另行开卡。"
        >
          <InlineBanner
            variant="info"
            title="等待后端装配"
            description="配置端点尚未提供。页面不以空表单冒充已保存配置。"
          />
        </ManageSectionCard>
      ) : (
        <EmailChannelConfigSection
          draft={draft}
          setDraft={setDraft}
          banner={banner}
          setBanner={setBanner}
          saveError={saveMutation.error}
          savePending={saveMutation.isPending}
          onSave={() => saveMutation.mutate()}
        />
      )}

      {!settingsUnavailable && !settingsQuery.isError ? (
        <EmailChannelTestSection
          to={testTo}
          onToChange={setTestTo}
          pending={testMutation.isPending}
          onSend={() => testMutation.mutate()}
          banner={testBanner}
        />
      ) : null}
    </div>
  );
}

export default ManageEmailChannelPage;

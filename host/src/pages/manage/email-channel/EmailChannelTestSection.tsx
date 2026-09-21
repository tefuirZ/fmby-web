/**
 * 邮件通道 · 发送测试邮件卡片（EMAIL-CHANNEL / WEB-EMAIL-UI ②）。
 *
 * 成功显示「已发送至 {to}」；失败原样显示后端 fail-closed 文案，
 * **前端绝不伪造「已发送」**（成功文案只来自 mutation 成功分支）。
 */

import { InlineBanner } from '@fmby/v2-shared/ui';
import { ManageSectionCard } from '../longtail-shared/components';
import styles from '../longtail-shared/ManageShared.module.css';

export interface EmailTestBanner {
  kind: 'success' | 'error';
  text: string;
}

interface EmailChannelTestSectionProps {
  to: string;
  onToChange: (value: string) => void;
  pending: boolean;
  onSend: () => void;
  banner: EmailTestBanner | null;
}

export function EmailChannelTestSection({
  to,
  onToChange,
  pending,
  onSend,
  banner,
}: EmailChannelTestSectionProps) {
  return (
    <ManageSectionCard
      title="发送测试邮件"
      description="用当前配置真发一封（含品牌名 + logo）。配置缺失或未装配时失败会原样提示，不会显示「已发送」。"
    >
      {banner ? (
        <InlineBanner
          variant={banner.kind === 'success' ? 'success' : 'error'}
          title={banner.kind === 'success' ? '测试邮件已发送' : '测试邮件发送失败'}
          description={banner.text}
        />
      ) : null}
      <div className={styles.fieldRow}>
        <label className={styles.label}>
          收件人（可选，缺省自寄发件地址）
          <input
            className={styles.input}
            value={to}
            placeholder="留空 = 发送至 from_address"
            onChange={(event) => onToChange(event.target.value)}
          />
        </label>
      </div>
      <div className={styles.buttonRow}>
        <button className={styles.secondaryButton} type="button" disabled={pending} onClick={onSend}>
          {pending ? '发送中…' : '发送测试邮件'}
        </button>
      </div>
    </ManageSectionCard>
  );
}

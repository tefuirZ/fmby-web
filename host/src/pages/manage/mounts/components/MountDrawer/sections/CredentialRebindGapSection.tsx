/**
 * W5-E 卡 2（NIGHT-FE-CRED-REBIND-HONEST）：139 / AList 挂载的**诚实重绑缺口提示**。
 *
 * 后端硬缺口（W5-C 已登记，不自造）：
 * ① `bridges/manage/helpers.rs:155` 的 expires_at 匹配仅微软分支 ⇒ 139/AList 挂载
 *    `credential_status` 恒 bound（expired 不可达）；
 * ② 挂载 `config_json` 无 profile/account 关联键 ⇒ 前端不知重绑哪个档案；
 * ③ 无凭据重绑录入 UI。
 *
 * 因此**不做死入口**：当该 provider 的凭据状态为 expired/unbound 时，只给诚实提示
 * 「需后端先决能力（关联键 + 到期读取），当前不可用」，并提供只读回退（打开连接配置查看）。
 * 微软分支保持既有专用重绑入口（MicrosoftRebindSection）不变。
 *
 * ★不回显任何密钥/密封引用（只呈现状态与提示）。
 */

import { InlineBanner } from '@fmby/v2-shared/ui';
import { ManageSectionCard } from '../../../../components';
import styles from '../../../../longtail-shared/ManageShared.module.css';
import { resolveCredentialBadge } from '../../../credentialPresentation';
import type { ManageMountCredentialStatus } from '@fmby/v2-shared/contracts/manage';

interface CredentialRebindGapSectionProps {
  providerType: string;
  credentialStatus: string | null;
  /** 触发只读回退：打开连接配置查看（调用方决定如何打开抽屉配置面板）。 */
  onOpenConnectionConfig?: () => void;
}

export function CredentialRebindGapSection({
  providerType,
  credentialStatus,
  onOpenConnectionConfig,
}: CredentialRebindGapSectionProps) {
  const badge = resolveCredentialBadge(credentialStatus as ManageMountCredentialStatus | null, null);

  const providerLabel = providerType.toLowerCase().includes('yun139') || providerType.toLowerCase().includes('139')
    ? '139 云盘'
    : 'AList / OpenList';

  return (
    <ManageSectionCard
      title="凭据重绑（暂不可用）"
      description={`${providerLabel} 的凭据重绑需要后端先决能力，当前前端无法执行。`}
    >
      <InlineBanner
        variant="warning"
        title="该 provider 的重绑需后端先决能力"
        description={
          '当前 provider 的挂载未携带可定位的凭据档案关联键，且后端尚未对其实行过期读取，' +
          '前端无法安全重绑。请等待后端补齐「挂载↔凭据档案关联键 + 到期读取」能力后再使用重绑入口。'
        }
        actions={
          onOpenConnectionConfig ? (
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={onOpenConnectionConfig}
              aria-label="打开连接配置查看"
            >
              打开连接配置查看
            </button>
          ) : null
        }
      />
      {badge.visible ? (
        <div className={styles.fieldHint}>
          当前凭据状态：{badge.label}
          {badge.hint ? `（${badge.hint}）` : ''}
        </div>
      ) : null}
    </ManageSectionCard>
  );
}

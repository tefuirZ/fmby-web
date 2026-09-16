/** 挂载表单的两个 JSX 渲染助手（裁决 A：从 formUtils 拆出，使其余纯函数模块无 JSX）。 */

import type { CredentialProbeStatus } from '@fmby/v2-shared/hooks/useCredentialProbe';
import styles from '../ManagePages.module.css';

export function renderFieldError(message?: string) {
  if (!message) {
    return null;
  }
  return <span className={styles.fieldErrorText}>{message}</span>;
}

export function renderCredentialProbeStatus(status: CredentialProbeStatus, message?: string) {
  if (status === 'idle') return null;

  const statusConfig: Record<Exclude<CredentialProbeStatus, 'idle'>, { icon: string; text: string; color: string }> = {
    // --feedback-* 这两个变量从未在 tokens 里定义过，fallback 的饱和绿/红必定生效，
    // 在纯黑画布上过亮；统一改用语义 token。图标也从 emoji 换成排印符号，
    // emoji 有自己的固定配色，暗房里会成为画面上唯一的彩色噪点。
    probing: { icon: '·', text: '检测中…', color: 'var(--text-secondary)' },
    success: { icon: '✓', text: '连接成功', color: 'var(--success)' },
    error: { icon: '✕', text: message ?? '连接失败', color: 'var(--danger)' },
  };

  const config = statusConfig[status];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-caption)', color: config.color, padding: '4px 0' }}>
      <span>{config.icon}</span>
      <span>{config.text}</span>
    </div>
  );
}

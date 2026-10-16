/**
 * 安装完成段（SIMPLIFY-INSTALL-WIZARD：用户裁定「无需确认」+「简单点」）。
 *
 * 需求：apply 成功（管理员已建、自动登录）后进入本段，展示管理员账号/密码一次，
 *   密码默认隐藏 + 显示切换；**无「输入 complete-install 确认」门**（用户裁定删）。
 *
 * ★诚实边界：这里展示的口令是**用户刚在本页输入的那个明文**（state），不是后端回传 ——
 *   `InstallApplyResponse` 只平铺 id / username，不含 password。刷新后 state 丢失
 *   ⇒ 如实提示「请立即保存」；后端永远不回落明文 ⇒ 本段是唯一一次能看到它的地方。
 */

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { PasswordToggle } from '../login/forms/fields';
import styles from '../login/LoginPage.module.css';

export interface InstallCompletionPanelProps {
  /** 用户输入的管理员账号（apply 成功回执里的 username 优先）。 */
  username: string;
  /** 用户输入的明文口令；空串表示本页已刷新、明文不可再取。 */
  password: string;
  /** complete 请求 pending（用于按钮态与文案）。 */
  completing: boolean;
  onComplete: () => void;
}

export function InstallCompletionPanel({
  username,
  password,
  completing,
  onComplete,
}: InstallCompletionPanelProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(username + '\n' + password);
      setCopied(true);
    } catch {
      // 剪贴板被拒（无安全上下文 / 用户拒绝）⇒ 不谎报成功，留在「可手动选中」状态。
      setCopied(false);
    }
  };

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>完成</legend>
      <p className={styles.noticeBanner}>管理员账号已建好。请立即保存下面这组凭据。</p>

      <label className={styles.fieldGroup}>
        管理员账号
        <input className={styles.input} readOnly value={username} />
      </label>

      <div className={styles.fieldGroup}>
        <span className={styles.label}>管理员密码</span>
        <div className={styles.inputWrapper}>
          <input
            className={`${styles.input} ${styles.inputHasToggle}`}
            readOnly
            type={visible ? 'text' : 'password'}
            value={password || '（本页已刷新，明文口令不可再取；如未保存请重置密码）'}
          />
          <PasswordToggle visible={visible} onToggle={() => setVisible((v) => !v)} />
        </div>
      </div>

      {password ? (
        <button type="button" className={styles.secondaryButton} onClick={() => void copy()}>
          {copied ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Copy size={14} aria-hidden="true" />
          )}
          {copied ? '已复制到剪贴板' : '复制账号与密码'}
        </button>
      ) : null}

      <button
        className={styles.submitButton}
        type="button"
        disabled={completing}
        onClick={onComplete}
      >
        {completing ? '提交中…' : '完成安装'}
      </button>
    </fieldset>
  );
}

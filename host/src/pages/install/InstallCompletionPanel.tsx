/**
 * 安装完成页（fmby-v2 #640 用户裁定 ④ + complete 防误触）。
 *
 * 需求原文：完成页展示管理员账号和密码，密码**默认隐藏**，提供显示/隐藏切换。
 *
 * ★诚实边界：这里展示的口令是**用户刚在本页输入的那个明文**（组件 state），
 *   不是后端回传 —— `InstallApplyResponse` 只平铺 `id` / `username`，
 *   **不含 password**（见 `shared/src/contracts/auth/api.ts` 与
 *   `install_flow.rs:596` 的管理员回执）。所以：
 *   · 刷新页面后本面板不再有口令（state 丢失）⇒ 如实提示「请立即保存」；
 *   · 后端**永远不回落**明文口令 ⇒ 本面板是唯一一次能看到它的地方。
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
  /** 后端防误触的精确确认串（`complete-install`）。 */
  confirmAction: string;
  confirmValue: string;
  onConfirmChange: (value: string) => void;
  /** complete 请求 pending（用于按钮态与文案）。 */
  completing: boolean;
  onComplete: () => void;
}

export function InstallCompletionPanel({
  username,
  password,
  confirmAction,
  confirmValue,
  onConfirmChange,
  completing,
  onComplete,
}: InstallCompletionPanelProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${username}\n${password}`);
      setCopied(true);
    } catch {
      // 剪贴板被拒（无安全上下文 / 用户拒绝）⇒ 不谎报成功，留在「可手动选中」状态。
      setCopied(false);
    }
  };

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>④ 完成安装</legend>
      <p className={styles.noticeBanner}>
        最后一步会落盘安装锁（<code>fmby-install.lock</code>），此后主应用接管。
        需要手动输入 <code>{confirmAction}</code> 以防误触。
      </p>

      <p className={styles.successBanner}>
        管理员账号已创建。请**立即保存**下面这组凭据 —— 服务端只存哈希，
        明文口令离开本页即不可再取。
      </p>

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

      <label className={styles.fieldGroup}>
        输入 {confirmAction} 以确认
        <input
          className={styles.input}
          value={confirmValue}
          onChange={(e) => onConfirmChange(e.target.value)}
          placeholder={confirmAction}
          autoComplete="off"
        />
      </label>
      <button
        className={styles.submitButton}
        type="button"
        disabled={completing || confirmValue !== confirmAction}
        onClick={onComplete}
      >
        {completing ? '提交中…' : '标记安装完成'}
      </button>
    </fieldset>
  );
}

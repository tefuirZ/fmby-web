/**
 * 安装向导的**管理员区**（fmby-v2 #640 用户裁定 ②③④ 的 UI 侧）。
 *
 * 单列成组件的两个原因：
 *   1. `InstallPage.tsx` 已 386 行，再加四组表单 + 规则清单会撞
 *      `check-frontend-component-size.mjs` 的 400 行棘轮（基线外新增即 FAIL）；
 *   2. 口令规则与生成器是**可实测的纯函数**（见 `passwordPolicy.ts`），
 *      本组件只负责呈现与收集，不掺判定逻辑。
 *
 * 裁定落地位置：
 *   ② 强度：逐条列出未通过项 + 提交前 fail-closed（`adminProblem` 非空即拦）；
 *   ③ 生成：按钮填入 16 位四类齐备口令，同时把确认框填上（避免用户再抄一遍）；
 *   ④ 显隐：`PasswordToggle` 默认隐藏，两个口令框各自独立切换；
 *   完成页展示账号密码由 `InstallCompletionPanel` 负责（父组件按 apply 成功挂载）。
 */

import { useId, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import {
  assessPassword,
  confirmPasswordProblem,
  generateStrongPassword,
  PASSWORD_MIN_LENGTH,
} from './passwordPolicy';
import { PasswordToggle } from '../login/forms/fields';
import styles from '../login/LoginPage.module.css';

export interface AdminFieldsetProps {
  username: string;
  password: string;
  confirm: string;
  displayName: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
}

export function AdminFieldset({
  username,
  password,
  confirm,
  displayName,
  onUsernameChange,
  onPasswordChange,
  onConfirmChange,
  onDisplayNameChange,
}: AdminFieldsetProps) {
  const passwordId = useId();
  const confirmId = useId();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  // 口令为空时不展示红字（还没开始输就报一屏错 = 噪声）；一旦有值就逐条提示。
  const assessment = password.length > 0 ? assessPassword(password) : null;
  const confirmProblem = confirm.length > 0 ? confirmPasswordProblem(password, confirm) : null;

  const generate = () => {
    const generated = generateStrongPassword();
    onPasswordChange(generated);
    // 生成的口令本身必过强度；确认框同步填上，用户可自行改成手打口令。
    onConfirmChange(generated);
    setConfirmVisible(true); // 生成后直接可见，避免用户被空确认框挡住
  };

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>③ 管理员账号</legend>
      <label className={styles.fieldGroup}>
        用户名
        <input
          className={styles.input}
          required
          autoComplete="username"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
        />
        <span className={styles.fieldHint}>支持中文等 Unicode 字符，请勿使用空格。</span>
      </label>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor={passwordId}>
          密码
        </label>
        <div className={styles.inputWrapper}>
          <input
            id={passwordId}
            className={`${styles.input} ${styles.inputHasToggle}`}
            required
            type={passwordVisible ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
          />
          <PasswordToggle visible={passwordVisible} onToggle={() => setPasswordVisible((v) => !v)} />
        </div>
        <button type="button" className={styles.secondaryButton} onClick={generate}>
          <RefreshCw size={14} aria-hidden="true" /> 生成 16 位强密码
        </button>
        <span className={styles.fieldHint}>
          至少 {PASSWORD_MIN_LENGTH} 位，且同时含大写字母、小写字母、数字、特殊字符。
        </span>
        {assessment && !assessment.ok ? (
          <ul className={styles.noticeList} role="alert">
            {assessment.failures.map((failure) => (
              <li key={failure} className={styles.fieldError}>
                {failure}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor={confirmId}>
          再输一次密码
        </label>
        <div className={styles.inputWrapper}>
          <input
            id={confirmId}
            className={`${styles.input} ${styles.inputHasToggle}`}
            required
            type={confirmVisible ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => onConfirmChange(e.target.value)}
          />
          <PasswordToggle
            visible={confirmVisible}
            onToggle={() => setConfirmVisible((v) => !v)}
          />
        </div>
        {confirmProblem ? (
          <span className={styles.fieldError} role="alert">
            {confirmProblem}
          </span>
        ) : null}
      </div>

      <label className={styles.fieldGroup}>
        显示名（可选）
        <input
          className={styles.input}
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
        />
      </label>

      {passwordVisible ? <span className={styles.fieldHint}>密码当前可见，注意旁观。</span> : null}
    </fieldset>
  );
}

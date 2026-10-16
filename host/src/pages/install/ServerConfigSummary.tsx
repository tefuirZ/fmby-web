/**
 * 安装向导 ② 页「服务器配置」的**生效值摘要**（fmby-v2 #640 卡面）。
 *
 * `ponytail:` 为什么是只读摘要而不是表单 —— V2 后端 `POST /api/install/apply`
 * 的请求体只有 `database / cache / admin` 三组（`shared/src/contracts/auth/api.ts`
 * 的 `InstallApplyRequest`），**没有任何服务器字段**（无 ② 页对应的写入通道）。
 * 放几个输入框进去只能骗用户，且会把值丢掉。故本页职责收敛为：
 *   1. 把 ①③ 的选择摊开给人核对（安装是一次收全，错了要重来）；
 *   2. 交代动态配置语义：后端热加载，个别需重建连接的部位由过渡页掩盖。
 * 升级路径：后端补出 server 段（如 `InstallApplyRequest.server`）后，本页换成表单。
 */

import type { WizardValues } from './installWizard';
import styles from '../login/LoginPage.module.css';
import { describeCache, describeDatabase } from './serverConfigLabels';


export interface ServerConfigSummaryProps {
  values: WizardValues;
}

export function ServerConfigSummary({ values }: ServerConfigSummaryProps) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>配置核对</legend>
      <dl className={styles.fieldGroup}>
        <div className={styles.fieldGroup}>
          <dt className={styles.label}>数据库</dt>
          <dd className={styles.input}>{describeDatabase(values)}</dd>
        </div>
        <div className={styles.fieldGroup}>
          <dt className={styles.label}>缓存 / 队列</dt>
          <dd className={styles.input}>{describeCache(values)}</dd>
        </div>
        <div className={styles.fieldGroup}>
          <dt className={styles.label}>管理员</dt>
          <dd className={styles.input}>{values.adminUsername.trim() || '（第 ③ 步填写）'}</dd>
        </div>
      </dl>
      <p className={styles.noticeBanner}>以上是将要使用的配置。请核对无误后再填写管理员账号。</p>
      <p className={styles.fieldHint}>
        如需改监听地址等高级项，请在安装完成后到管理面配置。
      </p>
    </fieldset>
  );
}

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

export interface ServerConfigSummaryProps {
  values: WizardValues;
}

/** 数据库一行的可读描述（口令一律打码，摘要不是回显密码的地方）。 */
function describeDatabase(values: WizardValues): string {
  if (values.dbKind === 'sqlite') {
    return values.sqlitePath.trim().length > 0
      ? `SQLite · ${values.sqlitePath.trim()}`
      : 'SQLite · 内置默认路径';
  }
  const { host, port, database } = values.pg;
  const suffix = port.trim().length > 0 ? `:${port.trim()}` : ':5432';
  return `PostgreSQL · ${host.trim() || '（未填主机）'}${suffix}/${database.trim() || '（未填库名）'}`;
}

function describeCache(values: WizardValues): string {
  if (values.cacheKind === 'redis') {
    return values.redisUrl.trim().length > 0
      ? `Redis · ${values.redisUrl.trim()}`
      : 'Redis · （未填连接串）';
  }
  // 卡面语义：未填 Redis ⇒ 后端自动回落内存 + 文件。
  return '内置（内存 + 文件）';
}

export function ServerConfigSummary({ values }: ServerConfigSummaryProps) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>服务器配置（生效值核对）</legend>
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
      <p className={styles.noticeBanner}>
        以上为将要写入的生效值。应用安装是<strong>一次收全</strong>（探测 → 只写非默认项 →
        建库 → 建管理员），配置由后端<strong>热加载</strong> —— 指这三步之间不需重启；
        <strong>complete 落锁后仍须重启</strong>，由主应用接管（安装模式进程不挂主应用路由）。
      </p>
      <p className={styles.fieldHint}>
        V2 安装接口不接收额外的服务器参数；如需改监听地址等，请在安装完成后到管理面配置。
      </p>
    </fieldset>
  );
}

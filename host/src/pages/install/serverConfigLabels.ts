/**
 * ② 页「生效值摘要」的两行描述文本（fmby-v2 #640）。
 *
 * 为什么要和 `ServerConfigSummary.tsx` 分开：本仓无 jsdom ⇒ `.tsx` 在 node 下
 * 加载不了（ERR_UNKNOWN_FILE_EXTENSION），纯函数放进 `.ts` 才能被 `node --test`
 * 真跑（同 `passwordPolicy.ts` 的做法）。摘要页要摊开连接串，而连接串里可能带
 * `:口令@` ⇒ 这条逻辑必须有可重跑的断言守着，不能只靠人眼。
 */

import type { WizardValues } from './installWizard';

/** 数据库一行的可读描述（口令一律不进摘要）。 */
export function describeDatabase(values: WizardValues): string {
  if (values.dbKind === 'sqlite') {
    return values.sqlitePath.trim().length > 0
      ? `SQLite · ${values.sqlitePath.trim()}`
      : 'SQLite · 内置默认路径';
  }
  const { host, port, database } = values.pg;
  const suffix = port.trim().length > 0 ? `:${port.trim()}` : ':5432';
  return `PostgreSQL · ${host.trim() || '（未填主机）'}${suffix}/${database.trim() || '（未填库名）'}`;
}

/**
 * 缓存一行的可读描述。**连接串里的 userinfo（`:口令@`）一律不输出**
 * —— 摘要页是「摊开给人核对填错没有」，不是回显凭据的地方；
 * 与 `describeDatabase` 同口径（它也只取 host/port/db，不碰口令）。
 *
 * ★解析失败时**绝不原样回显**：那串正在被用户编辑，里面可能正写着明文口令。
 */
export function describeCache(values: WizardValues): string {
  if (values.cacheKind === 'redis') {
    const raw = values.redisUrl.trim();
    if (raw.length === 0) return 'Redis · （未填连接串）';
    try {
      const parsed = new URL(raw);
      const hasCreds = parsed.username.length > 0 || parsed.password.length > 0;
      const safe = `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;
      return hasCreds ? `Redis · ${safe}（账号与口令不予回显）` : `Redis · ${safe}`;
    } catch {
      return 'Redis · （连接串已填写，为避免回显口令此处不展开）';
    }
  }
  // 卡面语义：未填 Redis ⇒ 后端自动回落内存 + 文件。
  return '内置（内存 + 文件）';
}

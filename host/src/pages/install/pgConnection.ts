/**
 * 安装向导 · PostgreSQL 连接（fmby-v2 #640 卡面「PG 表单 + 连接测试，五类失败各给明确原因」）。
 *
 * 独立成纯函数：宿主仓无 jsdom / testing-library（同 `passwordPolicy.ts` 的理由），
 * 纯函数才能被 `node --test` 真跑，组件侧只负责呈现。
 *
 * `ponytail:` 分类器靠 message 关键词匹配 —— 因为后端 `DatabaseProbeResponse`
 * 只有 `message: string`（`shared/src/contracts/auth/api.ts:94`），**没有结构化 code**。
 * 天花板：后端换措辞就可能落到 unknown；升级路径 = `install_flow.rs` 补 `code` 字段后
 * 直接读 code，删掉本文件里的关键词表（认不出时前端一律原样展示 message，不编造原因）。
 */

/** 卡面要求的 PG 五项输入（主机/端口/账号/密码 + 库名）。 */
export interface PgFields {
  host: string;
  /** 字符串而非 number：直接接 `<input type="text">` 的 value，留空走默认 5432。 */
  port: string;
  database: string;
  username: string;
  password: string;
}

/** 留空时的默认端口（与 sqlx / libpq 一致）。 */
export const PG_DEFAULT_PORT = 5432;

/**
 * PG 表单必填校验。返回 null = 可提交；否则返回**第一条**未满足项的中文原因
 * （逐条刷屏是噪声，用户改一条再看下一条即可）。
 */
export function pgFieldsProblem(fields: PgFields): string | null {
  if (fields.host.trim().length === 0) return '请填写数据库主机';
  const port = fields.port.trim();
  if (port.length > 0) {
    if (!/^\d+$/.test(port)) return '端口必须是数字';
    const n = Number(port);
    if (n < 1 || n > 65535) return '端口须在 1-65535 之间';
  }
  if (fields.database.trim().length === 0) return '请填写数据库名';
  if (fields.username.trim().length === 0) return '请填写数据库账号';
  if (fields.password.length === 0) return '请填写数据库密码';
  return null;
}

/**
 * 拼成 `postgres://` URL —— `InstallDatabaseChoice` 的 postgres 分支只收 `url`
 * （`api.ts:130`），所以结构化输入必须在交给 apply/probe 前编码成合法 URL。
 *
 * ★`@ : / # ?` 在 userinfo 段全是保留字符，账号密码里出现即须百分号编码，
 *   否则 host 会被截到错误位置（实测：`p@ss` 裸奔 ⇒ host 变成 `ss@db.internal`）。
 */
export function buildPgUrl(fields: PgFields): string {
  const port = fields.port.trim() || String(PG_DEFAULT_PORT);
  const userinfo = `${encodeURIComponent(fields.username.trim())}:${encodeURIComponent(fields.password)}`;
  return `postgres://${userinfo}@${fields.host.trim()}:${port}/${encodeURIComponent(fields.database.trim())}`;
}

/** 卡面点名的五类失败 + unknown（unknown 不编造原因，原样展示后端 message）。 */
export type ProbeFailureKind =
  | 'dns'
  | 'tcp'
  | 'auth'
  | 'database-missing'
  | 'schema-unwritable'
  | 'unknown';

/**
 * 关键词 → 分类。顺序有意义：DNS 串里常同时出现 host/connect，必须先判 DNS；
 * schema 权限串不含 authentication，故 auth 与它不冲突。
 */
const FAILURE_PATTERNS: readonly [ProbeFailureKind, readonly string[]][] = [
  ['dns', ['translate host name', 'name or service not known', 'failed to lookup address', 'nodename nor servname', 'dns error']],
  ['database-missing', ['does not exist']],
  ['schema-unwritable', ['permission denied', 'read-only file system', 'must be owner']],
  ['auth', ['authentication failed', 'password', 'no password supplied', 'invalid authorization']],
  ['tcp', ['connection refused', 'timeout', 'timed out', 'could not connect', 'connection closed', 'network is unreachable', 'no route to host']],
];

/** 把后端自由文本 `message` 归到五类之一；认不出 ⇒ `unknown`（绝不瞎猜）。 */
export function classifyProbeFailure(message: string | undefined): ProbeFailureKind {
  const text = (message ?? '').toLowerCase();
  if (text.length === 0) return 'unknown';
  for (const [kind, needles] of FAILURE_PATTERNS) {
    if (needles.some((needle) => text.includes(needle))) return kind;
  }
  return 'unknown';
}

/**
 * 每类的可展示原因（卡面：各给明确原因）。措辞刻意带「下一步查什么」，
 * 只说「失败了」等于没说。
 */
export const PROBE_FAILURE_LABEL: Record<ProbeFailureKind, string> = {
  dns: '主机名解析失败：数据库主机写错了，或本机 DNS / hosts 解析不到它。',
  tcp: '网络层连不上：端口没开、防火墙拦了，或数据库没监听这个地址。',
  auth: '认证失败：账号或密码不对（注意大小写与特殊字符是否被改动）。',
  'database-missing': '库不存在：请先建库，或把「数据库名」改成已存在的那个。',
  'schema-unwritable': '无写权限：该账号对 schema（默认 public）没有建表权限，安装要写盘。',
  unknown: '后端未给出可识别的原因，原始报错如下。',
};

/**
 * 组装给用户看的失败说明：**分类原因 + 后端原文**。
 *
 * ★原文必须一起显示 —— 分类是启发式，只给分类会把「真实原因被归错」藏起来。
 */
export function describeProbeFailure(message: string | undefined): string {
  const kind = classifyProbeFailure(message);
  const raw = (message ?? '').trim();
  return raw.length > 0 ? `${PROBE_FAILURE_LABEL[kind]}（后端原文：${raw}）` : PROBE_FAILURE_LABEL[kind];
}

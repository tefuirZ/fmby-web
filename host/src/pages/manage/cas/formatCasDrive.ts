/**
 * fmby-web#8：CAS 扇出状态的**纯展示逻辑**（抽出成独立模块以便行为断言）。
 *
 * 抽出的理由：这些函数决定「徽章会不会对用户撒谎」，必须能被**直接调用**验证。
 * 留在组件里就只能靠读源码字符串断言，那种断言对「把未知默认成已复制」这类
 * 变异是恒绿的（源码里仍有「未知」二字），验证等于没有。
 *
 * ★三条不伪造事实：
 * 1. `copyState` 是后端开放字符串 ⇒ 未知值显式「状态未知」，**绝不**默认「已复制」；
 * 2. `sizeBytes === null` ⇒ 「大小未知」，**不**显示 0 字节；
 * 3. `lastVerifiedAt === null` ⇒ 「未核验」，**不**显示 1970 年。
 */

export type CasCopyStateTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

/**
 * 已知的 `copy_state` → 中文 + 色调。
 *
 * ★取值集合**与后端枚举逐一对齐**，不得凭空发明：
 *   后端 `crates/fmby-v2-domain/src/cas.rs:64`
 *     `enum CopyState { Pending, Present, Failed, Tombstoned }`
 *   wire 由 `crates/fmby-v2-bridges/src/bridges/cas_admin.rs:95`
 *     `d.copy_state.as_str()` 产生 ⇒ wire 取值**封闭**为四个：
 *     `pending` / `present` / `failed` / `tombstoned`
 *   语义取自同文件 :40-41 的口径注释：
 *     pending    = 尚未得出落位结论
 *     present    = 盘上确认存在（reconciled）
 *     failed     = 实体丢失（三类差异之一）
 *     tombstoned = 上游已删 / 墓碑化（非 reconciled）
 *
 * ★未命中时仍显示「状态未知」+ neutral（fail-closed）—— 后端若新增第五个取值，
 *   在前端补映射前不应拄成任何已有语义（但那条 `④b` 测试会第一时间变红提醒）。
 */
const COPY_STATE_LABELS: Record<string, { label: string; tone: CasCopyStateTone }> = {
  pending: { label: '待落位', tone: 'warning' },
  present: { label: '已复制', tone: 'success' },
  failed: { label: '实体丢失', tone: 'danger' },
  tombstoned: { label: '上游已删', tone: 'danger' },
};

const UNKNOWN_STATE: { label: string; tone: CasCopyStateTone } = {
  label: '状态未知',
  tone: 'neutral',
};

/**
 * 已知的 `copy_state` 键集合（与后端枚举精确相等，不多不少）。
 * 导出供测试做**集合级**断言 —— 否则「凭空发明幽灵状态」这种变异会存活
 * （只断言真实值都认识的话，多出来的键不会让任何用例变红）。
 */
export const KNOWN_COPY_STATES = Object.keys(COPY_STATE_LABELS);

/** 徽章文案。★未知 ⇒ 「状态未知」（不得谎称已复制）。 */
export function resolveCopyStateLabel(copyState: string): string {
  return (COPY_STATE_LABELS[copyState] ?? UNKNOWN_STATE).label;
}

/** 徽章色调。未知 ⇒ neutral（视觉上不与「成功」混淆）。 */
export function resolveCopyStateTone(copyState: string): CasCopyStateTone {
  return (COPY_STATE_LABELS[copyState] ?? UNKNOWN_STATE).tone;
}

/** 字节数格式化；`null`/非法/负值 ⇒ 「大小未知」（不伪造 0）。 */
export function formatSize(sizeBytes: number | null): string {
  if (sizeBytes === null || !Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return '大小未知';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = sizeBytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** 毫秒时间戳格式化；`null`/非法/非正 ⇒ 「未核验」（不伪造 1970 年）。 */
export function formatVerifiedAt(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) {
    return '未核验';
  }
  return new Date(ms).toLocaleString();
}
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

/**
 * 未知 / 契约未列出的 `copy_state` 的**统一**呈现（fail-closed）。
 *
 * ★为什么必须**带上原文码**（而不是一句「状态未知」）：
 *   后端若新增第五个取值（或拼错、大小写漂移），只显示「状态未知」运维**无法上报
 *   是哪个码**，排查链断在最前面。带上原文码 ⇒ 一眼可报、可粘给后端。
 * ★绝不静默归入 `present`：那是最危险的谎言（把「不知道」说成「已复制」，
 *   运维据此以为副本齐了，实际可能实体已丢失）。
 *
 * @param copyState 后端原样透出的 `copy_state`（可能为空/未列出）。
 */
export function formatUnknownCopyState(copyState: string): string {
  // ★rv02 #25 M-1 收口：签名是 `string`（调用方 mapCasDriveStatus 已 `?? ''` 兑底），
  //   此处不再防御性 `?? ''` —— 与类型签名保持一致，不写死代码。
  const raw = copyState.trim();
  // 空码：明确说「未提供」，不显示一对空括号（那看着像渲染 bug）。
  return raw.length === 0 ? '未知状态（后端未提供状态码）' : `未知状态（${raw}）`;
}

/**
 * 该 `copy_state` 是否属于契约已知的四态。
 * 供调用方在需要时做「已知/未知」分支（展示层一律走 label/tone，不自行判断）。
 */
export function isKnownCopyState(copyState: string): boolean {
  return Object.prototype.hasOwnProperty.call(COPY_STATE_LABELS, copyState);
}

/** 徽章文案。★未知 ⇒ 「未知状态（原文码）」（不得谎称已复制，且保留可上报的码）。 */
export function resolveCopyStateLabel(copyState: string): string {
  return COPY_STATE_LABELS[copyState]?.label ?? formatUnknownCopyState(copyState);
}

/** 徽章色调。未知 ⇒ neutral（视觉上不与「成功」混淆）。 */
export function resolveCopyStateTone(copyState: string): CasCopyStateTone {
  return COPY_STATE_LABELS[copyState]?.tone ?? UNKNOWN_STATE.tone;
}

// ---------------------------------------------------------------------------
// #671：失败原因（`reason_code` / `reason_detail`）
//
// wire 约定（rb01 → fe01）：`Option<String>` + skip_serializing_if ⇒ **无原因时 key 缺失**，
//   故契约层已是 `null`。**不得**用 `?? ''` 渲染空串（会把「健康」画成「有原因但空白」）。
// 命名族：`SCREAMING_SNAKE`，与全仓 `error_code` slug 一致。
// ---------------------------------------------------------------------------

/** 已知的 `reason_code` → 中文（与后端 #671 的取值集合逐一对齐，不凭空发明）。 */
const REASON_CODE_LABELS: Record<string, string> = {
  CAS_COPY_FAILED: '盘上实体丢失',
  CAS_COPY_TOMBSTONED: '上游文件已删 / 墓碑化',
};

/** 已知的 `reason_code` 集合（供测试做集合级断言，防凭空发明/漏登记）。 */
export const KNOWN_REASON_CODES = Object.keys(REASON_CODE_LABELS);

/**
 * 是否存在失败原因（严格区分「key 不存在」与「key 存在但为空」）。
 *
 * ★rb01 硬要求：这两个形态**不得混同**。
 *   - `present=false`（key 不存在）：`pending`/`present` 的正常形态 ⇒ **无原因**；
 *   - `present=true` 但码为空/空白：后端给了 key 却没给值 ⇒ 仍算「有原因位」，
 *     但**不是**具体原因，展示层按 fail-closed 给「原因未提供」。
 */
export function hasFailureReason(
  reasonCode: string | null,
  present = true,
): boolean {
  if (!present) return false; // key 不存在 ⇒ 无原因（健康）
  return typeof reasonCode === 'string' && reasonCode.trim().length > 0;
}

/**
 * 原因码 → 展示文案（三态分明）。
 *
 * - key **不存在** ⇒ `''`（调用方据此**整行不渲染**，避免把健康画成「有原因但空白」）；
 * - key 存在但**为空** ⇒ 「原因未提供（后端给出空值）」—— 不明说健康，也不编造原因；
 * - 有码且**已知** ⇒ 中文；有码但**未知** ⇒ **显示原文码**（fail-closed，便于上报）。
 */
export function resolveReasonLabel(
  reasonCode: string | null,
  present = true,
): string {
  if (!present) return '';
  if (typeof reasonCode !== 'string' || reasonCode.trim().length === 0) {
    return '原因未提供（后端给出空值）';
  }
  const code = reasonCode.trim();
  return REASON_CODE_LABELS[code] ?? `未知原因（${code}）`;
}

/** 明细文案；无明细 ⇒ 空串（由调用方决定不渲染，避免渲染出孤立空行）。 */
export function resolveReasonDetail(reasonDetail: string | null): string {
  if (typeof reasonDetail !== 'string') return '';
  const text = reasonDetail.trim();
  return text.length > 0 ? text : '';
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

/**
 * #658 ④ 徽章：建 `driveRef → priority` 映射（盘优先级真源）。
 *
 * ★数据来源：`CasDriveConfig.priority` 来自后端 `GET /admin/cas/drives` **配置端点**
 *   （`CasDriveConfigDto`）。内容列表项 `CasContentDriveCopy` **本身不带 priority**
 *   ⇒ 前端按 `drive_ref` 关联配置与副本，**不在内容端点臆造优先级**。
 * ★fail-closed：未在配置里登记的盘 ⇒ `map.get(driveRef)` 返回 `undefined`，
 *   前端显示「—」，**不默认 0 / 不编造优先级**。
 */
export function buildDrivePriorityMap(
  configs: { driveRef: string; priority: number }[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of configs) {
    map.set(c.driveRef, c.priority);
  }
  return map;
}
/**
 * #658 ④「秒传来源」徽章（后端 `CasContentListItemDto.source_kind`，domain 单一真源
 * `SourceKind::as_str` 的稳定线格式：`publish`/`share`/`offline`/`scan`/`rapid_upload`）。
 *
 * 纪律同族：**未知码原样透出**（不猜、不折叠）、**缺失显示 `—`**（不编造）。
 * `rapid_upload` = 秒传命中（后端 #861 起单独暴露该来源）。
 */
export function resolveSourceKindLabel(kind: string | null | undefined): string {
  switch (kind) {
    case 'rapid_upload':
      return '秒传命中';
    case 'publish':
      return '发布入库';
    case 'share':
      return '分享转存';
    case 'offline':
      return '离线下载';
    case 'scan':
      return '扫描入库';
    case null:
    case undefined:
    case '':
      return '—';
    default:
      return kind;
  }
}

/** 秒传来源徽章色调：仅 `rapid_upload`（秒传命中）用成功色，其余中性。 */
export function resolveSourceKindTone(kind: string | null | undefined): 'success' | 'neutral' {
  return kind === 'rapid_upload' ? 'success' : 'neutral';
}

/**
 * #862 · #658 ⑤「删除安全可见」：把「当前在挡的那一闸」稳定码翻成人话。
 *
 * 取值与后端逐一对齐（`CasContentListItemDto.deferred_gate` 注释 + `CasDeferredGateDto`）：
 *   `none`（无租约/可回收）· `session_open`（闸① 会话未关闭）· `lease_active`（闸② TTL 未到）
 *   · `grace`（闸③ 宽限期未满）· `reaped`（已回收，终态）。
 * 纪律同族：**未知码原样透出**、**缺失/空串显 `—`**（不编造状态）。
 */
export function resolveDeferredGateLabel(gate: string | null | undefined): string {
  switch (gate) {
    case 'none':
      return '可回收（无闸在挡）';
    case 'session_open':
      return '闸① 播放会话未关闭';
    case 'lease_active':
      return '闸② 租约 TTL 未到';
    case 'grace':
      return '闸③ 宽限期未满';
    case 'reaped':
      return '已回收（终态）';
    case null:
    case undefined:
    case '':
      return '—';
    default:
      return gate;
  }
}

/** 宽限期剩余 → 人话（仅当在挡的闸是 `grace` 时展示；其余场景后端恒 0，不显示）。 */
export function formatGraceRemaining(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms <= 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0 ? `${h}h${m}m` : m > 0 ? `${m}m${s}s` : `${s}s`;
}

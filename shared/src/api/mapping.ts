export type UnknownRecord = Record<string, unknown>;

// F5：候选键兜底的类型漂移可见性。
//
// readString/readNumber/readBoolean 支持多候选（`readString(r.a, r.b)`），
// 命中非首候选 = 首候选为空——可能是合理兼容（snake↔camel 对齐），也可能是
// 后端已改名而前端无人知晓（漂移被静默吞掉）。
//
// 取舍（方案 B）：**保留兜底**（不破兼容、不误伤 snake/camel 合理面），但
// **dev 构建下去重告警**——同一调用点只警一次，文案含命中序号与调用点，
// 可直接行动（收敛 mapping 或对齐后端契约）。prod 静默（用户无感）。
// 远期（另卡）：后端契约生成落地后，再评估方案 A（去兜底强同步）。
const driftWarned = new Set<string>();

function warnMappingDrift(hitIndex: number, total: number): void {
  if (hitIndex === 0) return; // 首候选命中 = 无漂移
  if (!import.meta.env?.DEV) return; // prod 静默
  const site = (new Error().stack ?? '').split('\n')[2]?.trim() ?? 'unknown';
  const key = `${hitIndex}/${total}@${site}`;
  if (driftWarned.has(key)) return; // 同一调用点只警一次
  driftWarned.add(key);
  console.warn(
    `[fmby-mapping] 字段漂移：第 ${hitIndex + 1}/${total} 候选命中（前面的候选全空）。`
    + '后端契约可能已改名/变形态——请收敛本调用点或对齐后端字段。'
    + `调用点：${site}`,
  );
}

export function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : {};
}

export function readString(...values: unknown[]): string | undefined {
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed !== '') {
        warnMappingDrift(i, values.length);
        return trimmed;
      }
    }
  }
  return undefined;
}

export function readNumber(...values: unknown[]): number | undefined {
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (typeof value === 'number' && Number.isFinite(value)) {
      warnMappingDrift(i, values.length);
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        warnMappingDrift(i, values.length);
        return parsed;
      }
    }
  }
  return undefined;
}

export function readBoolean(...values: unknown[]): boolean | undefined {
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (typeof value === 'boolean') {
      warnMappingDrift(i, values.length);
      return value;
    }
  }
  return undefined;
}

export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item !== '');
}

export function readArray<T>(value: unknown, mapItem: (item: unknown) => T | null | undefined): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => mapItem(item))
    .filter((item): item is T => item !== null && item !== undefined);
}

export function ticksToSeconds(value: unknown): number | undefined {
  const ticks = readNumber(value);
  if (ticks === undefined) {
    return undefined;
  }
  return Math.max(0, Math.floor(ticks / 10_000_000));
}

export function clampProgress(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

/** 将 ISO 时间字符串格式化为中文长日期+时间。 */
export function formatDateTime(value?: string): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/** 将 ISO 时间字符串格式化为相对时间描述。 */
export function formatRelativeTime(value?: string): string {
  if (!value) {
    return '刚刚更新';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const delta = date.getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' });
  const units = [
    { unit: 'day' as const, value: 24 * 60 * 60 * 1000 },
    { unit: 'hour' as const, value: 60 * 60 * 1000 },
    { unit: 'minute' as const, value: 60 * 1000 },
  ];

  for (const entry of units) {
    if (Math.abs(delta) >= entry.value || entry.unit === 'minute') {
      return formatter.format(Math.round(delta / entry.value), entry.unit);
    }
  }

  return '刚刚';
}

/**
 * 将 ISO 时间字符串格式化为 `<input type="datetime-local">` 所需的
 * `YYYY-MM-DDTHH:mm` 形式（按 Asia/Shanghai 时区呈现给用户）。
 * 用于表单默认值，业务代码请勿自建 Intl.DateTimeFormat。
 */
export function formatDateTimeLocalInput(value?: string): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** 将秒数格式化为可读时长（例如 "1 小时 20 分钟"）。 */
export function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) {
    // 缺时长通常是还没做技术探测，对用户而言就是「未知」；
    // 不要用带内部口吻的占位说法，那读起来像页面没做完。
    return '时长未知';
  }

  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} 分钟`;
  }

  return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
}

/** 将秒数格式化为紧凑时长（例如 "1小时20分"）。无效值返回 undefined。 */
export function formatCompactDuration(seconds?: number): string | undefined {
  if (!seconds || seconds <= 0) {
    return undefined;
  }

  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${totalMinutes}分钟`;
  }

  return minutes > 0 ? `${hours}小时${minutes}分` : `${hours}小时`;
}

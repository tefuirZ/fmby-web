import type { ManageMountProviderType, ManageProbeTaskRecord, ManageProbeTaskStatus, ManageProbeTaskStreamRecord, ManageProbeTechnicalSummary } from '@fmby/v2-shared/contracts/manage';
import { ACTIVE_PROBE_STATUSES } from './types';

export const DETAIL_TECHNICAL_FIELDS: Array<{
  key: keyof ManageProbeTechnicalSummary;
  label: string;
  formatter?: (value: number | string) => string;
}> = [
  { key: 'container', label: '封装格式' },
  { key: 'durationTicks', label: '时长', formatter: (value) => formatDurationTicks(Number(value)) },
  { key: 'bitrate', label: '总码率', formatter: (value) => formatBitrate(Number(value)) },
  { key: 'width', label: '分辨率', formatter: (_value) => '' },
  { key: 'videoCodec', label: '视频编码' },
  { key: 'audioCodec', label: '音频编码' },
  { key: 'dynamicRangeLabel', label: '动态范围' },
  { key: 'audioTrackCount', label: '音轨数', formatter: (value) => String(value) },
  { key: 'subtitleCount', label: '字幕数', formatter: (value) => String(value) },
  { key: 'releaseGroup', label: '发布组' },
];

export function hasActiveProbeTasks(tasks: ManageProbeTaskRecord[]) {
  return tasks.some((task) => isActiveProbeStatus(task.status));
}

export function isActiveProbeStatus(status?: ManageProbeTaskStatus) {
  return status ? ACTIVE_PROBE_STATUSES.includes(status) : false;
}

export function buildTitleLine(task?: Pick<ManageProbeTaskRecord, 'title' | 'year'>) {
  if (!task) return '未知影片';
  return task.year ? `${task.title} (${task.year})` : task.title;
}

export function formatProbeTaskStatusLabel(status?: ManageProbeTaskStatus) {
  switch (status) {
    case 'queued': return '排队中';
    case 'running': return '运行中';
    case 'retry-waiting': return '等待重试';
    case 'succeeded': return '已完成';
    case 'failed': return '失败';
    default: return '未入队';
  }
}

export function formatProbeReason(reason?: string) {
  switch ((reason ?? '').trim().toLowerCase()) {
    case 'scan': return '自动补全';
    case 'detail': return '详情页触发';
    case 'playback': return '播放前触发';
    case 'manual': return '管理员手动触发';
    default: return '未记录';
  }
}

export function formatSourceStatusLabel(status?: string) {
  switch ((status ?? '').trim().toLowerCase()) {
    case 'playable': return '可播放';
    case 'pendingvalidation': return '待验证';
    case 'unreachable': return '不可达';
    case 'unsupported': return '不支持';
    case 'authexpired': return '凭据过期';
    default: return status || '未知';
  }
}

export function formatMountStatusLabel(status?: string) {
  switch ((status ?? '').trim().toLowerCase()) {
    case 'active': return '正常';
    case 'unreachable': return '不可达';
    case 'disabled': return '已停用';
    default: return status || '未知';
  }
}

export function formatAvailabilityStateLabel(state?: string) {
  switch ((state ?? '').trim().toLowerCase()) {
    case 'active': return '正常';
    case 'unavailable': return '已隐藏';
    default: return state || '未知';
  }
}

export function buildCompactTechnicalSummary(summary?: ManageProbeTechnicalSummary) {
  if (!summary) return undefined;
  const tokens = [
    summary.container?.toUpperCase(),
    formatResolution(summary),
    summary.videoCodec?.toUpperCase(),
    summary.audioCodec?.toUpperCase(),
    summary.dynamicRangeLabel,
  ].filter(Boolean);
  return tokens.length > 0 ? tokens.join(' · ') : '暂无摘要';
}

export function buildTechnicalCards(summary: ManageProbeTechnicalSummary) {
  const resolution = formatResolution(summary);
  return DETAIL_TECHNICAL_FIELDS.map((field) => {
    if (field.key === 'width') return { label: field.label, value: resolution || '—' };
    const rawValue = summary[field.key];
    if (rawValue === undefined || rawValue === null || rawValue === '') return { label: field.label, value: '—' };
    const value =
      typeof rawValue === 'number' && field.formatter
        ? field.formatter(rawValue)
        : typeof rawValue === 'string' && field.formatter
          ? field.formatter(rawValue)
          : String(rawValue);
    return { label: field.label, value };
  });
}

export function buildStreamHeadline(stream: ManageProbeTaskStreamRecord) {
  const tokens = [
    stream.codecName?.toUpperCase(),
    typeof stream.channels === 'number' ? `${stream.channels} 声道` : undefined,
    stream.language?.toUpperCase(),
    stream.dynamicRangeLabel,
  ].filter(Boolean);
  return tokens.length > 0 ? tokens.join(' · ') : '暂无摘要';
}

export function buildStreamFacts(stream: ManageProbeTaskStreamRecord) {
  const facts = [
    makeFact('标题', stream.title),
    makeFact('语言', stream.language?.toUpperCase()),
    makeFact('编码', stream.codecName?.toUpperCase()),
    makeFact('编码标签', stream.codecTag),
    makeFact('配置', stream.profile),
    makeFact('分辨率', formatStreamResolution(stream)),
    makeFact('声道数', formatChannels(stream)),
    makeFact('声道布局', stream.channelLayout),
    makeFact('码率', stream.bitRate ? formatBitrate(stream.bitRate) : undefined),
    makeFact('位深', stream.bitDepth ? `${stream.bitDepth} bit` : undefined),
    makeFact('像素格式', stream.pixelFormat),
    makeFact('色彩原色', stream.colorPrimaries),
    makeFact('色彩空间', stream.colorSpace),
    makeFact('色彩传递', stream.colorTransfer),
    makeFact('画面比例', stream.aspectRatio),
    makeFact('平均帧率', stream.averageFrameRate ? formatFrameRate(stream.averageFrameRate) : undefined),
    makeFact('实际帧率', stream.realFrameRate ? formatFrameRate(stream.realFrameRate) : undefined),
    makeFact('动态范围', stream.dynamicRangeLabel),
    makeFact('杜比视界', formatDolbyVision(stream)),
    makeFact('HDR10+', formatOptionalBoolean(stream.hdr10PlusPresentFlag)),
    makeFact('默认轨', formatBooleanLabel(stream.isDefault)),
    makeFact('强制轨', formatBooleanLabel(stream.isForced)),
  ].filter((fact): fact is { label: string; value: string } => fact !== null);
  return facts.length > 0 ? facts : [{ label: '状态', value: '没有更多字段' }];
}

export function getProbeTaskRecentAt(task: ManageProbeTaskRecord) {
  return task.startedAt ?? task.finishedAt ?? task.probedAt ?? task.requestedAt ?? task.nextRetryAt;
}

export function canTriggerProbe(task: ManageProbeTaskRecord) {
  if (task.availabilityState === 'unavailable') {
    return false;
  }
  if (task.mountStatus === 'Unreachable' || task.mountStatus === 'Disabled') {
    return false;
  }
  return task.sourceStatus === 'Playable' || task.sourceStatus === 'PendingValidation';
}

export function buildTriggerHint(task: ManageProbeTaskRecord) {
  if (task.availabilityState === 'unavailable') {
    return '当前来源所属数据源已被隐藏，请先恢复数据源后再触发技术探测。';
  }
  if (task.mountStatus === 'Unreachable') {
    return '当前挂载已判定为不可达，请先恢复挂载连接后再触发技术探测。';
  }
  if (task.mountStatus === 'Disabled') {
    return '当前挂载已停用，启用后才能继续技术探测。';
  }
  if (canTriggerProbe(task)) return '提交后会进入统一探测队列。';
  return `当前来源状态为 ${formatSourceStatusLabel(task.sourceStatus)}，暂时不能触发探测。`;
}

export function formatProbeProviderLabel(providerType?: ManageMountProviderType) {
  switch (providerType) {
    case 'local': return '本地目录';
    case 'alist': return 'AList';
    case 'openlist': return 'OpenList';
    case 'webdav': return 'WebDAV';
    case 's3-compatible': return 'S3 兼容存储';
    default: return providerType ?? '未记录';
  }
}

export function buildScopeLabel(tasks: ManageProbeTaskRecord[], scopedLibraryId?: string, scopedMountId?: string) {
  if (tasks.length === 0) {
    if (scopedLibraryId && scopedMountId) return '当前页面已经按媒体库和数据源过滤，但这组范围里暂时没有探测记录。';
    if (scopedLibraryId) return '当前页面已经按媒体库过滤，但这个媒体库暂时没有探测记录。';
    if (scopedMountId) return '当前页面已经按数据源过滤，但这个数据源暂时没有探测记录。';
    return '当前页面已经带过滤条件。';
  }
  const first = tasks[0];
  const labels = [
    scopedLibraryId ? `媒体库：${first.libraryName}` : null,
    scopedMountId ? `数据源：${first.mountName}` : null,
  ].filter(Boolean);
  return labels.join(' · ');
}

function makeFact(label: string, value?: string) {
  if (!value || value.trim() === '') return null;
  return { label, value };
}

function formatResolution(summary?: Pick<ManageProbeTechnicalSummary, 'width' | 'height'>) {
  if (!summary?.width || !summary?.height) return undefined;
  return `${summary.width} x ${summary.height}`;
}

function formatStreamResolution(stream: ManageProbeTaskStreamRecord) {
  if (!stream.width || !stream.height) return undefined;
  return `${stream.width} x ${stream.height}`;
}

function formatChannels(stream: ManageProbeTaskStreamRecord) {
  if (!stream.channels) return undefined;
  return stream.channelLayout ? `${stream.channels} 声道 (${stream.channelLayout})` : `${stream.channels} 声道`;
}

function formatDolbyVision(stream: ManageProbeTaskStreamRecord) {
  if (stream.dvProfile === undefined && stream.dvLevel === undefined) return undefined;
  const parts = [
    stream.dvProfile !== undefined ? `配置 ${stream.dvProfile}` : undefined,
    stream.dvLevel !== undefined ? `等级 ${stream.dvLevel}` : undefined,
  ].filter(Boolean);
  return parts.join(' · ');
}

export function formatDurationTicks(value?: number) {
  if (!value || value <= 0) return '—';
  const totalSeconds = Math.floor(value / 10_000_000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0 && minutes > 0) return `${hours} 小时 ${minutes} 分 ${seconds} 秒`;
  if (hours > 0) return `${hours} 小时 ${seconds} 秒`;
  if (minutes > 0) return `${minutes} 分 ${seconds} 秒`;
  return `${seconds} 秒`;
}

export function formatBitrate(value?: number) {
  if (!value || value <= 0) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} 兆比特/秒`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} 千比特/秒`;
  return `${value} 比特/秒`;
}

function formatFrameRate(value: number) {
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 2 : 3)} 帧/秒`;
}

function formatBooleanLabel(value?: boolean) {
  if (value === undefined) return undefined;
  return value ? '是' : '否';
}

function formatOptionalBoolean(value?: boolean) {
  return formatBooleanLabel(value);
}

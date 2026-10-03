/**
 * 运行日志归档页辅助（FE-LOG-ARCHIVE）。
 *
 * 真源：crates/fmby-v2-http/src/routes/manage/runtime_log_archives.rs
 *      crates/fmby-v2-contracts/src/dto/manage.rs（RuntimeLogArchiveDto）
 */

/**
 * 归档 zip 下载 URL。
 *
 * `archiveId` = `sha256(file_name)`（后端按 id 形状校验，路径穿越在 id 层即被拒）；
 * 前端仍按**单个路径段**转义后再拼，避免 `/`、`..` 等改变路径结构。
 *
 * 下载走原生 `<a href>`：鉴权是 Cookie（客户端 `credentials: 'same-origin'`），
 * GET 无需 CSRF 回显 ⇒ 不必自造 blob 管道。
 */
export function buildRuntimeLogArchiveDownloadUrl(archiveId: string): string {
  return `/api/manage/runtime-log-archives/${encodeURIComponent(archiveId)}/download`;
}

/** `compressed / original` → 百分比文案（后端口径）；非法值 ⇒ `—`（不造假值）。 */
export function formatCompressionRatio(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio < 0) {
    return '—';
  }

  return `${Math.round(ratio * 100)}%`;
}

/** 字节 → 可读体积（1024 进制；单位 B/KB/MB/GB/TB，非字节保留一位小数）。 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '—';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return unit === 0 ? `${bytes} ${units[0]}` : `${value.toFixed(1)} ${units[unit]}`;
}

/**
 * 字幕 serve URL 解析（FE-USABILITY-FIX-1）。
 *
 * V2 后端（`bridges/playback/session_service.rs` SUBTITLE-ASSETS-ROUTE）在会话
 * `subtitle_tracks[].id` 里**直接给完整 serve 路径**：
 *   `/api/assets/media-items/{item_id}/subtitles/{override_id}`
 * 前端约定：`id` 以 `/` 开头 ⇒ 原样使用。
 *
 * 历史坑：旧实现对所有非 `/` 开头的 id 一律拼 V1 路径 `/api/assets/subtitles/{id}`，
 * 而 V2 路由表**没有**该路径 ⇒ 请求先命中 blob 路由得 **400**（产物↔后端寻址不一致）。
 * 这里改成 V2 成形；既不是路径也不是数字 id 的形态**不发出请求**（宁可没有字幕 URL，
 * 也不发一个必然 4xx 的地址）。
 */
export function resolveSubtitleUrl(
  trackId: string | undefined,
  itemId: string | undefined,
): string | undefined {
  if (!trackId) {
    return undefined;
  }
  if (trackId.startsWith('/')) {
    return trackId;
  }
  if (!/^\d+$/.test(trackId)) {
    return undefined;
  }
  return `/api/assets/media-items/${itemId ?? ''}/subtitles/${trackId}`;
}

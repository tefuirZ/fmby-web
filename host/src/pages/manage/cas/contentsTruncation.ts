/**
 * fmby-web#658 / FE-CAS-G3：CAS 内容列表「首屏截断」的纯展示判定。
 *
 * 病因：`GET /api/admin/cas/contents` 返回**裸数组**（无 `total`、无 `has_more`），
 * 默认 `page_size=20` 且 `page≠1` 直接 400（键集仓储禁 OFFSET）⇒ 页面此前一行提示都没有，
 * 用户把 20 条当全量。
 *
 * ★诚实边界（这才是本模块存在的意义）：既然后端不返回总数，UI 就**不能**写
 *   「还有 N 条」或「已显示全部」——只能陈述「已到首屏上限、且无法翻页」这一事实。
 *   措辞里出现「共/全部/剩余」即为撒谎，测试按此钉死。
 */

export interface CasContentsTruncation {
  /** 渲染文案；`null` = 不渲染（无截断证据 / 假空态）。 */
  notice: string | null;
}

export function resolveContentsTruncation(args: {
  count: number;
  limit: number;
  unwired: boolean;
  loading: boolean;
  isError: boolean;
}): CasContentsTruncation {
  const { count, limit, unwired, loading, isError } = args;
  // 未装配 / 载入中 / 出错：都不是「数到了上限」的证据，此时提示截断会叠加误导。
  if (unwired || loading || isError) return { notice: null };
  if (limit <= 0 || count < limit) return { notice: null };
  return {
    notice: `已达首屏上限 ${limit} 条 —— 该端点不返回总数、也不支持翻页（后端仅放行首屏），以上不代表全量。`,
  };
}

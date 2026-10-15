/**
 * 安装面向导的**状态读取失败**判定（fmby-v2 #640 卡面「已安装后安装页不可达，
 * 后端拒访时给对提示」）。
 *
 * 独立成纯函数的理由与 `passwordPolicy.ts` 同：本仓无 jsdom，纯函数才跑得起来实测
 * （见 `tests/install-status.test.ts`）。组件侧只负责把这行字放进横幅。
 */

import type { InstallStatusResponse } from '@fmby/v2-shared/contracts/auth';

/** 安装「进行中」状态集合（需重定向 /install）。completed / unknown 不算。 */
const INSTALL_IN_PROGRESS_STATES = new Set([
  'needs_database',
  'configured',
  'needs_admin',
]);

/**
 * 是否处于安装进行中（INSTALL-FIRST-ROUND-UX A/B）。
 *
 * 安装模式进程形态下 `/api/install/status` 带 `state` 字段
 * （needs_database / configured / needs_admin / completed）。
 * 只有「进行中」三态为 true ⇒ 路由守卫重定向 /install、SessionProvider 静默清会话。
 * completed（已安装）/ 无 state（主应用形态或 status 404 已安装）/ 未知 ⇒ false（进主应用）。
 */
export function isInstallModeInProgress(
  status: InstallStatusResponse | undefined,
): boolean {
  const state = status?.state;
  return typeof state === 'string' && INSTALL_IN_PROGRESS_STATES.has(state);
}

/** 只取需要的两个字段，避免把 `ApiError` 的具体形状写死。 */
interface StatusErrorShape {
  /** 归一为小写；取不到 ⇒ 空串。 */
  code: string;
  status: number | undefined;
}

function readShape(error: unknown): StatusErrorShape | null {
  if (typeof error !== 'object' || error === null) return null;
  const raw = error as { code?: unknown; status?: unknown };
  return {
    code: typeof raw.code === 'string' ? raw.code.toLowerCase() : '',
    status: typeof raw.status === 'number' ? raw.status : undefined,
  };
}

/**
 * 安装状态读不到时，给用户的一句**可行动**说明。
 *
 * 返回 null 表示「这不是安装面的问题」⇒ 交给通用错误横幅，别抢话。
 *
 * ★404 的诚实边界：`/api/install/*` 只挂在安装模式进程，已安装实例不挂 ⇒ 404。
 *   但 404 也可能来自反向代理把路径吃掉，所以文案说「很可能已安装」，
 *   并给两条动作（去登录 / 确认起的是安装模式进程），不断言。
 */
export function installStatusProblem(error: unknown): string | null {
  const shape = readShape(error);
  if (!shape) return null;
  const { code, status } = shape;

  if (status === 401 || status === 403 || code === 'unauthorized' || code === 'forbidden') {
    return '安装面拒绝访问（未授权）。若实例已安装，安装端点已下线，请直接登录；若仍在安装模式，请确认会话未被中途清掉。';
  }
  if (status === 404 || code === 'http_404' || code === 'not_found') {
    return '读不到安装状态：本实例很可能已完成安装（已安装的实例不挂安装面，/api/install/* 一律 404）。请从首页登录；若确实要重装，请用安装模式启动进程后再打开本页。';
  }
  return null;
}

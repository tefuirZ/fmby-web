/**
 * 极简日志器
 *
 * 皮肤包是发行给终端用户的产物，控制台不应该有本皮肤自己打的噪音：
 * 用户看不懂，也会淹没宿主与播放器内核的真实报错。
 * 因此这里在生产构建下静默，只有开发态（import.meta.env.DEV）才透传到 console。
 *
 * 用法：logger.error('恢复会话失败', error)，参数签名与 console 一致。
 */
const isDev = import.meta.env.DEV;

type LogArgs = unknown[];

export const logger = {
  debug(...args: LogArgs): void {
    if (isDev) console.debug(...args);
  },
  info(...args: LogArgs): void {
    if (isDev) console.info(...args);
  },
  warn(...args: LogArgs): void {
    if (isDev) console.warn(...args);
  },
  error(...args: LogArgs): void {
    if (isDev) console.error(...args);
  },
};

export default logger;

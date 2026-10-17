/**
 * W15-TASK-CENTER-STREAM：任务中心流式**状态条**（卡面⑥⑦⑧的 UI 落点）。
 *
 * 用户红线「可以慢，不能空」的可视部分：
 * - ⑥ 顶部「已加载 N 条 · 仍在加载…」→ 完成变「共 N 条」；
 * - ⑦ 卡死超阈值 ⇒ 降级文案 + 重试按钮 + 「任务仍在后台执行」提示
 *   （**不是 spinner 到永远**）；
 * - ⑧ 空态「当前没有运行中的任务」+ 引导动作（去配置任务/刷新）。
 *
 * 组件只吃 hook 的状态（纯展示 + 两个回调），不自己连 WS ⇒ 可单测、可复用。
 */

import type { UseTaskCenterStreamResult } from '../hooks/useTaskCenterStream';

export interface TaskCenterStreamBannerProps {
  stream: UseTaskCenterStreamResult;
}

export function TaskCenterStreamBanner({ stream }: TaskCenterStreamBannerProps) {
  const { phase, loaded, total, reason, stalled, showSkeleton, retry, animate, setAnimate } = stream;

  // ⑦ 卡死降级：明确的文案 + 重试 + 「任务仍在后台执行」。
  if (stalled && phase === 'loading') {
    return (
      <div className="taskCenterStreamBanner taskCenterStreamBanner--stalled" role="status">
        <div>
          <strong>任务列表加载缓慢</strong>
          <p>
            已等待超过 3 秒仍未收到数据。任务仍在后台执行，此处不会无限转圈。
            你可以重试，或稍后回来查看。
          </p>
        </div>
        <div className="taskCenterStreamBanner__actions">
          <button type="button" onClick={retry}>
            重试
          </button>
          <label>
            <input
              type="checkbox"
              checked={animate}
              onChange={(e) => setAnimate(e.target.checked)}
            />
            进入动效
          </label>
        </div>
      </div>
    );
  }

  // ⑧ 空态：明确「没有运行中的任务」+ 引导动作（不许空壳）。
  if (phase === 'empty') {
    return (
      <div className="taskCenterStreamBanner taskCenterStreamBanner--empty" role="status">
        <strong>当前没有运行中的任务</strong>
        <p>没有符合当前筛选条件的任务。你可以调整筛选范围，或稍后刷新查看新任务。</p>
        <div className="taskCenterStreamBanner__actions">
          <button type="button" onClick={retry}>
            刷新
          </button>
        </div>
      </div>
    );
  }

  // ⑦ 失败态：带原因 + 重试。
  if (phase === 'failed') {
    return (
      <div className="taskCenterStreamBanner taskCenterStreamBanner--failed" role="alert">
        <strong>加载失败</strong>
        <p>{reason ?? '未知原因'}</p>
        <div className="taskCenterStreamBanner__actions">
          <button type="button" onClick={retry}>
            重试
          </button>
        </div>
      </div>
    );
  }

  // ⑥ 加载中/完成：条数文案。
  const headline =
    phase === 'done'
      ? `共 ${total ?? loaded} 条`
      : loaded > 0
        ? `已加载 ${loaded} 条 · 仍在加载…`
        : '正在加载任务…';

  return (
    <div className="taskCenterStreamBanner" role="status" aria-live="polite">
      <span>{headline}</span>
      {showSkeleton ? <span className="taskCenterStreamBanner__hint">正在取首批任务…</span> : null}
    </div>
  );
}

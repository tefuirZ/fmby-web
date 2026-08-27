import type { EpisodeNavigationAction, EpisodeNavigationControls } from './types';

interface PlayerControlOption {
  name: string;
  position: 'left';
  index: number;
  html: string;
  click: () => void;
  mounted: (element: HTMLElement) => void;
}

export interface EpisodeNavigationControlSet {
  controls: PlayerControlOption[];
  update: (navigation?: EpisodeNavigationControls) => void;
}

type NavigationDirection = 'previous' | 'next';

export function createEpisodeNavigationControlSet(): EpisodeNavigationControlSet {
  let navigation: EpisodeNavigationControls | undefined;
  const previous = createNavigationControl('previous', 5);
  const next = createNavigationControl('next', 15);

  const update = (value?: EpisodeNavigationControls) => {
    navigation = value;
    previous.update(value?.previous);
    next.update(value?.next);
  };

  return {
    controls: [
      previous.option(() => navigation?.previous),
      next.option(() => navigation?.next),
    ],
    update,
  };
}

function createNavigationControl(direction: NavigationDirection, index: number) {
  const defaultLabel = direction === 'previous' ? '上一集' : '下一集';
  let button: HTMLButtonElement | undefined;
  let wrapper: HTMLElement | undefined;

  const update = (action?: EpisodeNavigationAction) => {
    const visible = action !== undefined;
    const enabled = Boolean(action?.enabled);
    const label = action?.label || defaultLabel;

    if (button) {
      button.disabled = !enabled;
      button.title = label;
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-disabled', String(!enabled));
      button.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }
    if (wrapper) {
      wrapper.style.display = visible ? 'flex' : 'none';
      wrapper.style.opacity = enabled ? '1' : '0.38';
      wrapper.setAttribute('aria-hidden', String(!visible));
    }
  };

  return {
    update,
    option: (getAction: () => EpisodeNavigationAction | undefined): PlayerControlOption => ({
      name: `${direction}Episode`,
      position: 'left',
      index,
      html: createNavigationButtonMarkup(direction, defaultLabel),
      click: () => {
        const action = getAction();
        if (action?.enabled) {
          action.onActivate();
        }
      },
      mounted: (element) => {
        wrapper = element;
        button = element.querySelector('button') ?? undefined;
        update(getAction());
      },
    }),
  };
}

/**
 * ArtPlayer 通过 innerHTML 挂载 control 的 html 字符串，本函数处于渲染边界：
 * 拼进属性值的外部文本（剧集标题等元数据）必须先转义，
 * 否则形如 `"><img onerror=...>` 的标题可以闭合属性注入任意脚本。
 */
export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function createNavigationButtonMarkup(direction: NavigationDirection, label: string) {
  const linePath = direction === 'previous' ? 'M6 5v14' : 'M18 5v14';
  const trianglePath =
    direction === 'previous' ? 'M18 6 9 12l9 6V6Z' : 'm6 6 9 6-9 6V6Z';
  return `<button type="button" data-testid="player-${direction}-episode" aria-label="${escapeHtmlAttribute(label)}" aria-disabled="true" disabled style="align-items:center;background:transparent;border:0;color:inherit;display:flex;height:36px;justify-content:center;padding:0;width:36px;cursor:not-allowed"><svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="${linePath}" stroke="currentColor" stroke-linecap="round" stroke-width="2"></path><path d="${trianglePath}" fill="currentColor"></path></svg></button>`;
}

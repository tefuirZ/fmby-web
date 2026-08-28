import type { PlayerEngine } from './types';

export function createPlayerEngineHandle(getEngine: () => PlayerEngine | null): PlayerEngine {
  return {
    destroy: () => getEngine()?.destroy(),
    seek: (time) => getEngine()?.seek(time),
    play: () => getEngine()?.play(),
    pause: () => getEngine()?.pause(),
    setSpeed: (rate) => getEngine()?.setSpeed(rate),
    setVolume: (value) => getEngine()?.setVolume(value),
    setEpisodeNavigation: (navigation) => getEngine()?.setEpisodeNavigation?.(navigation),
  };
}

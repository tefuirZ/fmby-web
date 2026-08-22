import type { PlayerEngineId } from './types';

// 前缀必须与 manifest.localStorage_keys 声明一致，宿主按前缀回收本皮肤的本机偏好。
export const PLAYER_ENGINE_STORAGE_KEY = 'darkroom:playerEngine';

const DEFAULT_PLAYER_ENGINE: PlayerEngineId = 'dplayer';

export function isPlayerEngineId(value: unknown): value is PlayerEngineId {
  return value === 'dplayer' || value === 'artplayer';
}

export function resolvePlayerEngineId(): PlayerEngineId {
  if (typeof window === 'undefined') {
    return DEFAULT_PLAYER_ENGINE;
  }

  try {
    const stored = window.localStorage.getItem(PLAYER_ENGINE_STORAGE_KEY);
    return isPlayerEngineId(stored) ? stored : DEFAULT_PLAYER_ENGINE;
  } catch {
    return DEFAULT_PLAYER_ENGINE;
  }
}

export function setPlayerEngineId(engineId: PlayerEngineId): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(PLAYER_ENGINE_STORAGE_KEY, engineId);
  } catch {
    // 本机偏好写入失败不应阻断设置页或播放页。
  }
}

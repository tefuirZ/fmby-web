/**
 * W5-F 卡①：播放引擎默认值防回归。
 * 默认 = artplayer（用户裁定）；已存本机偏好不受影响；DPlayer 仍合法可切换。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYER_ENGINE_STORAGE_KEY,
  isPlayerEngineId,
  resolvePlayerEngineId,
  setPlayerEngineId,
} from '../src/features/player/playerConfig.ts';

function withWindow<T>(impl: () => T): T {
  const g = globalThis as { window?: unknown };
  const prev = g.window;
  let store: Record<string, string> = {};
  g.window = {
    localStorage: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    },
  };
  try {
    return impl();
  } finally {
    g.window = prev;
  }
}

test('未设置时默认引擎为 artplayer', () => {
  withWindow(() => {
    assert.equal(resolvePlayerEngineId(), 'artplayer');
  });
});

test('已存 dplayer 偏好时保持 dplayer（不覆盖用户选择）', () => {
  withWindow(() => {
    window.localStorage.setItem(PLAYER_ENGINE_STORAGE_KEY, 'dplayer');
    assert.equal(resolvePlayerEngineId(), 'dplayer');
  });
});

test('已存 artplayer 偏好时保持 artplayer', () => {
  withWindow(() => {
    window.localStorage.setItem(PLAYER_ENGINE_STORAGE_KEY, 'artplayer');
    assert.equal(resolvePlayerEngineId(), 'artplayer');
  });
});

test('非法/损坏的存储值回退到默认 artplayer', () => {
  withWindow(() => {
    window.localStorage.setItem(PLAYER_ENGINE_STORAGE_KEY, 'vlc');
    assert.equal(resolvePlayerEngineId(), 'artplayer');
  });
});

test('DPlayer 仍是合法引擎（可切换，未删）', () => {
  assert.equal(isPlayerEngineId('dplayer'), true);
  assert.equal(isPlayerEngineId('artplayer'), true);
  assert.equal(isPlayerEngineId('vlc'), false);
  withWindow(() => {
    setPlayerEngineId('dplayer');
    assert.equal(resolvePlayerEngineId(), 'dplayer');
    setPlayerEngineId('artplayer');
    assert.equal(resolvePlayerEngineId(), 'artplayer');
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerEngineHandle } from '../src/features/player/playerHandle.ts';
import type { PlayerEngine } from '../src/features/player/types';

test('播放器 ref 在引擎异步创建前调用安全，创建后转发到当前引擎', () => {
  let engine: PlayerEngine | null = null;
  const handle = createPlayerEngineHandle(() => engine);
  assert.doesNotThrow(() => {
    handle.seek(12);
    handle.play();
    handle.pause();
  });

  const calls: string[] = [];
  engine = {
    destroy: () => calls.push('destroy'),
    seek: (time) => calls.push(`seek:${time}`),
    play: () => calls.push('play'),
    pause: () => calls.push('pause'),
    setSpeed: (rate) => calls.push(`speed:${rate}`),
    setVolume: (value) => calls.push(`volume:${value}`),
  };
  handle.seek(24);
  handle.play();
  handle.setSpeed(1.25);
  assert.deepEqual(calls, ['seek:24', 'play', 'speed:1.25']);
});

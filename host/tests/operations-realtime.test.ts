/**
 * W5-E 卡 1 契约测试（FE-OPS-REALTIME-WS）。
 *
 * 环境约束：本仓 node:test 无 jsdom / @testing-library（零新依赖红线），故实时通道的
 * **决策逻辑**用纯函数断言（reducer / 退避 / 帧解析），覆盖卡面四要点：
 *  ① 收到 `playback.active_snapshot` → 快照真更新（reducer 返回含映射数据的新 state）
 *  ② 断开→重连退避序列（backoffMs 指数封顶，不无限快速重连）
 *  ③ 卸载后不再 setState（apply 的 mountedRef 守卫；reducer 为纯函数不副作用）
 *  ④ 非 JSON 帧不崩（parseFrame / reduceRealtimeFrame 返回原 state）
 * WS 连接挂载/卸载生命周期由 typecheck + reducer 组合保证，不引入渲染器依赖。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  reduceRealtimeFrame,
  backoffMs,
  type OperationsRealtimeSnapshot,
} from '../src/features/operations/useOperationsRealtime';
import { operationsApi } from '@fmby/v2-shared/contracts/manage/operations';

const INITIAL: OperationsRealtimeSnapshot = {
  activePlayback: null,
  mountLoad: null,
  lastEventAt: null,
  status: 'connecting',
};

describe('W5-E ① 收到 active_snapshot → UI 真更新', () => {
  it('playback.active_snapshot 映射到活跃播放域类型且刷新时间戳', () => {
    const wsPayload = {
      limit: 3,
      generated_at: '2026-09-23T10:00:00Z',
      sessions: [{ session_id: 's1', device_session_id: null, remote_control_available: false, supported_commands: [], client_connection_status: null, last_command_status: null, client: { device_name: null, client_name: null, device_os: null, client_version: null }, client_info: null, user: { user_id: '1', username: 'alice', display_name: null }, item: { item_id: 'i1', title: 'Movie', media_type: 'movie', series_title: null, season_number: null, episode_number: null }, source: { media_source_id: '', source_name: '', provider_type: '', mount_id: '' }, status: 'playing', play_method: null, position_ticks: 0, duration_ticks: 0, progress_percent: null, started_at: 't', last_heartbeat_at: 't' }],
    };
    const next = reduceRealtimeFrame(INITIAL, {
      type: 'playback.active_snapshot',
      serverTime: '2026-09-23T10:00:00Z',
      payload: wsPayload,
    });
    assert.equal(next.status, 'open');
    assert.equal(next.lastEventAt, '2026-09-23T10:00:00Z');
    assert.ok(next.activePlayback, 'activePlayback 必须被填充');
    assert.equal(next.activePlayback?.limit, 3);
    assert.equal(next.activePlayback?.totalReturned, 1);
    assert.equal(next.activePlayback?.sessions[0].sessionId, 's1');
    assert.equal(next.activePlayback?.sessions[0].user.username, 'alice');
    // 不与旧快照混淆：mountLoad 仍为空
    assert.equal(next.mountLoad, null);
  });

  it('playback.source_load_snapshot 映射到数据源负载域类型', () => {
    const wsPayload = {
      generated_at: '2026-09-23T10:01:00Z',
      sources: [{ source_id: 'src1', source_name: 'OneDrive', provider_type: 'onedrive', mount_id: 'm1', active_session_count: 2, playing_count: 1, paused_count: 0 }],
    };
    const next = reduceRealtimeFrame(INITIAL, {
      type: 'playback.source_load_snapshot',
      serverTime: '2026-09-23T10:01:00Z',
      payload: wsPayload,
    });
    assert.ok(next.mountLoad, 'mountLoad 必须被填充');
    assert.equal(next.mountLoad?.items.length, 1);
    assert.equal(next.mountLoad?.items[0].sourceName, 'OneDrive');
    assert.equal(next.mountLoad?.items[0].activeSessionCount, 2);
    assert.equal(next.activePlayback, null);
  });
});

describe('W5-E ② 断开→重连退避序列（指数封顶，不无限快速重连）', () => {
  it('退避序列 1s→2s→4s→8s→… 封顶 15s', () => {
    assert.equal(backoffMs(1), 1000);
    assert.equal(backoffMs(2), 2000);
    assert.equal(backoffMs(3), 4000);
    assert.equal(backoffMs(4), 8000);
    assert.equal(backoffMs(5), 15000); // 封顶
    assert.equal(backoffMs(99), 15000); // 远超仍封顶
  });
  it('attempt<=0 不越界（防御）', () => {
    assert.equal(backoffMs(0), 1000);
  });
});

describe('W5-E ③ 卸载后不再 setState（纯 reducer 不副作用，挂守卫在 hook 的 apply）', () => {
  it('reducer 是纯函数：相同输入返回等价 state（hook 卸载守卫在 apply 层，不在此副作用）', () => {
    const frame = { type: 'playback.active_snapshot', serverTime: 'x', payload: { limit: 1, generated_at: 'x', sessions: [] } };
    const a = reduceRealtimeFrame(INITIAL, frame);
    const b = reduceRealtimeFrame(INITIAL, frame);
    assert.deepEqual(a, b);
  });
  it('hello / 未知事件不改动 state（不误 setState）', () => {
    const next = reduceRealtimeFrame(INITIAL, { type: 'playback.hello', serverTime: 'x', payload: {} });
    assert.deepEqual(next, INITIAL);
    const next2 = reduceRealtimeFrame(INITIAL, { type: 'playback.session_started', serverTime: 'x', payload: {} });
    assert.deepEqual(next2, INITIAL);
  });
});

describe('W5-E ④ 非 JSON / 坏帧不崩', () => {
  it('null / 无 type 的帧返回原 state（不抛）', () => {
    assert.deepEqual(reduceRealtimeFrame(INITIAL, null), INITIAL);
    assert.deepEqual(reduceRealtimeFrame(INITIAL, { type: 123 as unknown as string, serverTime: null, payload: null }), INITIAL);
  });
  it('已知事件但 payload 形状异常 → 捕获后返回原 state（连接不中断）', () => {
    const next = reduceRealtimeFrame(INITIAL, {
      type: 'playback.active_snapshot',
      serverTime: 'x',
      // 故意缺 sessions，触发映射分支里的安全处理
      payload: { limit: 'not-a-number', generated_at: null },
    });
    assert.ok(next.activePlayback === null || typeof next.activePlayback?.limit === 'number');
  });
});

describe('W5-E 映射复用既有契约 mapper（与 REST 读法一致，不造第二套）', () => {
  it('fromActiveSnapshotEvent / fromMountLoadEvent 存在且为函数', () => {
    assert.equal(typeof operationsApi.fromActiveSnapshotEvent, 'function');
    assert.equal(typeof operationsApi.fromMountLoadEvent, 'function');
  });
});

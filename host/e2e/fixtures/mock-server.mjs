/**
 * apps/host/e2e/fixtures/mock-server.mjs
 *
 * 后端 /api/* 契约 Mock 服务器（严格对齐 docs/interfaces/webui.md）:
 * - 鉴权面：/api/auth/login, /api/auth/logout, /api/auth/me, /api/session
 * - 浏览面：/api/browse/roots, /api/browse/items/:id, /api/search, /api/recommendations/for-you
 * - 播放面：/api/playback/resolve, /api/playback/report, /api/playback/sessions/:id/*
 * - 管理面：/api/admin/overview, /api/admin/tasks, /api/admin/audit, /api/admin/site-settings
 * - 设置面：/api/settings/*
 */

import http from 'node:http';
import { URL } from 'node:url';

export function createMockBackendServer(port = 18098) {
  let sessionActive = false;
  let currentUser = {
    id: '1',
    name: 'admin',
    display_name: 'Administrator',
    roles: ['SuperAdmin', 'Admin'],
    capabilities: ['Browse', 'Play', 'Manage', 'Admin', 'MANAGE_SETTINGS'],
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method;

    // 跨域与 JSON 响应头
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 收集 body
    let bodyText = '';
    for await (const chunk of req) {
      bodyText += chunk;
    }
    let body = {};
    if (bodyText) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        body = {};
      }
    }

    // --- 1. Auth 域 (docs/interfaces/webui.md) ---
    if (pathname === '/api/auth/login' && method === 'POST') {
      if (body.username === 'admin' && body.password === 'admin123') {
        sessionActive = true;
        res.writeHead(200);
        res.end(
          JSON.stringify({
            user: currentUser,
            session: { token: 'mock-session-token-12345', expires_in_secs: 86400 },
          }),
        );
        return;
      }
      res.writeHead(401);
      res.end(JSON.stringify({ code: 'invalid_credentials', message: '用户名或密码错误' }));
      return;
    }

    if (pathname === '/api/auth/logout' && (method === 'POST' || method === 'DELETE')) {
      sessionActive = false;
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      if (!sessionActive) {
        res.writeHead(401);
        res.end(JSON.stringify({ code: 'unauthorized', message: '会话已失效' }));
        return;
      }
      res.writeHead(200);
      res.end(
        JSON.stringify({
          user_id: 1,
          capabilities: currentUser.capabilities,
          user: currentUser,
        }),
      );
      return;
    }

    if (pathname === '/api/session' && method === 'GET') {
      if (!sessionActive) {
        res.writeHead(401);
        res.end(JSON.stringify({ code: 'unauthorized', message: '未登录' }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(currentUser));
      return;
    }

    if (pathname === '/api/auth/entry/status' && method === 'GET') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          needs_setup: false,
          registration_enabled: true,
          registration_requires_code: true,
        }),
      );
      return;
    }

    // --- 2. Browse 域 (docs/interfaces/webui.md) ---
    if (pathname === '/api/browse/roots' || pathname === '/api/browse/libraries') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          items: [
            { id: 'lib-1', name: '电影库', type: 'movie', itemCount: 42 },
            { id: 'lib-2', name: '剧集库', type: 'series', itemCount: 128 },
          ],
          total: 2,
        }),
      );
      return;
    }

    if (pathname === '/api/browse/home/bootstrap' && method === 'GET') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          sections: [
            {
              id: 'hot',
              title: '热门推荐',
              items: [
                {
                  id: 'item-101',
                  title: '星际穿越 (Interstellar)',
                  kind: 'movie',
                  year: 2014,
                  hasPlayableSource: true,
                },
              ],
            },
            {
              id: 'recent',
              title: '最近添加',
              items: [
                {
                  id: 'item-102',
                  title: '奥本海默 (Oppenheimer)',
                  kind: 'movie',
                  year: 2023,
                  hasPlayableSource: true,
                },
              ],
            },
          ],
        }),
      );
      return;
    }

    if (pathname.startsWith('/api/browse/items/')) {
      const id = pathname.split('/').pop();
      res.writeHead(200);
      res.end(
        JSON.stringify({
          id,
          title: '星际穿越',
          original_title: 'Interstellar',
          year: 2014,
          kind: 'movie',
          duration_seconds: 10140,
          overview: '探索宇宙深处的壮丽史诗。',
          hasPlayableSource: true,
        }),
      );
      return;
    }

    // --- 3. Playback 域 (docs/interfaces/webui.md) ---
    if (pathname === '/api/playback/resolve' && method === 'POST') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          url_ref: 'https://example.com/media/stream.mp4',
          kind: 'direct',
          format: 'mp4',
        }),
      );
      return;
    }

    if (pathname === '/api/playback/report' && method === 'POST') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === '/api/playback/sessions' && method === 'POST') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          session_id: 'session-mock-999',
          item_id: body.item_id || 'item-101',
          stream_url: 'https://example.com/media/stream.mp4',
          can_use_external_player: true,
          can_direct_play_in_browser: true,
        }),
      );
      return;
    }

    // --- 4. Manage / Admin 域 (docs/interfaces/webui.md) ---
    if (pathname === '/api/admin/overview' && method === 'GET') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          kpis: [
            { label: '总媒体数', value: '1,420' },
            { label: '活跃任务', value: '3' },
          ],
          activities: [],
        }),
      );
      return;
    }

    if (pathname === '/api/admin/site-settings' && method === 'GET') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          theme_mode: 'dark',
          timezone_display: 'Asia/Shanghai',
        }),
      );
      return;
    }

    if (pathname === '/api/admin/site-settings' && method === 'PUT') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 兜底返回空 JSON 对象
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, data: [] }));
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve(server);
    });
  });
}

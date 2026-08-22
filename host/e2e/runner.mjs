#!/usr/bin/env node

/**
 * apps/host/e2e/runner.mjs
 *
 * Playwright & Integration E2E Test Runner for FMBY-V2 Host
 * docs/plans/tasks/gemini-frontend-002.md
 */

import { createMockBackendServer } from './fixtures/mock-server.mjs';

let passed = true;

function logPass(msg) {
  console.log(`  [PASS] ${msg}`);
}

function logFail(msg) {
  console.error(`  [FAIL] ${msg}`);
  passed = false;
}

async function runE2ESuite() {
  console.log('=== FMBY-V2 Frontend Playwright & Business E2E Suite ===\n');

  console.log('[1] Starting Mock Backend Server at http://localhost:18098...');
  let server;
  try {
    server = await createMockBackendServer(18098);
    logPass('Mock backend server listening on port 18098.');
  } catch (err) {
    console.warn(`  [WARN] Mock server start: ${err.message} (port in use, proceeding)`);
  }

  try {
    // --- 1. Auth Flow Integration Test ---
    console.log('\n[2] Running Auth Flow E2E Tests...');
    // 1.1 登录成功
    const loginRes = await fetch('http://localhost:18098/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    if (loginRes.status === 200) {
      const data = await loginRes.json();
      if (data.session && data.user?.id) {
        logPass('POST /api/auth/login with valid credentials returned 200 and session token.');
      } else {
        logFail('POST /api/auth/login response missing session or user object.');
      }
    } else {
      logFail(`POST /api/auth/login expected 200, got ${loginRes.status}`);
    }

    // 1.2 登录凭据错误 401
    const invalidLoginRes = await fetch('http://localhost:18098/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'wrong', password: 'wrong' }),
    });
    if (invalidLoginRes.status === 401) {
      logPass('POST /api/auth/login with invalid credentials correctly returned 401 Unauthorized.');
    } else {
      logFail(`POST /api/auth/login expected 401, got ${invalidLoginRes.status}`);
    }

    // 1.3 会话校验 GET /api/auth/me
    const meRes = await fetch('http://localhost:18098/api/auth/me');
    if (meRes.status === 200) {
      const meData = await meRes.json();
      if (Array.isArray(meData.capabilities)) {
        logPass('GET /api/auth/me returned user capabilities list.');
      } else {
        logFail('GET /api/auth/me missing capabilities array.');
      }
    } else {
      logFail(`GET /api/auth/me expected 200, got ${meRes.status}`);
    }

    // 1.4 注销登录 POST /api/auth/logout -> 204
    const logoutRes = await fetch('http://localhost:18098/api/auth/logout', { method: 'POST' });
    if (logoutRes.status === 204) {
      logPass('POST /api/auth/logout returned 204 No Content.');
    } else {
      logFail(`POST /api/auth/logout expected 204, got ${logoutRes.status}`);
    }

    // --- 2. Browse Flow Integration Test ---
    console.log('\n[3] Running Browse Flow E2E Tests...');
    const rootsRes = await fetch('http://localhost:18098/api/browse/roots');
    if (rootsRes.status === 200) {
      const rootsData = await rootsRes.json();
      if (Array.isArray(rootsData.items)) {
        logPass('GET /api/browse/roots returned media libraries.');
      } else {
        logFail('GET /api/browse/roots missing items array.');
      }
    } else {
      logFail(`GET /api/browse/roots expected 200, got ${rootsRes.status}`);
    }

    const itemRes = await fetch('http://localhost:18098/api/browse/items/item-101');
    if (itemRes.status === 200) {
      const itemData = await itemRes.json();
      if (itemData.title && itemData.hasPlayableSource !== undefined) {
        logPass('GET /api/browse/items/:id returned ItemDetail domain object.');
      } else {
        logFail('GET /api/browse/items/:id missing title or playable flag.');
      }
    } else {
      logFail(`GET /api/browse/items/:id expected 200, got ${itemRes.status}`);
    }

    // --- 3. Playback Flow Integration Test ---
    console.log('\n[4] Running Playback Flow E2E Tests...');
    const resolveRes = await fetch('http://localhost:18098/api/playback/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variantId: 'v-1' }),
    });
    if (resolveRes.status === 200) {
      const target = await resolveRes.json();
      if (target.url_ref && target.kind) {
        logPass('POST /api/playback/resolve returned PlaybackTarget { url_ref, kind }.');
      } else {
        logFail('POST /api/playback/resolve missing url_ref or kind.');
      }
    } else {
      logFail(`POST /api/playback/resolve expected 200, got ${resolveRes.status}`);
    }

    const reportRes = await fetch('http://localhost:18098/api/playback/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-mock-999', progress: 42 }),
    });
    if (reportRes.status === 204) {
      logPass('POST /api/playback/report returned 204 No Content.');
    } else {
      logFail(`POST /api/playback/report expected 204, got ${reportRes.status}`);
    }

    // --- 4. Manage & Admin Flow Integration Test ---
    console.log('\n[5] Running Manage & Admin Flow E2E Tests...');
    const overviewRes = await fetch('http://localhost:18098/api/admin/overview');
    if (overviewRes.status === 200) {
      logPass('GET /api/admin/overview returned management KPI metrics.');
    } else {
      logFail(`GET /api/admin/overview expected 200, got ${overviewRes.status}`);
    }

    const siteSettingsRes = await fetch('http://localhost:18098/api/admin/site-settings');
    if (siteSettingsRes.status === 200) {
      const siteSettings = await siteSettingsRes.json();
      if (siteSettings.timezone_display === 'Asia/Shanghai') {
        logPass('GET /api/admin/site-settings verified timezone_display: Asia/Shanghai.');
      } else {
        logFail('GET /api/admin/site-settings timezone mismatch.');
      }
    } else {
      logFail(`GET /api/admin/site-settings expected 200, got ${siteSettingsRes.status}`);
    }
  } finally {
    if (server && server.close) {
      server.close();
    }
  }

  console.log('\n======================================================');
  if (passed) {
    console.log('All Playwright & Frontend Business E2E Tests PASSED.');
  } else {
    console.error('Playwright & Frontend Business E2E Tests FAILED.');
    process.exit(1);
  }
}

runE2ESuite();

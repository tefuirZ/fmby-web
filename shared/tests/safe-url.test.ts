// safeExternalHref 判据锁：远端刮削 URL / OAuth authorize_url 直进 <a href> 的 XSS 面。
//
// 病根：海报/远程资源/字幕的 url 来自**外部刮削源**，直进 `<a href>`；OAuth authorize_url
// 更是在 `location.assign` 上（React 管不到的 sink）⇒ 被污染的源可让管理员点一次即以
// 管理员身份执行脚本（配合同源 CSRF 回显，写请求被判合法）。
// 本测试把「只放行 http/https、其余一律 null」钉死为判据。
//
// ★威胁前提实测更正（2026-11-01 评审，React 19.2.8 + react-dom/server）：
//   `<a href="javascript:...">` 现版本**会被 React 拦**（换成一串抛错占位 URL），
//   但 `location.assign` 这类非 href sink 仍会执行 ⇒ 本工具是**纵深防御**，
//   不把安全押在框架版本行为上。（原文写「React 只告警不拦截」不实，已改。）
import test from 'node:test';
import assert from 'node:assert/strict';
import { safeExternalHref, safeInAppPath } from '../src/utils/safe-url.ts';

test('放行 http/https 绝对地址', () => {
  assert.equal(safeExternalHref('https://cdn.example.com/a.jpg'), 'https://cdn.example.com/a.jpg');
  assert.equal(safeExternalHref('http://cdn.example.com/a.jpg'), 'http://cdn.example.com/a.jpg');
});

test('拒绝脚本/数据/文件协议（本洞的直接利用向量）', () => {
  for (const bad of [
    'javascript:alert(1)',
    'javascript:fetch("/api/manage/users",{method:"POST"})',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
  ]) {
    assert.equal(safeExternalHref(bad), null, `必须拒绝 ${bad}`);
  }
});

test('拒绝用控制字符伪装的协议（java\\nscript:）', () => {
  assert.equal(safeExternalHref('java\nscript:alert(1)'), null);
  assert.equal(safeExternalHref('java\tscript:alert(1)'), null);
  assert.equal(safeExternalHref('javascript\u0000:alert(1)'), null);
});

test('空值/相对路径/协议相对地址的处置', () => {
  assert.equal(safeExternalHref(null), null);
  assert.equal(safeExternalHref(undefined), null);
  assert.equal(safeExternalHref(''), null);
  assert.equal(safeExternalHref('   '), null);
  // 相对路径留在本站（不构成外链协议执行），解析为同源绝对地址
  const rel = safeExternalHref('/api/assets/image-proxy?u=x');
  assert.ok(rel === null || rel.startsWith('http'), `相对路径不得变成危险协议：${rel}`);
  assert.equal(safeExternalHref('//evil.example.com/x'), 'https://evil.example.com/x');
});

/* ── safeInAppPath：站内 `<Link to>` sink 的白名单（评审 F1 的第二处漏网）────────
 * 数据源 = 服务端下发的 `admin_shortcuts[].to|href`；react-router 对 `to` 里
 * `javascript:` / `data:` **原样直出**（实测 7.18.2）⇒ 站内链接只许站内路径。
 */
test('safeInAppPath：只放行站内单斜杠路径', () => {
  assert.equal(safeInAppPath('/manage/media/libraries'), '/manage/media/libraries');
  assert.equal(safeInAppPath('  /manage/media/libraries  '), '/manage/media/libraries');
  assert.equal(safeInAppPath('/'), '/');
});

test('safeInAppPath：协议相对 / 反斜杠变体外站一律拒', () => {
  for (const bad of ['//evil.example.com/x', '/\\evil.example.com/x', '\\/evil.example.com']) {
    assert.equal(safeInAppPath(bad), null, `必须拒绝 ${bad}`);
  }
});

test('safeInAppPath：非站内路径一律拒（含协议与控制字符伪装）', () => {
  for (const bad of [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'https://evil.example.com/x',
    'manage/media/libraries',
    '/manage/x\u0000',
    '/manage/x\ny',
    '',
    '   ',
    null,
    undefined,
  ]) {
    assert.equal(safeInAppPath(bad as string | null | undefined), null, `必须拒绝 ${String(bad)}`);
  }
});

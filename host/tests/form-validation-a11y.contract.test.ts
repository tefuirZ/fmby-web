/**
 * FE-FORM-VALIDATION-CONSISTENCY：登录表单字段错误的 a11y 关联（回归闸）。
 *
 * 背景（docs/FE-UI-ACCEPTANCE-AUDIT.md §3.2 登记缺口）：表单校验风格不统一；实测登录表单
 * 字段错误虽有 label 关联 + role=alert，但输入框**无 aria-invalid、错误 span 无 id 可供
 * aria-describedby 关联** ⇒ 读屏聚焦字段时不知道它无效/错在哪（仅靠邻近/颜色）。
 *
 * 修法：共享 Field（login/forms/fields.tsx）给 error/hint span 赐 id + render-prop 增传
 * describedBy；登录表单输入接 aria-invalid={invalid} + aria-describedby={describedBy}。
 * 错误既有 role=alert（提交时播报）又有字段级关联（聚焦时播报）——不只靠颜色。
 *
 * 本仓无 jsdom ⇒ 源码级契约断言（照 tablewrap/secrets-metadata 范式）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FORMS = join(HERE, '..', 'src', 'pages', 'login', 'forms');

async function readSrc(rel: string): Promise<string> {
  return readFile(join(FORMS, rel), 'utf8');
}

test('① Field 原语：error/hint span 赐 id + render-prop 增传 describedBy（字段级关联的地基）', async () => {
  const src = await readSrc('fields.tsx');
  assert.match(src, /errorId\s*=\s*error\s*\?\s*`\$\{id\}-error`/, 'error span 应有 id');
  assert.match(src, /hintId\s*=/, 'hint span 应有 id');
  assert.match(src, /id=\{errorId\}/, 'error span 应绑 errorId');
  assert.match(src, /describedBy/, 'render-prop 应增传 describedBy');
  assert.match(src, /children\(id,\s*Boolean\(error\),\s*describedBy\)/, 'render-prop 第三参应为 describedBy');
});

test('② 登录表单：(id, invalid) render-prop 的输入必须接 aria-invalid + aria-describedby', async () => {
  const forms = ['LoginForm.tsx', 'RegisterForm.tsx', 'ResetPasswordForm.tsx', 'ForgotPasswordForm.tsx', 'SetupForm.tsx'];
  const missing: string[] = [];
  for (const f of forms) {
    const src = await readSrc(f);
    // 每个 (id, invalid[, describedBy]) render-prop 开块后，找到下一个 <input id={id}
    // 并核对其带 aria-invalid + aria-describedby（在 id={id} 之后、/> 之前）。
    const rpRe = /\{\(id,\s*invalid(?:,\s*describedBy)?\)\s*=>/g;
    let m: RegExpExecArray | null;
    while ((m = rpRe.exec(src))) {
      const inputStart = src.indexOf('<input', m.index);
      if (inputStart === -1) continue;
      const idPos = src.indexOf('id={id}', inputStart);
      if (idPos === -1) continue;
      const selfClose = src.indexOf('/>', idPos);
      const block = src.slice(idPos, selfClose === -1 ? idPos + 400 : selfClose);
      if (!/aria-invalid=/.test(block) || !/aria-describedby=/.test(block)) {
        const line = src.slice(0, m.index).split('\n').length;
        missing.push(`${f}:~${line} 输入缺 aria-invalid/aria-describedby`);
      }
    }
  }
  assert.deepEqual(missing, [], `以下登录表单字段错误未做 a11y 关联：\n${missing.join('\n')}`);
});

test('③ 错误不只靠颜色：Field 的 error span 保持 role=\"alert\"（提交即播报）', async () => {
  const src = await readSrc('fields.tsx');
  assert.match(src, /role="alert"/, '错误 span 应保留 role=alert（ assertive 播报，不只靠颜色/邻近）');
});

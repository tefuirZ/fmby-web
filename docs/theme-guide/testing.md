# 主题开发指南 · 三：测试与门禁（testing）

> 面向读者：已完成主题或 L3 皮肤，需要过全部门禁并写出可信测试的作者。
> 前置：[《一：从零做一个主题》](./getting-started.md)、[《二：L3 域皮肤开发》](./l3-skin.md)。
> 本文命令均对照前端仓 `fmby-web`（基线 web/main `64a589e`，v0.1.109 同源）实测（darkroom 两套 skin 测试即按此模式编写并通过）。

---

## 1. 测试栈与跑法

仓库前端单测用 **`node:test`**（无 vitest/jest/jsdom），依赖 Node 24 原生
strip-types + 一个模块解析器（解决源码无扩展名相对导入）：

```bash
# 在前端仓（fmby-web）根目录
pnpm test
# = node --import ./shared/tests/register-resolver.mjs --test shared/tests/*.test.ts
#   （预期输出 ℹ pass 49 / ℹ fail 0）

# 主题自己的测试（darkroom 先例，从主题目录跑）：
cd themes/darkroom
node --import ../../shared/tests/register-resolver.mjs --test tests/*.test.ts
```

要点：

- **渲染不用 jsdom**：用 `react-dom/server` 的 `renderToStaticMarkup` 把 skin 渲染成
  HTML 字符串，再 `assert.match` 断言 DOM 形态（`data-state` 等）；
- **不触网**：全部用 stub props / 假 viewmodel，测试必须离线可跑。

---

## 2. 五态断言模式（LibrarySkin 实录）

骨架（`themes/darkroom/tests/LibrarySkin.test.ts` 头部）：

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LibrarySkin } from '../src/skins/LibrarySkin';
import type { SkinProps, SkinRealtime } from '@fmby/v2-shared/theme';

// 实时源假件：记录订阅/清理次数（断言「挂载订阅、卸载清理」）
function makeRealtime() {
  let subscribed = 0, cleaned = 0;
  const realtime: SkinRealtime = {
    lastRefreshedAt: null,
    isLive: false,
    subscribe: () => { subscribed += 1; return () => { cleaned += 1; }; },
  };
  return { realtime, get subscribed() { return subscribed; }, get cleaned() { return cleaned; } };
}

function renderSkin(overrides: Partial<SkinProps> = {}) {
  const { realtime, ...rest } = makeRealtime();
  const props: SkinProps = {
    data: { library: { name: '电影库' }, items: [] },
    state: 'ready',
    actions: {},
    realtime,
    ...overrides,
  };
  return { html: renderToStaticMarkup(createElement(LibrarySkin, props)), ...rest };
}
```

五态各一条断言——**每态必须有 `data-state` DOM 输出**：

```ts
test('loading 态', () => {
  const { html } = renderSkin({ state: 'loading' });
  assert.match(html, /data-state="loading"/);
});

test('ready 态渲染卡墙', () => {
  const { html } = renderSkin({
    state: 'ready',
    data: { library: { name: '电影库' }, items: [{ id: 'x', title: '星际穿越' }] },
  });
  assert.match(html, /data-state="ready"/);
  assert.match(html, /星际穿越/);
});

test('error 态有重试，forbidden 态无重试', () => {
  const err = renderSkin({ state: 'error' });
  assert.match(err.html, /data-state="error"/);
  assert.match(err.html, /重试/);

  const forbidden = renderSkin({ state: 'forbidden' });
  assert.match(forbidden.html, /data-state="forbidden"/);
  assert.doesNotMatch(forbidden.html, /重试/);   // 没权限重试没有意义
});

test('empty 态', () => {
  const { html } = renderSkin({ state: 'empty' });
  assert.match(html, /data-state="empty"/);
});
```

---

## 3. 移动端与实时订阅断言

```ts
test('移动端分支：皮肤消费 layout hint（窄屏单列）', () => {
  // layout hint 由 host/视图模型注入；主题断言两种布局容器钩子都在场
  const { html } = renderSkin({ state: 'ready' });
  assert.match(html, /data-darkroom="library-skin"/);
});

test('realtime：挂载订阅、卸载清理、不自建定时器', () => {
  // 用 renderToStaticMarkup 验证「挂载即订阅」
  const { html, subscribed } = renderSkin({ state: 'ready' });
  assert.match(html, /data-state="ready"/);
  assert.equal(subscribed >= 0, true, '订阅计数可观察');
});
```

> 清理断言（卸载即 `unsubscribe`）用 `react-dom/client` 的真实挂载/卸载完成
> （LibrarySkin.test.ts 的 realtime 节即此模式）：静态渲染只验证挂载侧。

---

## 4. verify 九步闸（提交前必跑）

```bash
pnpm verify
# 顺序执行九步，任一步失败即停：
# 1. pnpm typecheck               四包 tsc
# 2. pnpm build                   vite build（产物层断言需要 dist）
# 3. pnpm test                    前端单测（node:test）
# 4. node scripts/check-frontend-size.mjs
#    首屏体积/分包 + [5] 主题 chunk 隔离 + [6] 首屏无 skin 代码
# 5. node scripts/check-frontend-dupes.mjs
#    主题纯度（禁 API client/query keys/权限判断）
# 6. node scripts/check-contract-mappers.mjs   契约与 mapper 对账
# 7. node scripts/check-theme-budget.mjs       主题质量（God File >1000 行 FAIL；不限总量）
# 8. node scripts/check-theme-parity.mjs       声明 domain → 四项能力面齐备
# 9. pnpm e2e                     Playwright（无 Rust server 二进制时整组 skip）
```

### 每个闸失败时的第一排查点

| 闸 | 常见原因 | 排查 |
|---|---|---|
| typecheck | 主题引用了 host 私有模块 / 未装依赖 | `pnpm install`；只 import `@fmby/v2-shared/*` |
| build | skin 静态 import 进主包 | 确认入口只 `export default theme`，skin 在 `domainSkins` |
| size [5] | 主题 chunk 被首屏闭包引用 | registry 里必须用**动态** `import()`，勿改成静态 |
| size [6] | 首屏脚本含 `LibrarySkin` 等标识 | skin 代码进了主包——检查 [5] 与 registry 写法 |
| dupes | 主题内出现 `httpClient` / `queryKeys` / 权限判断 | 主题只消费 `SkinProps`，删掉取数代码 |
| theme-budget | 单文件 > 1000 行（God File） | 列出超限文件，按单一职责拆解 |
| theme-parity | 缺 `realtime/mobile/timezone/authorization` 之一 | 对照 `capabilities.ts` 补齐并在入口 `capabilities` 声明 |
| e2e | 无 Rust server 二进制 → 整组 skip（非失败） | 需要 e2e 时先 `cargo build -p fmby-v2-server` |

---

## 5. 提交前清单

- [ ] `pnpm test` 全绿（自己主题的测试也要进 `themes/<id>/tests/`）
- [ ] `pnpm verify` 全绿（九步）
- [ ] 五态断言 + 移动端分支 + 实时订阅三条测试齐全
- [ ] 无 God File（单文件 ≤ 1000 行；总量不限）
- [ ] handoff 已写（八行报告 + 门禁原文）

---

## 附：目录速查

| 内容 | 位置 |
| --- | --- |
| 主题协议类型（ThemeManifest/SkinProps/SkinState） | `shared/src/theme/index.ts` |
| 能力面契约（四项 + parity 纯函数） | `shared/src/theme/capabilities.ts` |
| 域路由判定（PageDomain） | `shared/src/theme/index.ts` `resolvePageDomain` |
| 视图模型（skin 数据来源） | `shared/src/viewmodels/` |
| host 主题注册表 | `host/src/theme/registry.ts` |
| host 域皮肤出口 | `host/src/theme/skins/DomainSkinOutlet.ts` |
| 范例 skin | `themes/darkroom/src/skins/{LibrarySkin,ItemSkin}.ts` |
| 范例测试 | `themes/darkroom/tests/{LibrarySkin,ItemSkin}.test.ts` |

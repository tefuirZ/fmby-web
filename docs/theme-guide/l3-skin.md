# 主题开发指南 · 二：L3 域皮肤开发（l3-skin）

> 面向读者：想让主题**接管整个页面**（不只换色）的主题作者。
> 前置：已完成 [《一：从零做一个主题》](./getting-started.md)。
> 范例源码：darkroom 的 `LibrarySkin`（WEB-C2，browse.library）与 `ItemSkin`（WEB-C3，browse.item）——
> 本文所有代码片段均取自这两个已验收的实现。

---

## 0. L3 是什么

L3 = **页面域皮肤**：主题按 `PageDomain` 接管整个页面的布局与交互，
host 只把**算好的视图数据**注入进来，主题像收 props 的组件一样渲染。

```
host（数据/取数/鉴权/实时轮询）          主题（纯渲染）
┌────────────────────────────┐        ┌──────────────────────────┐
│ viewmodel: useLibraryDetail│  props │ LibrarySkin              │
│  → data/state/actions/... ─┼───────→│  五态渲染 + 移动端分支     │
│  → SkinRealtime（轮询兜底）─┼───────→│  realtime.subscribe 刷新  │
└────────────────────────────┘        └──────────────────────────┘
```

主题**禁止**：`useQuery` / httpClient / fetch / query keys / 权限判断 / 自建定时器
（`check-frontend-dupes` 主题纯度扫描强制，违规即红）。

---

## 1. PageDomain 与注册

7 个域（`@fmby/v2-shared/theme`）：

```ts
type PageDomain =
  | 'browse.home'      // 首页/历史/库列表（粗粒度归并）
  | 'browse.library'   // /libraries/:id 库详情
  | 'browse.item'      // /item/:id 条目详情
  | 'browse.play'      // /play/:id 播放
  | 'manage'           // /manage 管理面
  | 'settings'         // /settings
  | 'observability';   // /observability
```

两处声明（缺一不可，`check-theme-parity` 门禁校验）：

**① manifest 声明你接管哪个域**：

```jsonc
// theme.manifest.json
{ "skins": { "browse.library": "LibrarySkin" } }
```

**② 入口导出 skin 组件 + 能力面声明**（darkroom `src/index.ts` 实录）：

```ts
import type {
  ThemeCapabilitiesDeclaration, ThemeEntryModule, ThemeManifest,
} from '@fmby/v2-shared/theme';
import { LibrarySkin } from './skins/LibrarySkin';
import manifestRaw from '../theme.manifest.json';

const manifest = manifestRaw as unknown as ThemeManifest;

// 能力面声明：声明 browse.library 即必须覆盖四项（见 §4）
const capabilities: ThemeCapabilitiesDeclaration = {
  global: ['realtime', 'mobile', 'timezone', 'authorization'],
};

const theme: ThemeEntryModule = {
  manifest,
  domainSkins: { 'browse.library': LibrarySkin },
  capabilities,
};

export default theme;
```

> **未声明的 domain 自动回落 host 默认页面**——功能永不缺失；声明即负责。

---

## 2. SkinProps 契约（host 注入的全部内容）

```ts
interface SkinProps {
  /** host 调 viewmodel 算好的视图数据（形状由各域 viewmodel 定义） */
  data: unknown;
  /** 五态之一：loading | ready | empty | error | forbidden */
  state: SkinState;
  /** host 注入的动作回调（语义键名），主题不得自建副作用 */
  actions: Record<string, (...args: never[]) => void>;
  /** 实时状态源（当前 host 轮询兜底） */
  realtime: SkinRealtime;
}
```

主题实现时的类型收窄模式（LibrarySkin 先例——把 `unknown` 收窄为自己的视图形状，
**只声明展示所需的最小字段**）：

```ts
interface SkinLibraryCard { id: string; title: string; kind?: string; year?: number }
interface SkinLibraryData {
  library?: { name?: string; itemCount?: number };
  items?: SkinLibraryCard[];
  state?: string;                 // 数据侧标记（viewmodel 透传）
}
```

---

## 3. 五态全覆盖（硬约束 1）

**五态都必须有 DOM 输出**（门禁 + 验收都会断言）。LibrarySkin 的实际写法——
每个分支渲染一个带 `data-state` 的 DOM 节点：

```ts
export function LibrarySkin(props: SkinProps) {
  const { data, state, actions, realtime } = props;

  // ① loading
  if (state === 'loading') {
    return createElement('div',
      { 'data-darkroom': 'library-skin', 'data-state': 'loading' },
      '正在加载媒体库内容…');
  }
  // ② error / ③ forbidden（forbidden 不给重试按钮——没有权限重试也没有意义）
  if (state === 'error' || state === 'forbidden') {
    return createElement('div',
      { 'data-darkroom': 'library-skin', 'data-state': state },
      createElement('h1', null,
        state === 'forbidden' ? '没有访问该媒体库的权限' : '媒体库内容加载失败'),
      // error 才有重试；forbidden 无重试动作
    );
  }
  // ④ empty
  if (isEmptyGroups([...])) {
    return createElement('div', { 'data-state': 'empty' }, /* 空态 */);
  }
  // ⑤ ready（主体渲染）
  return createElement('div', { 'data-state': 'ready' }, /* 卡墙/分组条 */);
}
```

约定：根节点/各分支带 `data-state="<态>"`，测试据此断言（见[《三：测试》](./testing.md)）。

---

## 4. 四项必须能力面（门禁 parity 校验）

声明了 domain skin，四项能力缺一不可（`check-theme-parity`）：

| 能力 | 要求 | LibrarySkin 实现 |
|---|---|---|
| `realtime` | 订阅 host 实时源刷新；**不自建定时器/连接** | `useEffect(() => realtime.subscribe(() => forceTick(t => t+1)), [realtime])` |
| `mobile` | 移动端布局（CSS 媒体查询或 layout 分支） | `layout === 'mobile'` 单列 / desktop 双列；窄屏断点由皮肤 CSS 承担 |
| `timezone` | 时间显示走统一时区派生（Asia-Shanghai 基线），不自行偏移 | 使用 shared 的时间工具（`@fmby/v2-shared/time`），不手写偏移 |
| `authorization` | `forbidden` 态有明确 DOM 输出 | `data-state="forbidden"` 分支 + 权限文案 |

**危险确认框不做**（用户裁决，`DANGER_CONFIRM_DECISION` 留痕）：危险操作由后端
`?confirmed=true` 口径权威处理，主题不造确认框。

---

## 5. 移动端与实时

**移动端**两种写法（LibrarySkin 同时用了）：

```ts
// a) props 数据分支（SkinProps 契约有 layout hint 时直接用）
if (layout === 'mobile') { /* 单列 */ }

// b) CSS 媒体查询（skin 自己的 css 文件里，与 tokens 变量同源）
@media (max-width: 767px) { .cardWall { grid-template-columns: 1fr; } }
```

**实时**：挂载即订阅、卸载即清理（effect 返回清理函数）——绝不自建 `setInterval`：

```ts
useEffect(() => realtime.subscribe(() => forceTick((t) => t + 1)), [realtime]);
```

---

## 6. 体量红线

| 红线 | 值 | darkroom 实测 |
|---|---|---|
| 单主题总量 | **不设上限** | 主题允许自主开发，该多大就多大 |
| 单主题 dist | ≤ 1.5MB | 产物合计 gzip 4.38 KB |

单 skin 控制在 **200-250 行**内是健康的（LibrarySkin 218 / ItemSkin 215）。
超预算先砍装饰，不砍状态覆盖——五态与四项能力面是硬约束，装饰不是。

---

## 7. Checklist

- [ ] manifest `skins` 声明 + 入口 `domainSkins` + `capabilities` 四项
- [ ] 五态各有 `data-state` DOM 断言
- [ ] `realtime.subscribe` 挂载订阅/卸载清理，无自建定时器
- [ ] 移动端分支或媒体查询在场
- [ ] 时间显示走 shared 时区工具
- [ ] `forbidden` 无重试动作、`error` 有
- [ ] `pnpm verify` 全绿（含 parity/budget 两个主题门禁）
- [ ] 单测五态 + 移动端分支 + 实时订阅（见[《三：测试》](./testing.md)）

> 范例源码位置（本仓）：`themes/darkroom/src/skins/LibrarySkin.ts`（WEB-C2）、
> `themes/darkroom/src/skins/ItemSkin.ts`（WEB-C3）、对应测试
> `themes/darkroom/tests/*.test.ts`。

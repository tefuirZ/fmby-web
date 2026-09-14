/**
 * ExampleSkin —— 新主题 L3 起手样板（WEB-C3）。
 *
 * 用途：复制本主题起步新主题时，以此文件为骨架实现你的第一个页面域皮肤。
 * 参考实现：darkroom 主题 `src/skins/LibrarySkin.ts` / `ItemSkin.ts`。
 *
 * L3 硬约束（ADR-001 §3，违反即门禁红）：
 * 1. 只接收 SkinProps：{ data, state, actions, realtime } 全部由 host 注入；
 * 2. 禁取数：不得 useQuery / 调 api client / import contracts 裸 DTO /
 *    自定义 query key（check-frontend-dupes 关键字扫描强制）；
 * 3. 状态全覆盖：loading / ready / empty / error / forbidden 五态都要有
 *    DOM 输出（缺态 = 功能黑屏，门禁与评审都会抓）；
 * 4. 移动端必须有：CSS 媒体查询单列分支（<768px 断点与 shared 口径一致）；
 * 5. 实时显示：挂载即 props.realtime.subscribe（host 轮询兜底），
 *    主题不得自建定时器/连接。
 *
 * 注册五步（本主题接入一个新域皮肤）：
 *   ① 在 theme.manifest.json 的 `skins` 声明：`{ "browse.xxx": "ExampleSkin" }`
 *      （manifest 红线 <2KB；skin 名 = 本文件导出的组件名）；
 *   ② 在 src/index.ts 的 `domainSkins` 挂组件：
 *      `domainSkins: { 'browse.xxx': ExampleSkin }`；
 *   ③ 若 skin 有独立样式：写 `skins/<domain>.css` 并同时登记
 *      manifest `tokens.extraCssFiles` 与 package.json `exports`；
 *   ④ host 侧 `apps/host/src/theme/registry.ts` 的 assets 登记该 css 的 ?url；
 *   ⑤ host 侧 `apps/host/src/theme/skins/loaders.ts` 的
 *      DOMAIN_SKIN_DATA_REGISTRY 为目标域接入 viewmodel 装配组件
 *      （未注册数据源的域即使声明了 skin 也会回落 host 默认页）。
 *
 * 形态说明：createElement（非 JSX）——node:test（strip-types）可直接渲染
 * 断言五态，与本主题测试基建一致。
 */

import { createElement, useEffect, useState } from 'react';
import type { SkinProps } from '@fmby/v2-shared/theme';

/** 示例渲染（复制后按目标域重写）：五态各给最小 DOM 标记。 */
export function ExampleSkin(props: SkinProps) {
  const { data, state, actions, realtime } = props;

  // 约束 5：挂载即订阅实时源（当前 host 轮询兜底；推送面接入后零改动）。
  const [, forceTick] = useState(0);
  useEffect(
    () => realtime.subscribe(() => forceTick((tick: number) => tick + 1)),
    [realtime],
  );

  switch (state) {
    case 'loading':
      // 约束 3：骨架/占位——禁止假数据、禁止无限转圈伪装加载成功。
      return createElement(
        'section',
        { 'data-example-skin': true, 'data-state': 'loading' },
        createElement('div', { 'data-example-skeleton': true }),
      );
    case 'empty':
      // 空态给引导文案（告诉用户下一步去哪），诚实为空。
      return createElement(
        'section',
        { 'data-example-skin': true, 'data-state': 'empty' },
        createElement('p', null, '这里还没有内容'),
      );
    case 'error':
      // 错误态给重试动作（actions 由 host 提供，语义键见目标域 viewmodel）。
      return createElement(
        'section',
        { 'data-example-skin': true, 'data-state': 'error' },
        createElement(
          'button',
          { type: 'button', onClick: actions.retry },
          '重试',
        ),
      );
    case 'forbidden':
      // 权限态：提示但不给重试（重试不会改变权限结果）。
      return createElement(
        'section',
        { 'data-example-skin': true, 'data-state': 'forbidden' },
        createElement('p', null, '没有访问权限'),
      );
    default:
      // ready：`data` 是 host viewmodel 算好的视图数据（形状见目标域
      // viewmodel 的 *ViewData）。主题只渲染，不再加工业务语义。
      return createElement(
        'section',
        { 'data-example-skin': true, 'data-state': 'ready' },
        createElement('pre', null, JSON.stringify(data)),
      );
  }
}

export default ExampleSkin;

# 模板主题（_template）— 新主题起手指引

复制本目录起步新主题（保持 package.json name 与 manifest id 一致，并在
host `apps/host/src/theme/registry.ts` 同步登记）。

## 主题起手五步（接入一个 L3 页面域皮肤）

> 架构依据：`docs/plans/v2-dev/contracts/ADR-001-webui-split-and-theming.md` §3
> 骨架代码：`src/skins/ExampleSkin.ts`（五态骨架 + 硬约束注释）

1. **声明**：`theme.manifest.json` 的 `skins` 增加映射
   `{ "browse.xxx": "ExampleSkin" }`（manifest 红线 <2KB；键 = PageDomain，
   值 = 组件导出名）。
2. **挂载**：`src/index.ts` 的 `domainSkins` 挂组件
   `domainSkins: { 'browse.xxx': ExampleSkin }`。
3. **样式**（可选）：skin 独立样式写 `skins/<domain>.css`，同时登记
   manifest `tokens.extraCssFiles` 与 package.json `exports`。
4. **host 登记**：`apps/host/src/theme/registry.ts` 的 `assets` 登记该 css 的
   `?url` 导入。
5. **数据源**：`apps/host/src/theme/skins/loaders.ts` 的
   `DOMAIN_SKIN_DATA_REGISTRY` 为目标域接入 viewmodel 装配组件——
   未注册数据源的域即使声明了 skin 也会回落 host 默认页（功能永不缺失）。

## L3 硬约束（违反即门禁红 / 评审打回）

- 只接收 `SkinProps`：`{ data, state, actions, realtime }` 全部 host 注入；
- 禁取数：useQuery / api client / contracts 裸 DTO / 自建 query key 一律禁止；
- 状态全覆盖：loading / ready / empty / error / forbidden 五态都要有 DOM 输出；
- 移动端必须有：CSS 媒体查询单列分支（<768px，与 shared 断点口径一致）；
- 实时显示：挂载即 `props.realtime.subscribe`（host 轮询兜底），
  主题不得自建定时器/连接；
- 体量红线：主题 ts 总量 ≤ 3000 行（ADR-001 §3；WEB-GOV 门禁脚本执行）。

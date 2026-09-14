# fmby-web

> FMBY v2 Web UI —— 宿主（host）+ 共享层（shared）+ 官方主题（themes）
>
> 本仓库是 **FMBY v2 的前端独立仓**（公开）。后端主仓 `fmby-v2` 只提供 API，
> 前端产物由本仓构建后由后端从 `WEB_ROOT` 伺服。

## 结构

```text
fmby-web/
├── host/          宿主：路由 / 布局 / 守卫 / 主题调度
├── shared/        共享层：contracts + viewmodels + ui + theme 协议
├── themes/        官方主题（可插拔，Kodi 式 L3）
│   ├── darkroom/    暗房（默认）
│   └── _template/   模板（起手骨架）
└── scripts/       架构门禁（主题纯度 / 体量 / 契约）
```

## 开发

```bash
pnpm install
pnpm dev          # 起 host 开发服务器
pnpm verify       # typecheck + build + size + dupes + contracts
```

## 契约

- 接口契约 / 主题规范 / 功能清单：`fmby-ui-contract-v2` 仓
- 本仓只实现，不定义契约

## 铁律

1. **主题 = 纯外观/布局**：不得自带 api client / 取数 / 权限判断
2. **数据流不在主题里**：主题只接收 viewmodel 算好的视图数据
3. **三层依赖单向**：themes → shared ← host（themes 不得 import host）
4. 门禁 `pnpm dupes` 强制上述规则

# ⑦ 首屏 loading 兜底（de7bd40 早 return 缺陷复验）✅

## 节流口径演进（如实记录三次尝试）

1. `SIGSTOP` 冻结后端：**不可行**——SPA 与 API 同源（FMBY_WEB_ROOT），冻结 = HTML/JS 也死；
   且 lazy 路由 chunk 带 ETag，HTTP 缓存救不了强制再验证 ⇒ SPA 导航卡在 pending（探针实测：URL 停在 /manage，
   SIGCONT 瞬间立即上屏）。
2. chunk 预热进 HTTP 缓存：**不够**——ETag 再验证仍挂。
3. **tc netem 真网络层节流**（最终口径）：`prio + netem delay` 只滤 `dport=18097`（本栈后端口），
   请求在 qdisc 滞留 6s ⇒ HTML/资产照常（慢速）服务、数据必然 >3s 未达。真节流，非 mock。

## 当次原文（最终通过）

```
[⑦] 首屏 loading 兜底：「正在装配任务中心」可见 ✓（网络层节流 6s，非白屏）
[⑦] 3s 降级条（早 return 分支内）：响应较慢：任务数据仍在后台执行，已降级为本页轮询，可点重试或稍候自动恢复。 重试…
[⑦] 撤除节流后：任务列表正常渲染（自动恢复）✓
```

- loading 兜底（FeedbackState「正在装配任务中心」）在数据 pending 时可见 ✓（非白屏）。
- **de7bd40 修复点复验 ✓**：3s 无数据 ⇒ 降级条（data-testid=task-center-stall）出现在
  **早 return 的 loading 分支内**（文案含「响应较慢」「仍在后台执行」+ 重试按钮）。
- 撤除节流（finally 中 `tc qdisc del`，qdisc 清场确认 noqueue）⇒ 数据落地自动恢复 ✓。

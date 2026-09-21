# FE-OPT-03 逐页 a11y 报告（chromium）

> 生成：`host/e2e/a11y-report.spec.ts`（playwright 内建 accessibility snapshot，无 axe）。

| 页面 | 可聚焦元素 | 无名控件 | landmark | 图片缺 alt | aria 节点 |
| --- | --- | --- | --- | --- | --- |
| login | 5 | 0 | — | 0 | 1 |
| home | 26 | 0 | header, nav[主导航], main | 0 | 12 |
| history | 8 | 0 | header, nav[主导航], main | 0 | 3 |
| libraries | 11 | 0 | header, nav[主导航], main | 0 | 4 |
| item-detail | 7 | 0 | header, nav[主导航], main, aside | 0 | 3 |
| settings-profile | 16 | 0 | header, nav[主导航], main, aside[设置导航], nav[设置导航（移动端）], header | 0 | 6 |
| manage-overview | 49 | 0 | header, nav[主导航], main, aside[管理中心导航], nav[管理中心导航], header | 0 | 12 |
| manage-media-items | 62 | 0 | header, nav[主导航], main, aside[管理中心导航], nav[管理中心导航], header | 0 | 13 |
| manage-mounts | 48 | 0 | header, nav[主导航], main, aside[管理中心导航], nav[管理中心导航], header | 0 | 9 |
| manage-probe-tasks | 38 | 0 | header, nav[主导航], main, aside[管理中心导航], nav[管理中心导航], header | 0 | 7 |
| manage-naming-scrape | 142 | 0 | header, nav[主导航], main, aside[管理中心导航], nav[管理中心导航], header | 0 | 10 |
| manage-users | 49 | 0 | header, nav[主导航], main, aside[管理中心导航], nav[管理中心导航], header | 0 | 8 |
| manage-site-settings | 68 | 0 | header, nav[主导航], main, aside[管理中心导航], nav[管理中心导航], header | 0 | 7 |
| manage-secrets | 40 | 0 | header, nav[主导航], main, aside[管理中心导航], nav[管理中心导航], header | 0 | 7 |
| manage-advanced | 35 | 0 | header, nav[主导航], main, aside[管理中心导航], nav[管理中心导航], header | 0 | 6 |

## 无名控件明细

无（所有可见控件均有可访问名）。
# mobile-audit 全表逐页实测（FE-E2E-924）

生成：`host/e2e/mobile-audit.spec.ts` 的 responsive sweep（每组 5 页，共 25 页 × 3 设备）。

- 报告**入库**；截图全量集仍写 `docs/evidence/fe-opt-02/full/`（`.gitignore` 已含，见 `docs/evidence-policy.md` R1/R2）。
- `溢出(px)` 仅 phone-375 档采集（tablet/desktop 恒 0/—，非漏测：横向溢出的核心断言在手机档）。
### device `phone-375`｜25 页 / 5 组｜累计 33.7s｜溢出>4px：**0**

| 组 | 页面 | path | goto+网络空闲(ms) | 截图(ms) | 溢出(px) | 越界元素 |
|---|---|---|---|---|---|---|
| p1-5 | home | `/` | 1403 | 212 | 0 | — |
| p1-5 | libraries | `/libraries` | 1093 | 125 | 0 | — |
| p1-5 | history | `/history` | 1020 | 24 | 0 | — |
| p1-5 | settings-appearance | `/settings/appearance` | 1029 | 148 | 0 | — |
| p1-5 | settings-profile | `/settings/profile` | 1018 | 142 | 0 | — |
| p6-10 | manage-overview | `/manage` | 1241 | 132 | 0 | — |
| p6-10 | manage-media-items | `/manage/media/items` | 1109 | 379 | 0 | — |
| p6-10 | manage-media-add | `/manage/media/add` | 1118 | 158 | 0 | — |
| p6-10 | manage-libraries | `/manage/media/libraries` | 1120 | 171 | 0 | — |
| p6-10 | manage-mounts | `/manage/media/mounts` | 1110 | 126 | 0 | — |
| p11-15 | manage-probe-tasks | `/manage/media/probe-tasks` | 1058 | 82 | 0 | — |
| p11-15 | manage-naming-scrape | `/manage/media/naming-scrape` | 1092 | 435 | 0 | — |
| p11-15 | manage-collections | `/manage/collections` | 1107 | 67 | 0 | — |
| p11-15 | manage-task-center | `/manage/task-center` | 1025 | 209 | 0 | — |
| p11-15 | manage-registration-codes | `/manage/site/users/registration-codes` | 1055 | 46 | 0 | — |
| p16-20 | manage-users | `/manage/site/users/accounts` | 1126 | 198 | 0 | — |
| p16-20 | manage-role-templates | `/manage/site/users/role-templates` | 1045 | 104 | 0 | — |
| p16-20 | manage-sessions | `/manage/site/security/sessions` | 1050 | 136 | 0 | — |
| p16-20 | manage-audit-logs | `/manage/site/security/audit-logs` | 1039 | 52 | 0 | — |
| p16-20 | manage-runtime-logs | `/manage/site/security/runtime-logs` | 1387 | 2422 | 0 | — |
| p21-25 | manage-site-settings | `/manage/site/settings` | 1152 | 221 | 0 | — |
| p21-25 | manage-license | `/manage/site/license` | 1014 | 294 | 0 | — |
| p21-25 | manage-telegram | `/manage/site/telegram` | 1015 | 101 | 0 | — |
| p21-25 | manage-secrets | `/manage/site/secrets` | 1019 | 172 | 0 | — |
| p21-25 | manage-advanced | `/manage/site/advanced` | 1027 | 116 | 0 | — |

### device `tablet-768`｜25 页 / 5 组｜累计 44.4s｜溢出>4px：**0**

| 组 | 页面 | path | goto+网络空闲(ms) | 截图(ms) | 溢出(px) | 越界元素 |
|---|---|---|---|---|---|---|
| p1-5 | home | `/` | 2076 | 251 | 0 | — |
| p1-5 | libraries | `/libraries` | 1120 | 73 | 0 | — |
| p1-5 | history | `/history` | 1152 | 44 | 0 | — |
| p1-5 | settings-appearance | `/settings/appearance` | 1037 | 110 | 0 | — |
| p1-5 | settings-profile | `/settings/profile` | 1025 | 74 | 0 | — |
| p6-10 | manage-overview | `/manage` | 1074 | 274 | 0 | — |
| p6-10 | manage-media-items | `/manage/media/items` | 1086 | 235 | 0 | — |
| p6-10 | manage-media-add | `/manage/media/add` | 1046 | 171 | 0 | — |
| p6-10 | manage-libraries | `/manage/media/libraries` | 1055 | 124 | 0 | — |
| p6-10 | manage-mounts | `/manage/media/mounts` | 1067 | 137 | 0 | — |
| p11-15 | manage-probe-tasks | `/manage/media/probe-tasks` | 1104 | 68 | 0 | — |
| p11-15 | manage-naming-scrape | `/manage/media/naming-scrape` | 1105 | 629 | 0 | — |
| p11-15 | manage-collections | `/manage/collections` | 1051 | 85 | 0 | — |
| p11-15 | manage-task-center | `/manage/task-center` | 1075 | 213 | 0 | — |
| p11-15 | manage-registration-codes | `/manage/site/users/registration-codes` | 1048 | 60 | 0 | — |
| p16-20 | manage-users | `/manage/site/users/accounts` | 1130 | 102 | 0 | — |
| p16-20 | manage-role-templates | `/manage/site/users/role-templates` | 1048 | 232 | 0 | — |
| p16-20 | manage-sessions | `/manage/site/security/sessions` | 1092 | 438 | 0 | — |
| p16-20 | manage-audit-logs | `/manage/site/security/audit-logs` | 1117 | 139 | 0 | — |
| p16-20 | manage-runtime-logs | `/manage/site/security/runtime-logs` | 1437 | 10822 | 0 | — |
| p21-25 | manage-site-settings | `/manage/site/settings` | 1193 | 494 | 0 | — |
| p21-25 | manage-license | `/manage/site/license` | 1166 | 549 | 0 | — |
| p21-25 | manage-telegram | `/manage/site/telegram` | 1045 | 210 | 0 | — |
| p21-25 | manage-secrets | `/manage/site/secrets` | 1095 | 212 | 0 | — |
| p21-25 | manage-advanced | `/manage/site/advanced` | 1078 | 179 | 0 | — |

### device `desktop-1280`｜25 页 / 5 组｜累计 38.2s｜溢出>4px：**0**

| 组 | 页面 | path | goto+网络空闲(ms) | 截图(ms) | 溢出(px) | 越界元素 |
|---|---|---|---|---|---|---|
| p1-5 | home | `/` | 2149 | 368 | 0 | — |
| p1-5 | libraries | `/libraries` | 1063 | 62 | 0 | — |
| p1-5 | history | `/history` | 1045 | 55 | 0 | — |
| p1-5 | settings-appearance | `/settings/appearance` | 1073 | 143 | 0 | — |
| p1-5 | settings-profile | `/settings/profile` | 1000 | 201 | 0 | — |
| p6-10 | manage-overview | `/manage` | 1321 | 369 | 0 | — |
| p6-10 | manage-media-items | `/manage/media/items` | 1196 | 273 | 0 | — |
| p6-10 | manage-media-add | `/manage/media/add` | 1035 | 217 | 0 | — |
| p6-10 | manage-libraries | `/manage/media/libraries` | 1092 | 128 | 0 | — |
| p6-10 | manage-mounts | `/manage/media/mounts` | 1175 | 138 | 0 | — |
| p11-15 | manage-probe-tasks | `/manage/media/probe-tasks` | 1123 | 120 | 0 | — |
| p11-15 | manage-naming-scrape | `/manage/media/naming-scrape` | 1211 | 901 | 0 | — |
| p11-15 | manage-collections | `/manage/collections` | 1131 | 145 | 0 | — |
| p11-15 | manage-task-center | `/manage/task-center` | 1110 | 211 | 0 | — |
| p11-15 | manage-registration-codes | `/manage/site/users/registration-codes` | 1041 | 79 | 0 | — |
| p16-20 | manage-users | `/manage/site/users/accounts` | 1357 | 263 | 0 | — |
| p16-20 | manage-role-templates | `/manage/site/users/role-templates` | 1121 | 353 | 0 | — |
| p16-20 | manage-sessions | `/manage/site/security/sessions` | 1049 | 239 | 0 | — |
| p16-20 | manage-audit-logs | `/manage/site/security/audit-logs` | 1064 | 160 | 0 | — |
| p16-20 | manage-runtime-logs | `/manage/site/security/runtime-logs` | 1330 | 2616 | 0 | — |
| p21-25 | manage-site-settings | `/manage/site/settings` | 1166 | 376 | 0 | — |
| p21-25 | manage-license | `/manage/site/license` | 1072 | 690 | 0 | — |
| p21-25 | manage-telegram | `/manage/site/telegram` | 1102 | 260 | 0 | — |
| p21-25 | manage-secrets | `/manage/site/secrets` | 1081 | 313 | 0 | — |
| p21-25 | manage-advanced | `/manage/site/advanced` | 1085 | 345 | 0 | — |

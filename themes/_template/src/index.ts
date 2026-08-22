/**
 * 模板主题入口（新主题脚手架，CSS-only）
 *
 * 复制本目录起步新主题：
 * 1. 改 package.json name / manifest id（保持两者一致，host 注册表同步登记）；
 * 2. 写自己的 tokens.css（同 token 语言：变量名见 host defaults.css）；
 * 3. 纯外观——禁止引入 API client / mapper / query keys / 权限判断。
 */

import type { ThemeEntryModule, ThemeManifest } from '@fmby/v2-shared/theme';
import manifestRaw from '../theme.manifest.json';

const manifest = manifestRaw as unknown as ThemeManifest;
const theme: ThemeEntryModule = { manifest };

export default theme;

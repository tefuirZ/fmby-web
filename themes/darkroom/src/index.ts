/**
 * 暗房主题入口（CSS-only 主题）
 *
 * 主题 = 纯外观：tokens.css（palette token）+ aurora.css（环境光层），
 * 全部经 host ThemeProvider 动态 <link> 注入。不提供 React Skin，
 * 不含 API client / mapper / query keys / 权限判断 / 业务数据预加载。
 */

import type { ThemeEntryModule } from '@fmby/v2-shared/theme';
import manifest from '../theme.manifest.json';

const theme: ThemeEntryModule = { manifest };

export default theme;

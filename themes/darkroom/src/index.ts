/**
 * 暗房主题入口
 *
 * 主题 = 纯外观：tokens.css（palette token）+ aurora.css（环境光层）+
 * L3 页面域皮肤（WEB-C2：browse.library LibrarySkin——只接收 SkinProps，
 * 数据由 host viewmodel 注入，禁自行取数）。
 * 不含 API client / mapper / query keys / 权限判断 / 业务数据预加载。
 */

import type { ThemeEntryModule, ThemeManifest } from '@fmby/v2-shared/theme';
import { LibrarySkin } from './skins/LibrarySkin';
import manifestRaw from '../theme.manifest.json';

const manifest = manifestRaw as unknown as ThemeManifest;
const theme: ThemeEntryModule = {
  manifest,
  domainSkins: {
    'browse.library': LibrarySkin,
  },
};

export default theme;

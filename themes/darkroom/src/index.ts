/**
 * 暗房主题入口
 *
 * 主题 = 纯外观：tokens.css（palette token）+ aurora.css（环境光层）+
 * L3 页面域皮肤（WEB-C2：browse.library LibrarySkin——只接收 SkinProps，
 * 数据由 host viewmodel 注入，禁自行取数）。
 * 不含 API client / mapper / query keys / 权限判断 / 业务数据预加载。
 */

import type {
  ThemeCapabilitiesDeclaration,
  ThemeEntryModule,
  ThemeManifest,
} from '@fmby/v2-shared/theme';
import { LibrarySkin } from './skins/LibrarySkin';
import manifestRaw from '../theme.manifest.json';

const manifest = manifestRaw as unknown as ThemeManifest;

// 能力面声明（WEB-GOV ④ + WEB-PERF-01）：声明 browse.library 即必须覆盖四项
// 能力面；LibrarySkin 已实现（realtime subscribe / CSS 移动端 / forbidden 态 /
// Asia-Shanghai 时间派生），由 check-theme-parity 门禁强制。
const capabilities: ThemeCapabilitiesDeclaration = {
  global: ['realtime', 'mobile', 'timezone', 'authorization'],
};
const theme: ThemeEntryModule = {
  manifest,
  domainSkins: {
    'browse.library': LibrarySkin,
  },
  capabilities,
};


export default theme;

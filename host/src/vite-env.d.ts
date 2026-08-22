/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Feature flag: Pan115 图床工具页。设为 '1' 时启用，默认关闭。 */
  readonly VITE_FEATURE_PAN115_IMGHOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

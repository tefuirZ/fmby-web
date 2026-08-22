// 115 cookie_app 选项；不同 slot 互不挤占。
// alipaymini=支付宝小程序，默认；wechatmini=微信小程序；qandroid=安卓；115ios/115ipad=iOS；harmony=鸿蒙；tv=电视；web=网页
export const PAN115_COOKIE_APP_OPTIONS: Array<{ value: string; label: string; hint?: string }> = [
  { value: 'alipaymini', label: '支付宝小程序 (alipaymini)', hint: '默认；如你日常用支付宝小程序登录，请改其它项避免挤掉' },
  { value: 'wechatmini', label: '微信小程序 (wechatmini)' },
  { value: 'qandroid', label: '安卓客户端 (qandroid)' },
  { value: 'harmony', label: '鸿蒙 (harmony)' },
  { value: '115ios', label: 'iOS 客户端 (115ios)' },
  { value: '115ipad', label: 'iPad 客户端 (115ipad)' },
  { value: 'tv', label: 'TV 客户端 (tv)' },
  { value: 'web', label: '网页 (web)' },
];

export const PAN115_DEFAULT_COOKIE_APP = 'alipaymini';

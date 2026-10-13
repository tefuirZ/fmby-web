/**
 * 安装向导的**管理员口令策略**（fmby-v2 #640 用户裁定 ②③）。
 *
 * 裁定原文要点：
 *   - 强度：长度 ≥16，且含大写 / 小写 / 数字 / 特殊字符**四类**；
 *   - 拒常见弱口令；
 *   - 二次确认：两次一致才可通过；
 *   - 一键生成：16 位、四类字符各至少一个。
 *
 * ★诚实边界（别把本文件当成安全保证）：本页是 **UX 门槛**，
 *   V2 后端 `crates/fmby-v2-server/src/install_flow.rs` 的 `ApplyInstallRequest`
 *   当前**不校验强度**（admin.password 原样进 Argon2 哈希链）。后端补校验属
 *   fmby-v2 后端卡，本文件只负责「用户不必等后端失败才知道口令太弱」。
 *
 * 独立成纯函数而非塞进组件：宿主仓无 jsdom / testing-library（见
 * `install-wizard-honesty.test.ts` 顶部说明），纯函数才能被 node --test 真跑。
 */

/** 生成器与校验共同遵守的最小长度（裁定：16）。 */
export const PASSWORD_MIN_LENGTH = 16;

/** 生成器默认长度（裁定：16 位）。 */
export const GENERATED_PASSWORD_LENGTH = 16;

/**
 * 常见弱口令黑名单（小写比较）。
 *
 * 只收**长度 ≥PASSWORD_MIN_LENGTH 仍会被用**的那些（长度不足的已被长度规则拦下，
 * 列进来只会制造「同一口令两个失败原因」的噪音）。
 */
export const WEAK_PASSWORDS: readonly string[] = [
  'passwordpassword',
  'password12345678',
  'passwordadmin123',
  'adminadminadmin123',
  'administrator123',
  'qwertyuiop123456',
  'qwerty1234567890',
  'iloveyou12345678',
  'letmein123456789',
  'welcomewelcome12',
  'trustno123456789',
  'football12345678',
  'baseball12345678',
  'monkey1234567890',
  'sunshine12345678',
  'princess12345678',
  'changeme12345678',
  'fmbyadmin1234567',
];

const UPPER = /[A-Z]/;
const LOWER = /[a-z]/;
const DIGIT = /[0-9]/;
/** 特殊字符：非字母、非数字、非空白（覆盖 ASCII 符号与 CJK 全角符号）。 */
const SPECIAL = /[^A-Za-z0-9\s]/;

/** 单条强度判据（用于向用户逐条展示，而不是只给一个「不合法」）。 */
export interface PasswordRule {
  key: 'length' | 'upper' | 'lower' | 'digit' | 'special' | 'common';
  label: string;
  passed: boolean;
}

/** 评估结果：ok 为 false 时 failures 是**全部**未通过项（逐条提示，不短路）。 */
export interface PasswordAssessment {
  ok: boolean;
  rules: PasswordRule[];
  /** 未通过项的中文标签，按规则顺序（可直接渲染成列表）。 */
  failures: string[];
}

/**
 * 逐条评估口令强度。**不抛异常、不 trim**：口令里的空格是合法字符。
 */
export function assessPassword(password: string): PasswordAssessment {
  const rules: PasswordRule[] = [
    {
      key: 'length',
      label: `长度 ≥ ${PASSWORD_MIN_LENGTH}`,
      passed: password.length >= PASSWORD_MIN_LENGTH,
    },
    { key: 'upper', label: '含大写字母', passed: UPPER.test(password) },
    { key: 'lower', label: '含小写字母', passed: LOWER.test(password) },
    { key: 'digit', label: '含数字', passed: DIGIT.test(password) },
    { key: 'special', label: '含特殊字符', passed: SPECIAL.test(password) },
    {
      key: 'common',
      label: '不是常见弱口令',
      passed: !WEAK_PASSWORDS.includes(password.toLowerCase()),
    },
  ];
  const failures = rules.filter((r) => !r.passed).map((r) => r.label);
  return { ok: failures.length === 0, rules, failures };
}

/** 快捷判定：口令是否满足全部强度要求。 */
export function isStrongPassword(password: string): boolean {
  return assessPassword(password).ok;
}

/**
 * 二次确认判据（裁定 ②）：两次一致**且**本身强度达标。
 * 返回 null 表示通过；否则返回可直接展示的中文原因。
 */
export function confirmPasswordProblem(
  password: string,
  confirm: string,
): string | null {
  if (confirm.length === 0) return '请再次输入口令以确认';
  if (password !== confirm) return '两次输入的口令不一致';
  if (!isStrongPassword(password)) {
    return `口令未达强度要求：${assessPassword(password).failures.join('、')}`;
  }
  return null;
}

const CHARSETS = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ', // 去掉 I/O，降低肉眼误抄
  lower: 'abcdefghijkmnopqrstuvwxyz', // 去掉 l
  digit: '23456789', // 去掉 0/1
  special: '!@#$%^&*()-_=+[]{}<>?',
} as const;

function randomInt(max: number): number {
  // 拒绝采样，避免取模偏置。
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

function pick(charset: string): string {
  return charset[randomInt(charset.length)];
}

/**
 * 一键生成 16 位强随机口令（裁定 ③）：**四类字符各至少一个**，
 * 其余位从四类并集中均匀取，再 Fisher–Yates 洗牌（否则四类必在最前 4 位）。
 *
 * 随机源：`crypto.getRandomValues`（CSPRNG）。不引入依赖。
 */
export function generateStrongPassword(
  length: number = GENERATED_PASSWORD_LENGTH,
): string {
  const pool = [
    ...CHARSETS.upper,
    ...CHARSETS.lower,
    ...CHARSETS.digit,
    ...CHARSETS.special,
  ];
  // 四类各保底一位；长度不足 4 时无法同时满足四类 ⇒ 退到 4。
  const total = Math.max(length, 4);
  const chars = [
    pick(CHARSETS.upper),
    pick(CHARSETS.lower),
    pick(CHARSETS.digit),
    pick(CHARSETS.special),
  ];
  while (chars.length < total) chars.push(pick(pool));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.slice(0, total).join('');
}
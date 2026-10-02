/**
 * 挂载配置六字段描述符（FE-MOUNT-CONFIG-UI，R2.3–R2.6）。
 *
 * 纯函数 .ts（node:test 可直接断言）；MountConfigSection.tsx 消费同一描述符
 * 渲染输入面 ⇒ label/formKey/取值不可能与测试、与表单状态三方漂移。
 *
 * 后端真源（crates/fmby-v2-http/src/dto/manage/mount.rs，R2.3–R2.6 已实装）：
 * - note：备注名（Some=替换；缺省=保留存量）
 * - rate_config：速率配置 JSON（null=清除）
 * - visibility_rule：可见性规则 JSON（缺省/{} = 全可见、排除优先）
 * - sidecar_nfo / sidecar_subtitle / sidecar_poster：旁路开关
 */

import type { MountFormState } from './types';

export interface MountConfigTextField {
  kind: 'text';
  /** formState 键（回填/写回同一键，DATASOURCE-CRUD-BACKFILL-UI 口径）。 */
  formKey: 'note' | 'rateConfigText' | 'visibilityRuleText';
  label: string;
  /** 输入面提示（说清语义，不做魔法解析）。 */
  placeholder: string;
  description: string;
  /** 文本值读取（回填可见性断言用）。 */
  value: (form: MountFormState) => string;
  /** 校验错误绑定键（MountFormErrors）；note 无校验故可缺省。 */
  errorKey?: 'rateConfig' | 'visibilityRule';
}

export interface MountConfigToggleField {
  kind: 'toggle';
  formKey: 'sidecarNfo' | 'sidecarSubtitle' | 'sidecarPoster';
  label: string;
  description: string;
  value: (form: MountFormState) => boolean;
  errorKey?: undefined;
}

export type MountConfigField = MountConfigTextField | MountConfigToggleField;

export const MOUNT_CONFIG_FIELDS: MountConfigField[] = [
  {
    kind: 'text',
    formKey: 'note',
    label: '备注',
    placeholder: '例如：主账号、限速演示源',
    description: '给这条数据源起个内部备注名，只有管理页可见。',
    value: (form) => form.note,
  },
  {
    kind: 'text',
    formKey: 'rateConfigText',
    label: '速率配置',
    placeholder: '{"qps":2}',
    description: 'JSON 格式的请求速率限制；留空表示清除速率配置。',
    value: (form) => form.rateConfigText,
    errorKey: 'rateConfig',
  },
  {
    kind: 'text',
    formKey: 'visibilityRuleText',
    label: '可见性规则',
    placeholder: '{"exclude":["vip"]}',
    description: 'JSON 格式的用户组可见性规则；留空或 {} 表示全部可见。',
    value: (form) => form.visibilityRuleText,
    errorKey: 'visibilityRule',
  },
  {
    kind: 'toggle',
    formKey: 'sidecarNfo',
    label: 'NFO',
    description: '扫描时读取旁路 NFO 元数据文件。',
    value: (form) => form.sidecarNfo,
  },
  {
    kind: 'toggle',
    formKey: 'sidecarSubtitle',
    label: '字幕',
    description: '扫描时读取旁路字幕文件。',
    value: (form) => form.sidecarSubtitle,
  },
  {
    kind: 'toggle',
    formKey: 'sidecarPoster',
    label: '海报',
    description: '扫描时读取旁路海报图片。',
    value: (form) => form.sidecarPoster,
  },
];

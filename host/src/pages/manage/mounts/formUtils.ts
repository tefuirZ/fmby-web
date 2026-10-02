/**
 * mounts 表单/映射/校验/展示工具桶（FE-MOUNT-AGGREGATE 拆分）。
 *
 * 兼容入口：本文件只做 re-export，保持原有公共导出与 import 路径不变；
 * 实现按职责拆到同目录子模块（每个 ≤400 行，守 component-size 棘轮）：
 * - providerCapabilities：provider 分类 / 能力默认值 / provider-keyed 文案
 * - rootPath：根路径归一与路径穿越防线
 * - mountConfig：config_json / 密封凭据映射 + 文本 JSON 解析
 * - mountFormState：表单初始化/回填 + Create/Update payload
 * - mountValidation：表单/目录浏览校验 + 鉴权方式切换影响
 * - mountPresentation：健康/抽屉文案、引用/删除摘要、遮蔽与凭据引导
 */

export * from './providerCapabilities';
export * from './rootPath';
export * from './mountConfig';
export * from './mountFormState';
export * from './mountValidation';
export * from './mountPresentation';

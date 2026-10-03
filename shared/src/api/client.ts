/**
 * HTTP 客户端统一出口（FE-CLIENT-SPLIT 拆分后保留路径兼容 barrel）。
 *
 * 实现已按职责拆至 `client/`（types / core / index 三桶）；本文件仅为**路径兼容**
 * ——既有相对导入 `./client` 的消费方（若有）零改动。新代码请引 `./client`。
 */
export * from './client/index';

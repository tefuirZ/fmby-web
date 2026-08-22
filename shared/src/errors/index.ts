/**
 * 前端错误模型（对应后端 AppError 分类，docs/09 §1 errors）
 *
 * - error：ApiError 判别与形状
 * - messages：面向用户的错误文案提取
 * - authFailure：会话失效事件总线（shared 发出，host 订阅后跳登录/提示）
 */

export * from './error';
export * from './messages';
export * from './authFailure';

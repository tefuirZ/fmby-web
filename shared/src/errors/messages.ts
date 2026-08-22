import { isApiError } from '@fmby/v2-shared/types';

/** 从任意 error 中提取用户可读的错误信息。 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '请求失败，请稍后重试。';
}

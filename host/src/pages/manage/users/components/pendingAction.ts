/** 用户页待确认动作的文案映射（V1F 拆分：ManageUsersPage → 子组件模块）。 */

import type { PendingUserAction } from '../types';
import { getNextUserAction, getRegistrationReviewAction } from '../formUtils';

export function getPendingActionKey(action: PendingUserAction | null) {
  if (!action) return 'update-user-status';
  if (action.kind === 'registration-review') {
    return getRegistrationReviewAction(action.action).actionKey;
  }
  if (action.kind === 'login-risk-reset') return 'reset-user-login-risk';
  return 'update-user-status';
}

export function getPendingActionLabel(action: PendingUserAction | null) {
  if (!action) return '确认';
  if (action.kind === 'registration-review') {
    return getRegistrationReviewAction(action.action).label;
  }
  if (action.kind === 'login-risk-reset') return '解除账号登录风控';
  return getNextUserAction(action.user).label;
}

export function getPendingActionImpact(action: PendingUserAction | null) {
  if (!action) return undefined;
  if (action.kind === 'registration-review') {
    return getRegistrationReviewAction(action.action).impact;
  }
  if (action.kind === 'login-risk-reset') {
    return [
      '只解除该用户名当前失败登录窗口内的临时风控影响。',
      '不会删除失败登录、限流或锁定审计记录。',
      '不会修改账号状态、密码、角色或来源授权。',
    ];
  }
  return getNextUserAction(action.user).impact;
}

export function getPendingActionTitle(action: PendingUserAction | null) {
  if (!action) return '';
  const username = action.user.displayName || action.user.username;
  return `${getPendingActionLabel(action)}：${username}`;
}

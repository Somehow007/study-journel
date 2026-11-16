/**
 * 手帐会话 —— Go /api/v1/auth/*，HttpOnly Cookie（sj_session）。
 * 前端不持有 token；登录态 = /auth/me 能否解析出 user。
 */
import { apiFetch, ApiError } from './http';
import type { User } from './types/api';

let cachedUser: User | null = null;

/** GET /auth/me；401 → null（未登录/会话过期），其他错误抛出 */
export async function fetchMe(): Promise<User | null> {
  try {
    const user = await apiFetch<User>('/auth/me');
    cachedUser = user;
    return user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      cachedUser = null;
      return null;
    }
    throw err;
  }
}

/** POST /auth/login {username,password} → user；成功后由调用方刷新页面/查询 */
export async function login(username: string, password: string): Promise<User> {
  const user = await apiFetch<User>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  cachedUser = user;
  return user;
}

/** POST /auth/password {oldPassword,newPassword}；成功后其他设备会话失效 */
export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await apiFetch<unknown>('/auth/password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

/** POST /auth/logout 清服务端 session，然后回手帐入口（App 重新判定登录态） */
export async function logout(): Promise<void> {
  try {
    await apiFetch<unknown>('/auth/logout', { method: 'POST' });
  } catch {
    // 服务端清理失败也照常回登录页——Cookie 可能已失效
  } finally {
    cachedUser = null;
    window.location.assign(import.meta.env.BASE_URL || '/journal/');
  }
}

/** 当前会话用户（fetchMe/login 成功后有值）；同步场景用 */
export function getSessionUser(): User | null {
  return cachedUser;
}

export function getDisplayName(): string | null {
  return cachedUser?.username ?? null;
}

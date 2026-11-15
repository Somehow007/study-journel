import { getToken, readJsonStorage } from './http';

export interface JwtPayload {
  username?: string;
  role?: string;
  userId?: number | string;
}

export function decodeAccessToken(): JwtPayload | null {
  const token = getToken();
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(padded)) as JwtPayload;
  } catch {
    return null;
  }
}

function storedRole(): string | null {
  return readJsonStorage<string>('mysite_user_role');
}

/** ADMIN（含旧 DEVELOPER）可进手帐；未知角色返回 null，交给接口 403 判定 */
export function isJournalAdmin(): boolean | null {
  const role = decodeAccessToken()?.role ?? storedRole();
  if (!role) return null;
  return role === 'ADMIN' || role === 'DEVELOPER';
}

export function getDisplayName(): string | null {
  return decodeAccessToken()?.username ?? null;
}

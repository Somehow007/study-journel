/**
 * 手帐 HTTP 层：同源请求博客后端的 /api/journal 接口。
 *
 * 登录态复用博客 JWT：博客前端把 access / refresh token 存在
 * localStorage['mysite_access_token'] / ['mysite_refresh_token']（JSON 字符串）。
 * 响应统一为博客的 Result<T> 包装：{ code: '0', message, data }，这里解包后返回 data。
 */

const ACCESS_KEY = 'mysite_access_token';
const REFRESH_KEY = 'mysite_refresh_token';
const API_PREFIX = '/api/journal';

export const FORBIDDEN_EVENT = 'journal:forbidden';

/** 读取博客 storage.ts 同款 JSON 字符串 */
export function readJsonStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJsonStorage(key: string, value: string) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function setTokens(accessToken: string, refreshToken?: string) {
  writeJsonStorage(ACCESS_KEY, accessToken);
  if (refreshToken) writeJsonStorage(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

/** 读取博客登录 token */
export function getToken(): string | null {
  try {
    const raw = localStorage.getItem(ACCESS_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      return typeof parsed === 'string' && parsed ? parsed : raw;
    } catch {
      return raw;
    }
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiResult<T> {
  code: string;
  message?: string;
  data: T;
}

interface FetchOptions {
  method?: 'GET' | 'PUT' | 'POST' | 'DELETE';
  body?: string;
}

interface RefreshResp {
  accessToken?: string;
  refreshToken?: string;
}

/** 手帐独立开发端口上登录（5173 博客与 5174 手帐不同源，token 不共享） */
export async function loginWithPassword(username: string, password: string): Promise<void> {
  const res = await fetch('/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  let payload: ApiResult<RefreshResp> | null = null;
  try {
    payload = (await res.json()) as ApiResult<RefreshResp>;
  } catch {
    payload = null;
  }
  if (!res.ok || !payload || payload.code !== '0' || !payload.data?.accessToken) {
    throw new ApiError(payload?.message || '登录失败', res.status, payload?.code);
  }
  setTokens(payload.data.accessToken, payload.data.refreshToken);
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = readJsonStorage<unknown>(REFRESH_KEY);
    const token = typeof refreshToken === 'string' ? refreshToken : null;
    if (!token) return false;
    try {
      const res = await fetch('/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });
      if (!res.ok) return false;
      const payload = (await res.json()) as ApiResult<RefreshResp>;
      if (payload.code !== '0' || !payload.data?.accessToken) return false;
      writeJsonStorage(ACCESS_KEY, payload.data.accessToken);
      if (payload.data.refreshToken) {
        writeJsonStorage(REFRESH_KEY, payload.data.refreshToken);
      }
      return true;
    } catch {
      return false;
    }
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/** 生产走博客 /login；本地 Vite 不能跳 /login（base 是 /journal/），清 token 后回手帐登录页 */
export function goLogin() {
  clearTokens();
  const { protocol, hostname, port } = window.location;
  if (port === '5174' || port === '5175') {
    window.location.assign(`${protocol}//${hostname}:${port}/journal/`);
    return;
  }
  window.location.assign('/login');
}

/**
 * 发起请求并解包 Result<T>。
 * - 401：先 POST /v1/auth/refresh，成功则重试原请求；失败跳转登录页
 * - 403：派发 forbidden 事件（非管理员）
 * - 写操作（非 GET）遇到网络错误或 5xx：自动重试一次
 */
export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';

  const doFetch = async (): Promise<Response> => {
    const token = getToken();
    return fetch(`${API_PREFIX}${path}`, {
      method,
      headers: {
        ...(options.body != null ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body,
    });
  };

  const isWrite = method !== 'GET';
  let lastError: Error | null = null;
  let refreshed = false;

  for (let attempt = 0; attempt <= (isWrite ? 1 : 0); attempt++) {
    let res: Response;
    try {
      res = await doFetch();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 1 && isWrite) continue;
      throw new ApiError(`网络错误：${lastError.message}`, 0);
    }

    if (res.status === 401 && !refreshed) {
      refreshed = true;
      const ok = await refreshAccessToken();
      if (ok) {
        try {
          res = await doFetch();
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          throw new ApiError(`网络错误：${lastError.message}`, 0);
        }
      }
    }

    if (res.status === 401) {
      goLogin();
      throw new ApiError('未登录或登录已过期', 401);
    }

    if (res.status === 403) {
      window.dispatchEvent(new Event(FORBIDDEN_EVENT));
      throw new ApiError('没有访问权限', 403, 'FORBIDDEN');
    }

    let payload: ApiResult<T> | null = null;
    try {
      payload = (await res.json()) as ApiResult<T>;
    } catch {
      payload = null;
    }

    if (res.ok && payload && payload.code === '0') {
      return payload.data;
    }

    const message = payload?.message || `请求失败（HTTP ${res.status}）`;
    if (res.status >= 500 && attempt < 1 && isWrite) {
      lastError = new ApiError(message, res.status, payload?.code);
      continue;
    }
    throw new ApiError(message, res.status, payload?.code ?? undefined);
  }

  throw lastError ?? new ApiError('请求失败', 0);
}

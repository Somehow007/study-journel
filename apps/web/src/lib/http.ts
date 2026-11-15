/**
 * 手帐 HTTP 层 —— Go 后端 /api/v1，Cookie 会话（sj_session，HttpOnly）。
 *
 * - API_BASE：VITE_API_BASE 环境变量；缺省 '/api'（vite dev 代理 → :8090）。
 *   生产构建设 VITE_API_BASE=/journal/api（nginx /journal/api/ → Go /api/）。
 * - 认证：credentials:'include' 携带 Cookie；JS 不读写 token。
 * - 响应包络：{ code:'0', data }；失败 { code, message } → ApiError。
 * - 401（业务接口）：POST /auth/logout 清服务端 session 后回登录页（去重）。
 *   /auth/* 自身不触发跳转（登录页要展示错误，/auth/me 由调用方判定）。
 */

const API_BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? '/api').replace(/\/+$/, '');

export const API_PREFIX = `${API_BASE}/v1`;

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
  data?: T;
}

interface FetchOptions {
  method?: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE';
  body?: string;
}

let unauthorizedRedirecting = false;

/** 会话失效：清服务端 Cookie 后整页回手帐入口（App 会按 /auth/me 决定渲染登录页） */
function handleUnauthorized() {
  if (unauthorizedRedirecting) return;
  unauthorizedRedirecting = true;
  fetch(`${API_PREFIX}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
    .catch(() => {})
    .finally(() => {
      window.location.assign(import.meta.env.BASE_URL || '/journal/');
    });
}

/**
 * 发起请求并解包 { code, message, data }。
 * 返回 data；非 '0' code / HTTP 错误抛 ApiError（message 取服务端 message）。
 */
export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const res = await fetch(`${API_PREFIX}${path}`, {
    method,
    credentials: 'include',
    headers: options.body != null ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body,
  });

  if (res.status === 401 && !path.startsWith('/auth/')) {
    handleUnauthorized();
    throw new ApiError('登录已过期，请重新登录', 401, 'UNAUTHORIZED');
  }

  let payload: ApiResult<T> | null = null;
  try {
    payload = (await res.json()) as ApiResult<T>;
  } catch {
    payload = null;
  }

  if (payload && typeof payload.code === 'string') {
    if (payload.code === '0') {
      return payload.data as T;
    }
    throw new ApiError(payload.message || '请求失败', res.status, payload.code);
  }

  if (!res.ok) {
    throw new ApiError(`请求失败（HTTP ${res.status}）`, res.status);
  }
  return payload as unknown as T;
}

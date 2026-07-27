/**
 * 手帐 HTTP 层：同源请求博客后端的 /api/journal 接口。
 *
 * 登录态复用博客 JWT：博客前端把 access token 存在 localStorage['mysite_access_token']
 * （JSON 字符串）。手帐与博客同源（somehow007.top），直接读取并附 Authorization 头。
 * 响应统一为博客的 Result<T> 包装：{ code: '0', message, data }，这里解包后返回 data。
 */

const TOKEN_KEY = 'mysite_access_token';
const API_PREFIX = '/api/journal';

/** 读取博客登录 token（与博客 mysite-frontend/src/utils/storage.ts 的存储格式一致） */
export function getToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === 'string' ? parsed : raw;
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

/**
 * 发起请求并解包 Result<T>。
 * - 401：登录态缺失/过期，跳转网站登录页
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

  for (let attempt = 0; attempt <= (isWrite ? 1 : 0); attempt++) {
    let res: Response;
    try {
      res = await doFetch();
    } catch (err) {
      // 网络层错误（断网等）：写操作重试一次，读操作直接抛
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 1 && isWrite) continue;
      throw new ApiError(`网络错误：${lastError.message}`, 0);
    }

    if (res.status === 401) {
      // 未登录或登录过期：回网站登录页（同源）
      window.location.href = '/login';
      throw new ApiError('未登录或登录已过期', 401);
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
    // 服务端 5xx：写操作重试一次
    if (res.status >= 500 && attempt < 1 && isWrite) {
      lastError = new ApiError(message, res.status, payload?.code);
      continue;
    }
    throw new ApiError(message, res.status, payload?.code ?? undefined);
  }

  throw lastError ?? new ApiError('请求失败', 0);
}

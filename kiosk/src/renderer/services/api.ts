/**
 * API client wrapper — tự attach Bearer token từ sessionUserStore.
 *
 * Dùng:
 *   const data = await api.get<Result>('/sessions/me');
 *   await api.post('/documents/upload', formData);
 *
 * Handle 401 tự động: clear session → navigate /login (nếu muốn).
 * Tạm thời chỉ throw ApiError để caller tự quyết định UX.
 */
import { useSessionUserStore } from '@store/sessionUserStore';

const SERVER_URL = (import.meta.env.RENDERER_VITE_SERVER_URL as string | undefined)
  ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string,
  ) {
    super(message ?? `HTTP ${status}`);
  }
}

interface RequestOptions {
  /** Bỏ qua attach Authorization header (cho endpoint public như /sessions/create) */
  skipAuth?: boolean;
  signal?: AbortSignal;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (!opts.skipAuth) {
    const token = useSessionUserStore.getState().sessionToken;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
    // Content-Type tự động do browser set với boundary multipart
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${SERVER_URL}${path}`, {
    method,
    headers,
    body: payload,
    signal: opts.signal,
  });

  if (!res.ok) {
    let errBody: unknown = null;
    try {
      errBody = await res.json();
    } catch {
      errBody = await res.text().catch(() => null);
    }
    throw new ApiError(res.status, errBody);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return (await res.json()) as T;
  return (await res.blob()) as unknown as T;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('POST', path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('PATCH', path, body, opts),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, undefined, opts),
};

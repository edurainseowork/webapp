import { auth } from './firebase';

// Edurain backend (tem_application/Backend). Same API the mobile app uses.
export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(public status: number, message: string, public retryAfter?: number) {
    super(message);
  }
}

let lastSyncHash = '';

/**
 * Calls /api/<path>. Sends the signed-in user's Firebase ID token when there is one.
 * Implements Exponential Backoff with Jitter on HTTP 429 Too Many Requests & HTTP 503 (ShedError / backpressure).
 */
export async function apiFetch<T = any>(
  path: string,
  init: { method?: string; body?: unknown; retries?: number; fresh?: boolean; signal?: AbortSignal } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = await auth.currentUser?.getIdToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';

  const maxRetries = init.retries ?? 3;
  let delayMs = 1000;
  let res!: Response;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      res = await fetch(`${API_BASE_URL}/api${path}`, {
        method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
        headers,
        body: init.body !== undefined ? (typeof init.body === 'string' ? init.body : JSON.stringify(init.body)) : undefined,
        cache: init.fresh ? 'reload' : undefined, // skip the browser cache once, then store the new answer
        signal: init.signal,
      });

      // Piggybacked real-time sync notification
      const xSync = res.headers.get('X-Sync');
      if (xSync && xSync !== lastSyncHash) {
        lastSyncHash = xSync;
        void import('./catalogSync').then((m) => m.syncNow()).catch(() => {});
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
      throw new ApiError(0, 'Could not reach the server. Check your internet connection and try again.');
    }

    if ((res.status !== 429 && res.status !== 503) || attempt === maxRetries) break;

    const retryHeaderSec = Number(res.headers.get('Retry-After'));
    const waitMs =
      Number.isFinite(retryHeaderSec) && retryHeaderSec > 0 && retryHeaderSec <= 5
        ? retryHeaderSec * 1000
        : delayMs + Math.random() * 500;

    await new Promise((r) => setTimeout(r, waitMs));
    delayMs *= 2;
  }

  // Auto-refresh token silently and retry once if token expired (HTTP 401)
  if (res.status === 401 && auth.currentUser) {
    try {
      const freshToken = await auth.currentUser.getIdToken(true);
      if (freshToken) {
        headers.Authorization = `Bearer ${freshToken}`;
        res = await fetch(`${API_BASE_URL}/api${path}`, {
          method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
          headers,
          body: init.body !== undefined ? (typeof init.body === 'string' ? init.body : JSON.stringify(init.body)) : undefined,
          signal: init.signal,
        });
      }
    } catch {}
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const retryAfter = Number(res.headers.get('Retry-After')) || data.retryAfter;
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`, retryAfter);
  }
  return data as T;
}

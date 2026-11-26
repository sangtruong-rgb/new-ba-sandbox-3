// ApiClient: JSON over fetch with cookies; failures become ApiError.

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const TIMEOUT_MS = 15_000;

type Hooks = { hasUser(): boolean; onUnauthenticated(): void };
let hooks: Hooks = { hasUser: () => false, onUnauthenticated: () => {} };

/** The session tells the client whether a user is in it, and what to do on a 401 then. */
export function configureApi(next: Hooks): void {
  hooks = next;
}

export async function api<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const withUser = hooks.hasUser();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let status: number;
  let text: string;
  try {
    const res = await fetch(path, {
      method,
      credentials: 'include',
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    status = res.status;
    text = await res.text();
  } catch {
    throw new ApiError(0, 'network', `${method} ${path}: no answer`);
  } finally {
    clearTimeout(timer);
  }

  if (status < 200 || status > 299) {
    let code = `http_${status}`;
    try {
      const parsed = JSON.parse(text) as { error?: unknown };
      if (parsed && typeof parsed.error === 'string') code = parsed.error;
    } catch {
      // not JSON: keep http_<status>
    }
    if (status === 401 && withUser) hooks.onUnauthenticated();
    throw new ApiError(status, code, `${method} ${path}: ${status} ${code}`);
  }
  if (status === 204 || text.trim() === '') return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(status, `http_${status}`, `${method} ${path}: the answer is not JSON`);
  }
}

// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { api } from './api';

type Call = { url: string; init: RequestInit };

function serve(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const call = { url, init };
      calls.push(call);
      return Promise.resolve(respond(call));
    }),
  );
  return calls;
}

async function caught(p: Promise<unknown>): Promise<Record<string, unknown>> {
  try {
    await p;
  } catch (e) {
    return e as Record<string, unknown>;
  }
  throw new Error('expected the request to throw');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('api', () => {
  test('C4 · a 2xx JSON answer is returned parsed', async () => {
    serve(() => new Response(JSON.stringify([{ id: 'a', title: 'Rửa xe' }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await expect(api('GET', '/api/tasks')).resolves.toEqual([{ id: 'a', title: 'Rửa xe' }]);
  });

  test('C4 · the method, the path and a JSON body are sent', async () => {
    const calls = serve(() => new Response(JSON.stringify({ ok: true }), { status: 201 }));
    await api('POST', '/api/tasks', { title: 'Mua thuốc', dueAt: null });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/api\/tasks$/);
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ title: 'Mua thuốc', dueAt: null });
    const headers = new Headers(calls[0].init.headers);
    expect(headers.get('content-type')).toMatch(/application\/json/);
  });

  test('C4 · a 204 gives undefined', async () => {
    serve(() => new Response(null, { status: 204 }));
    await expect(api('DELETE', '/api/tasks/a')).resolves.toBeUndefined();
  });

  test('C4 · an empty 200 body gives undefined', async () => {
    serve(() => new Response('', { status: 200 }));
    await expect(api('PATCH', '/api/tasks/a', { done: true })).resolves.toBeUndefined();
  });

  test("C4 · a non-2xx JSON answer throws ApiError with status and the body's error as code", async () => {
    serve(() => new Response(JSON.stringify({ error: 'email_taken' }), { status: 409, headers: { 'Content-Type': 'application/json' } }));
    const err = await caught(api('POST', '/api/auth/sign-up', { email: 'a@b.c', password: 'x' }));
    expect(err.status).toBe(409);
    expect(err.code).toBe('email_taken');
    expect(typeof err.message).toBe('string');
  });

  test("C4 · a non-2xx answer that is not JSON throws code 'http_<status>'", async () => {
    serve(() => new Response('<html>Bad gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }));
    const err = await caught(api('GET', '/api/tasks'));
    expect(err.status).toBe(502);
    expect(err.code).toBe('http_502');
  });

  test("C4 · no answer at all throws code 'network'", async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    const err = await caught(api('GET', '/api/tasks'));
    expect(err.code).toBe('network');
  });

  test("C4 · a 401 with no user in the session throws and does not navigate", async () => {
    serve(() => new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 }));
    const before = window.location.href;
    const err = await caught(api('GET', '/api/me'));
    expect(err.status).toBe(401);
    expect(err.code).toBe('unauthenticated');
    expect(window.location.href).toBe(before);
  });

  test("C4 · a request with no answer within 15 seconds is aborted and throws code 'network'", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: RequestInfo | URL, init: RequestInit = {}) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
          }),
      ),
    );
    const started = Date.now();
    const err = await caught(api('GET', '/api/tasks'));
    const elapsed = Date.now() - started;
    expect(err.code).toBe('network');
    expect(elapsed).toBeGreaterThanOrEqual(14_900);
    expect(elapsed).toBeLessThan(17_000);
  }, 25_000);
});

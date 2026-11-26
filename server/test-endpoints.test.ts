// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp } from './app';
import { captureDeps, json, sidCookie, ISO_MS } from './__tests__/probe';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('server TestEndpoints', () => {
  test('C3 · with NODE_ENV=test, POST /api/test/session creates the user with password "test-password-1" and starts a session', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const probe = captureDeps();
    const app = createApp({ databasePath: ':memory:', features: [probe.feature] });
    const res = await app.request('/api/test/session', json({ email: 'thu.ha@example.com' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; email: string };
    expect(Object.keys(body).sort()).toEqual(['email', 'id']);
    expect(body.email).toBe('thu.ha@example.com');

    const cookie = sidCookie(res);
    expect(cookie).not.toBeNull();
    const me = await app.request('/api/me', { headers: { Cookie: cookie! } });
    expect(await me.json()).toEqual(body);

    expect(probe.deps().users.verify('thu.ha@example.com', 'test-password-1')).toEqual(body);
  });

  test('C3 · POST /api/test/session for an existing email signs that same user in', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const app = createApp({ databasePath: ':memory:', features: [] });
    const first = (await (await app.request('/api/test/session', json({ email: 'an@example.com' }))).json()) as { id: string };
    const second = (await (await app.request('/api/test/session', json({ email: 'an@example.com' }))).json()) as { id: string };
    expect(second.id).toBe(first.id);
  });

  test("C3 · with NODE_ENV=test, POST /api/test/tasks creates the tasks for the session's user and answers Task[]", async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const app = createApp({ databasePath: ':memory:', features: [] });
    const cookie = sidCookie(await app.request('/api/test/session', json({ email: 'an@example.com' })))!;
    const res = await app.request(
      '/api/test/tasks',
      json(
        {
          tasks: [
            { title: 'Rửa xe', done: true, dueAt: '2026-11-23T00:00:00.000Z', createdAt: '2026-11-18T02:00:00.000Z' },
            { title: 'Học xong bài 7 tiếng Nhật' },
          ],
        },
        cookie,
      ),
    );
    expect(res.status).toBe(200);
    const created = (await res.json()) as Array<Record<string, unknown>>;
    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({
      title: 'Rửa xe',
      done: true,
      dueAt: '2026-11-23T00:00:00.000Z',
      createdAt: '2026-11-18T02:00:00.000Z',
    });
    expect(created[1]).toMatchObject({ title: 'Học xong bài 7 tiếng Nhật', done: false, dueAt: null });
    expect(created[1].createdAt).toMatch(ISO_MS);

    const listed = (await (await app.request('/api/tasks', { headers: { Cookie: cookie } })).json()) as Array<{ id: string }>;
    expect(listed.map((t) => t.id).sort()).toEqual(created.map((t) => t.id as string).sort());
  });

  test('C3 · without NODE_ENV=test both test endpoints answer 404', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const app = createApp({ databasePath: ':memory:', features: [] });
    const session = await app.request('/api/test/session', json({ email: 'an@example.com' }));
    expect(session.status).toBe(404);
    expect(sidCookie(session)).toBeNull();
    const tasks = await app.request('/api/test/tasks', json({ tasks: [{ title: 'x' }] }));
    expect(tasks.status).toBe(404);
  });

  test('C3 · with NODE_ENV=development the test endpoints answer 404 too', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const app = createApp({ databasePath: ':memory:', features: [] });
    expect((await app.request('/api/test/session', json({ email: 'an@example.com' }))).status).toBe(404);
  });
});

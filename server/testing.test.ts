// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { testApp } from './testing';
import { captureDeps } from './__tests__/probe';

const DAY = 24 * 60 * 60 * 1000;

describe('server/testing', () => {
  test('C3 · testApp().signIn(email) creates the user and returns a Cookie header value for app.request()', async () => {
    const t = testApp();
    const cookie = await t.signIn('thu.ha@example.com');
    expect(typeof cookie).toBe('string');
    const res = await t.app.request('/api/me', { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { email: string }).email).toBe('thu.ha@example.com');
  });

  test('C3 · signIn uses the password "test-password-1" and reuses an existing user', async () => {
    const probe = captureDeps();
    const t = testApp({ features: [probe.feature] });
    const a = await t.signIn('an@example.com');
    const b = await t.signIn('an@example.com');
    const meA = await (await t.app.request('/api/me', { headers: { Cookie: a } })).json();
    const meB = await (await t.app.request('/api/me', { headers: { Cookie: b } })).json();
    expect(meB).toEqual(meA);
    expect(probe.deps().users.verify('an@example.com', 'test-password-1')).toEqual(meA);
  });

  test('C3 · signIn() without an email still signs a user in', async () => {
    const t = testApp();
    const cookie = await t.signIn();
    const res = await t.app.request('/api/me', { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
  });

  test("C3 · seedTasks creates tasks for the cookie's user and returns them", async () => {
    const t = testApp();
    const cookie = await t.signIn('an@example.com');
    const seeded = await t.seedTasks(cookie, [
      { title: 'Đặt bàn sinh nhật vợ', dueAt: '2026-11-28T04:00:00.000Z' },
      { title: 'Rửa xe', done: true, createdAt: '2026-11-18T02:00:00.000Z' },
    ]);
    expect(seeded).toHaveLength(2);
    expect(seeded[0]).toMatchObject({ title: 'Đặt bàn sinh nhật vợ', done: false, dueAt: '2026-11-28T04:00:00.000Z' });
    expect(seeded[1]).toMatchObject({ title: 'Rửa xe', done: true, dueAt: null, createdAt: '2026-11-18T02:00:00.000Z' });
    const listed = (await (await t.app.request('/api/tasks', { headers: { Cookie: cookie } })).json()) as Array<{ id: string }>;
    expect(listed.map((x) => x.id).sort()).toEqual(seeded.map((x) => x.id).sort());
  });

  test('C3 · each testApp() has its own in-memory database', async () => {
    const one = testApp();
    const two = testApp();
    const cookie = await one.signIn('an@example.com');
    await one.seedTasks(cookie, [{ title: 'chỉ ở app một' }]);
    expect((await two.app.request('/api/me', { headers: { Cookie: cookie } })).status).toBe(401);
    const other = await two.signIn('an@example.com');
    const listed = await (await two.app.request('/api/tasks', { headers: { Cookie: other } })).json();
    expect(listed).toEqual([]);
  });

  test('C3 · testApp passes features and now through to createApp', async () => {
    const calls: string[] = [];
    const clock = { t: Date.UTC(2026, 10, 27, 3, 20) };
    const t = testApp({
      features: [
        {
          id: 'echo',
          routes: [{ method: 'GET', path: '/api/echo' }],
          register(app) {
            calls.push('echo');
            app.get('/api/echo', (c) => c.json({ ok: true }));
          },
        },
      ],
      now: () => new Date(clock.t),
    });
    expect(calls).toEqual(['echo']);
    expect((await t.app.request('/api/echo')).status).toBe(200);

    const cookie = await t.signIn('an@example.com');
    clock.t += 31 * DAY;
    expect((await t.app.request('/api/me', { headers: { Cookie: cookie } })).status).toBe(401);
  });
});

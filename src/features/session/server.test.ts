// @vitest-environment node
// Route tests of the session feature (C23): POST /api/auth/sign-in and POST /api/auth/sign-out,
// on testApp() (the features found on disk, an in-memory database).
import { describe, expect, test } from 'vitest';
import { testApp } from '../../../server/testing';

const PASSWORD = 'test-password-1';

function post(body?: unknown, cookie?: string): RequestInit {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  return { method: 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) };
}

function get(cookie?: string): RequestInit {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  return { method: 'GET', headers };
}

/** The sid=<value> pair a response sets, or null. */
function sidOf(res: Response): string | null {
  const pair = res.headers
    .getSetCookie()
    .map((line) => line.split(';')[0].trim())
    .find((p) => p.startsWith('sid='));
  return pair && pair !== 'sid=' ? pair : null;
}

/** A user with the test password; returns its id and email as GET /api/me knows them. */
async function account(t: ReturnType<typeof testApp>, email: string) {
  const cookie = await t.signIn(email);
  const me = await t.app.request('/api/me', get(cookie));
  expect(me.status).toBe(200);
  return (await me.json()) as { id: string; email: string };
}

describe('session · C23 · POST /api/auth/sign-in', () => {
  test('session · C23 · the right email and password answer 200 { id, email } with a session cookie that GET /api/me accepts', async () => {
    const t = testApp();
    const user = await account(t, 'thu.ha@example.com');

    const res = await t.app.request('/api/auth/sign-in', post({ email: 'thu.ha@example.com', password: PASSWORD }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ id: user.id, email: 'thu.ha@example.com' });

    const sid = sidOf(res);
    expect(sid).not.toBeNull();
    const me = await t.app.request('/api/me', get(sid!));
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ id: user.id, email: 'thu.ha@example.com' });
  });

  test('session · C23 · the session cookie is HttpOnly, SameSite=Lax, Path=/', async () => {
    const t = testApp();
    await account(t, 'cookie@example.com');
    const res = await t.app.request('/api/auth/sign-in', post({ email: 'cookie@example.com', password: PASSWORD }));
    expect(res.status).toBe(200);
    const line = res.headers.getSetCookie().find((l) => l.startsWith('sid='));
    expect(line).toBeDefined();
    expect(line!).toMatch(/HttpOnly/i);
    expect(line!).toMatch(/SameSite=Lax/i);
    expect(line!).toMatch(/Path=\//i);
  });

  test('session · C23 · an email in another case with spaces around it signs in the same account', async () => {
    const t = testApp();
    const user = await account(t, 'minh.anh@example.com');
    const res = await t.app.request('/api/auth/sign-in', post({ email: '  Minh.Anh@EXAMPLE.com  ', password: PASSWORD }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: user.id, email: 'minh.anh@example.com' });
    expect(sidOf(res)).not.toBeNull();
  });

  test('session · C23 · the session cookie gives the user their own tasks', async () => {
    const t = testApp();
    const mine = await t.signIn('mine@example.com');
    const other = await t.signIn('other@example.com');
    await t.seedTasks(mine, [{ title: 'Nộp hồ sơ xin visa' }]);
    await t.seedTasks(other, [{ title: 'Gọi thợ sửa máy giặt' }]);

    const res = await t.app.request('/api/auth/sign-in', post({ email: 'mine@example.com', password: PASSWORD }));
    expect(res.status).toBe(200);
    const list = await t.app.request('/api/tasks', get(sidOf(res)!));
    expect(list.status).toBe(200);
    const titles = ((await list.json()) as Array<{ title: string }>).map((x) => x.title);
    expect(titles).toEqual(['Nộp hồ sơ xin visa']);
  });

  test('session · C23 · a wrong password answers 401 { error: "wrong_credentials" } and sets no session cookie', async () => {
    const t = testApp();
    await account(t, 'wrong@example.com');
    const res = await t.app.request('/api/auth/sign-in', post({ email: 'wrong@example.com', password: 'not-the-password' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'wrong_credentials' });
    expect(sidOf(res)).toBeNull();
  });

  test('session · C23 · an email no account has answers 401 { error: "wrong_credentials" } and sets no session cookie', async () => {
    const t = testApp();
    await account(t, 'someone@example.com');
    const res = await t.app.request('/api/auth/sign-in', post({ email: 'nobody@example.com', password: PASSWORD }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'wrong_credentials' });
    expect(sidOf(res)).toBeNull();
  });
});

describe('session · C23 · POST /api/auth/sign-out', () => {
  test('session · C23 · with a valid session it answers 204 and deletes that session: the old cookie then gets 401', async () => {
    const t = testApp();
    await account(t, 'out@example.com');
    const signIn = await t.app.request('/api/auth/sign-in', post({ email: 'out@example.com', password: PASSWORD }));
    const sid = sidOf(signIn)!;
    expect(sid).not.toBeNull();
    expect((await t.app.request('/api/me', get(sid))).status).toBe(200);

    const res = await t.app.request('/api/auth/sign-out', post(undefined, sid));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');

    const me = await t.app.request('/api/me', get(sid));
    expect(me.status).toBe(401);
    const tasks = await t.app.request('/api/tasks', get(sid));
    expect(tasks.status).toBe(401);
  });

  test('session · C23 · it ends a session started by testApp().signIn() too', async () => {
    const t = testApp();
    const cookie = await t.signIn('fixture@example.com');
    const res = await t.app.request('/api/auth/sign-out', post(undefined, cookie));
    expect(res.status).toBe(204);
    expect((await t.app.request('/api/me', get(cookie))).status).toBe(401);
  });

  test('session · C23 · it deletes only the session it names: another session of the same user still works', async () => {
    const t = testApp();
    await account(t, 'two@example.com');
    const laptop = sidOf(await t.app.request('/api/auth/sign-in', post({ email: 'two@example.com', password: PASSWORD })))!;
    const phone = sidOf(await t.app.request('/api/auth/sign-in', post({ email: 'two@example.com', password: PASSWORD })))!;
    expect(laptop).not.toBeNull();
    expect(phone).not.toBeNull();
    expect(laptop).not.toBe(phone);

    const res = await t.app.request('/api/auth/sign-out', post(undefined, laptop));
    expect(res.status).toBe(204);
    expect((await t.app.request('/api/me', get(laptop))).status).toBe(401);
    expect((await t.app.request('/api/me', get(phone))).status).toBe(200);
  });

  test('session · C23 · without a cookie it answers 204 (it is not behind requireUser)', async () => {
    const t = testApp();
    const res = await t.app.request('/api/auth/sign-out', post());
    expect(res.status).toBe(204);
  });

  test('session · C23 · with a cookie naming no session it answers 204', async () => {
    const t = testApp();
    const res = await t.app.request('/api/auth/sign-out', post(undefined, 'sid=no-such-session'));
    expect(res.status).toBe(204);
  });

  test('session · C23 · with a session already ended it answers 204 again', async () => {
    const t = testApp();
    const cookie = await t.signIn('twice@example.com');
    expect((await t.app.request('/api/auth/sign-out', post(undefined, cookie))).status).toBe(204);
    expect((await t.app.request('/api/auth/sign-out', post(undefined, cookie))).status).toBe(204);
  });

  test('session · C23 · with a session older than 30 days it answers 204', async () => {
    let now = new Date('2026-10-01T00:00:00.000Z');
    const t = testApp({ now: () => now });
    const cookie = await t.signIn('old@example.com');
    now = new Date('2026-11-27T00:00:00.000Z');
    expect((await t.app.request('/api/me', get(cookie))).status).toBe(401);
    const res = await t.app.request('/api/auth/sign-out', post(undefined, cookie));
    expect(res.status).toBe(204);
  });
});

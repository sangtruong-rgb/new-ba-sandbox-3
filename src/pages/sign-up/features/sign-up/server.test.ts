// Route tests of POST /api/auth/sign-up (ticket #3, C15 C16), on testApp().
import { describe, expect, test } from 'vitest';
import { testApp } from '../../../../../server/testing';
import type { ServerFeature } from '../../../../../server/types';
import * as signUp from './server';

const PATH = '/api/auth/sign-up';
const GOOD_PASSWORD = 'mat-khau-dai';

type App = ReturnType<typeof testApp>['app'];

function post(app: App, body: unknown) {
  return app.request(PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** The `sid=<value>` pair a response sets, or null. */
function sid(res: Response): string | null {
  return (
    res.headers
      .getSetCookie()
      .map((line) => line.split(';')[0].trim())
      .find((pair) => pair.startsWith('sid=') && pair.length > 'sid='.length) ?? null
  );
}

/** The sign-up feature of this folder, run by testApp, with the database it is given kept for counting. */
function appWithDb() {
  let db: { prepare(sql: string): { get(...args: unknown[]): unknown } } | undefined;
  const feature: ServerFeature = {
    id: signUp.id,
    routes: signUp.routes,
    register(app, deps) {
      db = deps.db as unknown as typeof db;
      signUp.register(app, deps);
    },
  };
  const { app } = testApp({ features: [feature] });
  const count = () => (db!.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  return { app, count };
}

describe('sign-up/sign-up · POST /api/auth/sign-up', () => {
  test('sign-up/sign-up · C16 · the feature declares POST /api/auth/sign-up', () => {
    expect(signUp.routes).toContainEqual({ method: 'POST', path: PATH });
  });

  test('sign-up/sign-up · C16 · a good email and password answer 201 { id, email } with the session cookie', async () => {
    const { app } = testApp();
    const res = await post(app, { email: 'thu.ha@example.com', password: GOOD_PASSWORD });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; email: string };
    expect(body).toEqual({ id: expect.any(String), email: 'thu.ha@example.com' });
    expect(body.id.length).toBeGreaterThan(0);

    const cookie = sid(res);
    expect(cookie).not.toBeNull();
    const line = res.headers.getSetCookie().find((l) => l.startsWith('sid='))!;
    expect(line).toMatch(/HttpOnly/i);

    // the cookie is a session of that account
    const me = await app.request('/api/me', { headers: { Cookie: cookie! } });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ id: body.id, email: 'thu.ha@example.com' });
  });

  test('sign-up/sign-up · C16 · a password of exactly 8 characters and an email with spaces around it are accepted', async () => {
    const { app } = testApp();
    const res = await post(app, { email: '   minh@example.vn  ', password: '12345678' });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; email: string };
    expect(body.email).toBe('minh@example.vn');
    expect(sid(res)).not.toBeNull();
  });

  for (const email of ['thu.ha@example', 'thu.ha.example.com', 'a.b@c', '   ', '']) {
    test(`sign-up/sign-up · C16 · the email ${JSON.stringify(email)} answers 400 { error: "invalid_email" } and creates nothing`, async () => {
      const { app, count } = appWithDb();
      const res = await post(app, { email, password: GOOD_PASSWORD });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_email' });
      expect(sid(res)).toBeNull();
      expect(count()).toBe(0);
    });
  }

  for (const password of ['1234567', 'abc123', '']) {
    test(`sign-up/sign-up · C16 · the password ${JSON.stringify(password)} (shorter than 8) answers 400 { error: "password_too_short" } and creates nothing`, async () => {
      const { app, count } = appWithDb();
      const res = await post(app, { email: 'thu.ha@example.com', password });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'password_too_short' });
      expect(sid(res)).toBeNull();
      expect(count()).toBe(0);
    });
  }

  test('sign-up/sign-up · C16 · both wrong answers 400 { error: "invalid_email" }', async () => {
    const { app } = testApp();
    const res = await post(app, { email: 'thu.ha@example', password: 'abc123' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_email' });
  });

  test('sign-up/sign-up · C16 · an email that already has an account answers 409 { error: "email_taken" }', async () => {
    const { app } = testApp();
    expect((await post(app, { email: 'lan@example.com', password: GOOD_PASSWORD })).status).toBe(201);
    const res = await post(app, { email: 'lan@example.com', password: 'another-password' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'email_taken' });
    expect(sid(res)).toBeNull();
  });

  test('sign-up/sign-up · C15 · the same email in another case and with spaces around it answers 409 and no second account is created', async () => {
    const { app, count } = appWithDb();
    const first = await post(app, { email: 'lan.anh@example.com', password: GOOD_PASSWORD });
    expect(first.status).toBe(201);
    expect(count()).toBe(1);

    const res = await post(app, { email: '  LAN.Anh@Example.COM   ', password: 'another-password' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'email_taken' });
    expect(sid(res)).toBeNull();
    expect(count()).toBe(1);
  });

  test('sign-up/sign-up · C15 · an account made elsewhere (signIn of testApp) also answers 409 for that email in upper case', async () => {
    const { app, signIn } = testApp();
    await signIn('hoa@example.com');
    const res = await post(app, { email: ' HOA@EXAMPLE.COM ', password: GOOD_PASSWORD });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'email_taken' });
  });
});

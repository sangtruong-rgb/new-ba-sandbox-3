// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { createApp } from '../app';
import { endSession, requireUser, startSession } from './sessions';
import { captureDeps, json, sidCookie, sidSetCookieLine } from '../__tests__/probe';

const DAY = 24 * 60 * 60 * 1000;

function setup(clock?: { t: number }) {
  const probe = captureDeps(
    'probe',
    (app, deps) => {
      app.post('/api/probe/start', async (c) => {
        const { userId } = (await c.req.json()) as { userId: string };
        deps.startSession(c, userId);
        return c.json({ ok: true });
      });
      app.post('/api/probe/end', (c) => {
        deps.endSession(c);
        return c.json({ ok: true });
      });
      app.get('/api/probe/who', deps.requireUser, (c) => c.json(c.get('user')));
    },
    [
      { method: 'POST', path: '/api/probe/start' },
      { method: 'POST', path: '/api/probe/end' },
      { method: 'GET', path: '/api/probe/who' },
    ],
  );
  const app = createApp({
    databasePath: ':memory:',
    features: [probe.feature],
    ...(clock ? { now: () => new Date(clock.t) } : {}),
  });
  const user = probe.deps().users.create('an@example.com', 'mat-khau-dai');
  const start = async () => {
    const res = await app.request('/api/probe/start', json({ userId: user.id }));
    expect(res.status).toBe(200);
    return res;
  };
  const sessionCount = () =>
    (probe.db().prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n;
  return { app, user, start, sessionCount };
}

describe('server/auth/sessions', () => {
  test('C2 · sessions.ts exports startSession, endSession and requireUser', () => {
    expect(typeof startSession).toBe('function');
    expect(typeof endSession).toBe('function');
    expect(typeof requireUser).toBe('function');
  });

  test('C2 · startSession writes a sessions row and an HttpOnly, SameSite=Lax, Path=/ sid cookie for 30 days', async () => {
    const { start, sessionCount } = setup();
    expect(sessionCount()).toBe(0);
    const res = await start();
    expect(sessionCount()).toBe(1);
    const line = sidSetCookieLine(res);
    expect(line).not.toBeNull();
    const attrs = line!.split(';').map((s) => s.trim().toLowerCase());
    expect(attrs).toContain('httponly');
    expect(attrs).toContain('samesite=lax');
    expect(attrs).toContain('path=/');
    expect(attrs).toContain(`max-age=${30 * 24 * 60 * 60}`);
  });

  test('C2 · the sid is random 32 bytes: long and different for each session', async () => {
    const { start } = setup();
    const a = sidCookie(await start())!.slice('sid='.length);
    const b = sidCookie(await start())!.slice('sid='.length);
    expect(a.length).toBeGreaterThanOrEqual(43); // 32 bytes as base64url (43) or hex (64)
    expect(a).not.toBe(b);
  });

  test('C2 · requireUser sets c.get("user") to the User of the cookie', async () => {
    const { app, start, user } = setup();
    const cookie = sidCookie(await start())!;
    const res = await app.request('/api/probe/who', { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: user.id, email: 'an@example.com' });
  });

  test('C2 · requireUser answers 401 { error: "unauthenticated" } when the cookie is missing or unknown', async () => {
    const { app } = setup();
    const missing = await app.request('/api/probe/who');
    expect(missing.status).toBe(401);
    expect(await missing.json()).toEqual({ error: 'unauthenticated' });
    const unknown = await app.request('/api/probe/who', { headers: { Cookie: 'sid=' + 'cd'.repeat(32) } });
    expect(unknown.status).toBe(401);
    expect(await unknown.json()).toEqual({ error: 'unauthenticated' });
  });

  test('C4 · a session older than 30 days answers 401 on GET /api/me (server clock 30 days later)', async () => {
    const clock = { t: Date.UTC(2026, 10, 27, 3, 20) };
    const { app, start } = setup(clock);
    const cookie = sidCookie(await start())!;

    clock.t += 29 * DAY;
    expect((await app.request('/api/me', { headers: { Cookie: cookie } })).status).toBe(200);
    expect((await app.request('/api/probe/who', { headers: { Cookie: cookie } })).status).toBe(200);

    clock.t += DAY + 60 * 1000; // 30 days and a minute after the start
    const me = await app.request('/api/me', { headers: { Cookie: cookie } });
    expect(me.status).toBe(401);
    expect(await me.json()).toEqual({ error: 'unauthenticated' });
    const who = await app.request('/api/probe/who', { headers: { Cookie: cookie } });
    expect(who.status).toBe(401);
  });

  test('C2 · endSession deletes the row named by the cookie and clears the cookie', async () => {
    const { app, start, sessionCount } = setup();
    const cookie = sidCookie(await start())!;
    const other = sidCookie(await start())!;
    expect(sessionCount()).toBe(2);

    const res = await app.request('/api/probe/end', { method: 'POST', headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    expect(sessionCount()).toBe(1);
    const line = sidSetCookieLine(res);
    expect(line).not.toBeNull();
    const lower = line!.toLowerCase();
    const cleared = lower.includes('max-age=0') || /expires=thu, 01 jan 1970/.test(lower) || lower.startsWith('sid=;');
    expect(cleared).toBe(true);

    expect((await app.request('/api/probe/who', { headers: { Cookie: cookie } })).status).toBe(401);
    expect((await app.request('/api/probe/who', { headers: { Cookie: other } })).status).toBe(200);
  });

  test('C2 · endSession without a cookie changes nothing', async () => {
    const { app, start, sessionCount } = setup();
    await start();
    const res = await app.request('/api/probe/end', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(sessionCount()).toBe(1);
  });
});

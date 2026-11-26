// @vitest-environment node
// Login CSRF guard of POST /api/auth/sign-in (C23): only same-site JSON requests may sign in.
import { describe, expect, test } from 'vitest';
import { testApp } from '../../../server/testing';

const PASSWORD = 'test-password-1';
const JSON_BODY = JSON.stringify({ email: 'csrf@example.com', password: PASSWORD });

function hasSid(res: Response): boolean {
  return res.headers.getSetCookie().some((l) => l.startsWith('sid=') && !l.startsWith('sid=;'));
}

describe('session · C23 · sign-in refuses cross-site requests', () => {
  test('session · C23 · a text/plain body (a cross-site form) is refused with 415 and no session', async () => {
    const t = testApp();
    await t.signIn('csrf@example.com');
    const res = await t.app.request('/api/auth/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON_BODY,
    });
    expect(res.status).toBe(415);
    expect(hasSid(res)).toBe(false);
  });

  test('session · C23 · a request with no Content-Type is refused with 415', async () => {
    const t = testApp();
    await t.signIn('csrf@example.com');
    const res = await t.app.request('/api/auth/sign-in', { method: 'POST', body: JSON_BODY });
    expect(res.status).toBe(415);
    expect(hasSid(res)).toBe(false);
  });

  test('session · C23 · a cross-site JSON request is refused with 403', async () => {
    const t = testApp();
    await t.signIn('csrf@example.com');
    const res = await t.app.request('/api/auth/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' },
      body: JSON_BODY,
    });
    expect(res.status).toBe(403);
    expect(hasSid(res)).toBe(false);
  });

  test('session · C23 · a same-origin JSON request with a charset still signs in', async () => {
    const t = testApp();
    await t.signIn('csrf@example.com');
    const res = await t.app.request('/api/auth/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Sec-Fetch-Site': 'same-origin' },
      body: JSON_BODY,
    });
    expect(res.status).toBe(200);
    expect(hasSid(res)).toBe(true);
  });
});

// Session routes: POST /api/auth/sign-in and POST /api/auth/sign-out (not behind requireUser).
import type { Hono } from 'hono';
import type { AppEnv, ServerDeps, ServerFeature } from '../../../server/types';

export const id = 'session';

export const routes: ServerFeature['routes'] = [
  { method: 'POST', path: '/api/auth/sign-in' },
  { method: 'POST', path: '/api/auth/sign-out' },
];

export function register(app: Hono<AppEnv>, deps: ServerDeps): void {
  app.post('/api/auth/sign-in', async (c) => {
    // Login CSRF guard: a cross-site form can only send simple requests (text/plain,
    // form-encoded, multipart), so only JSON bodies from the same site are accepted.
    const contentType = (c.req.header('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
    if (contentType !== 'application/json') {
      return c.json({ error: 'unsupported_media_type' }, 415);
    }
    const fetchSite = c.req.header('Sec-Fetch-Site');
    if (fetchSite !== undefined && fetchSite !== 'same-origin' && fetchSite !== 'none') {
      return c.json({ error: 'cross_site' }, 403);
    }
    let body: unknown = null;
    try {
      body = await c.req.json();
    } catch {
      body = null;
    }
    const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
    if (typeof email !== 'string' || typeof password !== 'string' || email.trim() === '' || password === '') {
      return c.json({ error: 'wrong_credentials' }, 401);
    }
    const user = deps.users.verify(email, password);
    if (!user) return c.json({ error: 'wrong_credentials' }, 401);
    deps.startSession(c, user.id);
    return c.json({ id: user.id, email: user.email }, 200);
  });

  app.post('/api/auth/sign-out', (c) => {
    deps.endSession(c);
    return c.body(null, 204);
  });
}

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

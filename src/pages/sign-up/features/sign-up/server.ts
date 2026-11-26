// POST /api/auth/sign-up: creates the account and starts its session.
import { EmailTakenError } from '../../../../../server/auth/users';
import type { RouteDecl, ServerFeature } from '../../../../../server/types';
import { signUpProblem } from './rules';

export const id = 'sign-up';

export const routes: RouteDecl[] = [{ method: 'POST', path: '/api/auth/sign-up' }];

export const register: ServerFeature['register'] = (app, deps) => {
  app.post('/api/auth/sign-up', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
    const email = typeof body?.email === 'string' ? body.email : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const problem = signUpProblem(email, password);
    if (problem) return c.json({ error: problem }, 400);
    let user;
    try {
      user = deps.users.create(email, password);
    } catch (e) {
      if (e instanceof EmailTakenError) return c.json({ error: 'email_taken' }, 409);
      throw e;
    }
    deps.startSession(c, user.id);
    return c.json({ id: user.id, email: user.email }, 201);
  });
};

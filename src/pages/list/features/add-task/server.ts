// POST /api/tasks: a new task of the session's user.
import type { Hono } from 'hono';
import type { AppEnv, RouteDecl, ServerDeps } from '../../../../../server/types';
import { isDueAt, validateTitle } from '../../../../shared/tasks/rules';

export const id = 'add-task';

export const routes: RouteDecl[] = [{ method: 'POST', path: '/api/tasks' }];

export function register(app: Hono<AppEnv>, { tasks, requireUser }: ServerDeps): void {
  app.post('/api/tasks', requireUser, async (c) => {
    const body = ((await c.req.json().catch(() => null)) ?? {}) as { title?: unknown; dueAt?: unknown };
    const title = typeof body.title === 'string' ? validateTitle(body.title) : null;
    if (!title?.ok) return c.json({ error: 'invalid_title' }, 400);
    const dueAt = body.dueAt ?? null;
    if (!isDueAt(dueAt)) return c.json({ error: 'invalid_due' }, 400);
    const task = tasks.create(c.get('user').id, {
      title: title.value,
      // stored in UTC, whatever offset was sent
      dueAt: dueAt === null ? null : new Date(dueAt as string).toISOString(),
    });
    return c.json(task, 201);
  });
}

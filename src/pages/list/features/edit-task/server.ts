// PATCH /api/tasks/:id: the title and due of one of the session user's tasks.
import type { Hono } from 'hono';
import type { AppEnv, RouteDecl, ServerDeps, Task } from '../../../../../server/types';
import { isDueAt, validateTitle } from '../../../../shared/tasks/rules';

export const id = 'edit-task';

export const routes: RouteDecl[] = [{ method: 'PATCH', path: '/api/tasks/:id' }];

export function register(app: Hono<AppEnv>, { tasks, requireUser }: ServerDeps): void {
  app.patch('/api/tasks/:id', requireUser, async (c) => {
    const body = ((await c.req.json().catch(() => null)) ?? {}) as { title?: unknown; dueAt?: unknown };
    // JSON has no undefined: an undefined field was not sent
    if (body.title === undefined && body.dueAt === undefined) return c.json({ error: 'invalid_body' }, 400);

    const patch: Partial<Pick<Task, 'title' | 'dueAt'>> = {};
    if (body.title !== undefined) {
      const title = typeof body.title === 'string' ? validateTitle(body.title) : null;
      if (!title?.ok) return c.json({ error: 'invalid_title' }, 400);
      patch.title = title.value;
    }
    if (body.dueAt !== undefined) {
      if (!isDueAt(body.dueAt)) return c.json({ error: 'invalid_due' }, 400);
      // stored in UTC, whatever offset was sent
      patch.dueAt = body.dueAt === null ? null : new Date(body.dueAt as string).toISOString();
    }

    const task = tasks.update(c.get('user').id, c.req.param('id'), patch);
    return task ? c.json(task) : c.json({ error: 'not_found' }, 404);
  });
}

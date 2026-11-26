// POST /api/tasks/:id/done and DELETE /api/tasks/:id: the user's own tasks only.
import type { ServerFeature } from '../../../../../server/types';

export const id: ServerFeature['id'] = 'list/done-delete';

export const routes: ServerFeature['routes'] = [
  { method: 'POST', path: '/api/tasks/:id/done' },
  { method: 'DELETE', path: '/api/tasks/:id' },
];

export const register: ServerFeature['register'] = (app, { tasks, requireUser }) => {
  app.post('/api/tasks/:id/done', requireUser, async (c) => {
    const body = (await c.req.json().catch(() => null)) as { done?: unknown } | null;
    const done = body?.done;
    if (typeof done !== 'boolean') return c.json({ error: 'invalid_done' }, 400);
    const task = tasks.update(c.get('user').id, c.req.param('id'), { done });
    return task ? c.json(task) : c.json({ error: 'not_found' }, 404);
  });

  app.delete('/api/tasks/:id', requireUser, (c) =>
    tasks.remove(c.get('user').id, c.req.param('id')) ? c.body(null, 204) : c.json({ error: 'not_found' }, 404),
  );
};

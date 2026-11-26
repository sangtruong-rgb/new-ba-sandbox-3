// The app's construction, shared by server/app.ts (createApp, the default export) and
// server/testing.ts (testApp). It opens no database and loads no feature on import.
import { Hono } from 'hono';
import { EmailTakenError, users } from './auth/users';
import { bindSessions, endSession, requireUser, sessionUser, startSession } from './auth/sessions';
import { openDatabase } from './db';
import { featuresOnDisk, registerFeatures } from './registry';
import { tasks } from './tasks/store';
import type { AppEnv, ServerDeps, ServerFeature, User } from './types';

export type CreateAppOptions = { databasePath?: string; features?: ServerFeature[]; now?: () => Date };

export const TEST_PASSWORD = 'test-password-1';

type SeedTask = { title?: unknown; done?: unknown; dueAt?: unknown; createdAt?: unknown };

export function buildApp(opts: CreateAppOptions, mode: { testEndpoints: boolean }): Hono<AppEnv> {
  const db = openDatabase(opts.databasePath ?? ':memory:');
  const now = opts.now ?? (() => new Date());
  const userStore = users(db, now);
  const taskStore = tasks(db, now);
  const deps: ServerDeps = { db, users: userStore, tasks: taskStore, startSession, endSession, requireUser };

  const app = new Hono<AppEnv>();
  app.use('*', bindSessions({ db, users: userStore, now }));
  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError((err, c) => {
    console.error('[server]', err);
    return c.json({ error: 'server_error' }, 500);
  });

  // Core routes, before any feature.
  app.get('/api/me', (c) => {
    const user = sessionUser(c);
    if (!user) return c.json({ error: 'unauthenticated' }, 401);
    return c.json({ id: user.id, email: user.email });
  });
  app.get('/api/tasks', requireUser, (c) => c.json(taskStore.list(c.get('user').id)));

  if (mode.testEndpoints) {
    app.post('/api/test/session', async (c) => {
      const body = (await c.req.json().catch(() => null)) as { email?: unknown } | null;
      if (!body || typeof body.email !== 'string' || !body.email.trim()) return c.json({ error: 'invalid_email' }, 400);
      // `users` alone normalises emails: an existing account surfaces as EmailTakenError.
      let user: User;
      try {
        user = userStore.create(body.email, TEST_PASSWORD);
      } catch (e) {
        if (!(e instanceof EmailTakenError)) throw e;
        user = e.user;
      }
      startSession(c, user.id);
      return c.json({ id: user.id, email: user.email });
    });
    app.post('/api/test/tasks', requireUser, async (c) => {
      const body = (await c.req.json().catch(() => null)) as { tasks?: unknown } | null;
      if (!body || !Array.isArray(body.tasks)) return c.json({ error: 'invalid_tasks' }, 400);
      const userId = c.get('user').id;
      const created = (body.tasks as SeedTask[]).map((t) => {
        const task = taskStore.create(userId, {
          title: typeof t.title === 'string' ? t.title : '',
          dueAt: typeof t.dueAt === 'string' ? t.dueAt : null,
        });
        const done = t.done === true;
        const createdAt = typeof t.createdAt === 'string' ? t.createdAt : task.createdAt;
        db.prepare('UPDATE tasks SET done = ?, created_at = ? WHERE id = ? AND user_id = ?').run(
          done ? 1 : 0,
          createdAt,
          task.id,
          userId,
        );
        return { ...task, done, createdAt };
      });
      return c.json(created);
    });
  }

  registerFeatures(app, opts.features ?? featuresOnDisk(), deps);
  return app;
}

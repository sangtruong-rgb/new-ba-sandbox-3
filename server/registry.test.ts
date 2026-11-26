// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { createApp } from './app';
import type { ServerFeature } from './types';

function feature(id: string, calls: string[], routes: ServerFeature['routes'] = [], register?: ServerFeature['register']): ServerFeature {
  return {
    id,
    routes,
    register(app, deps) {
      calls.push(id);
      register?.(app, deps);
    },
  };
}

describe('server/registry', () => {
  test('C3 · createApp calls each feature register() once, alphabetical by id', () => {
    const calls: string[] = [];
    createApp({
      databasePath: ':memory:',
      features: [feature('tasks-edit', calls), feature('auth-sign-in', calls), feature('tasks-add', calls)],
    });
    expect(calls).toEqual(['auth-sign-in', 'tasks-add', 'tasks-edit']);
  });

  test('C3 · register() gets the app rooted at /: a feature registers and answers full /api paths', async () => {
    const calls: string[] = [];
    const app = createApp({
      databasePath: ':memory:',
      features: [
        feature('ping', calls, [{ method: 'GET', path: '/api/ping' }], (a) => {
          a.get('/api/ping', (c) => c.json({ pong: true }));
        }),
      ],
    });
    const res = await app.request('/api/ping');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pong: true });
  });

  test('C3 · a feature route is guarded by deps.requireUser like any core route', async () => {
    const calls: string[] = [];
    const app = createApp({
      databasePath: ':memory:',
      features: [
        feature('guarded', calls, [{ method: 'POST', path: '/api/guarded' }], (a, deps) => {
          a.post('/api/guarded', deps.requireUser, (c) => c.json({ email: c.get('user').email }));
        }),
      ],
    });
    const res = await app.request('/api/guarded', { method: 'POST' });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
  });

  test('C3 · two features declaring one method and path make createApp throw an error naming both', () => {
    const calls: string[] = [];
    const make = () =>
      createApp({
        databasePath: ':memory:',
        features: [
          feature('tasks-add', calls, [{ method: 'POST', path: '/api/tasks' }]),
          feature('tasks-import', calls, [
            { method: 'GET', path: '/api/import' },
            { method: 'POST', path: '/api/tasks' },
          ]),
        ],
      });
    expect(make).toThrow(/tasks-add/);
    expect(make).toThrow(/tasks-import/);
  });

  test('C3 · the same path with different methods is not a clash', () => {
    const calls: string[] = [];
    expect(() =>
      createApp({
        databasePath: ':memory:',
        features: [
          feature('tasks-done', calls, [{ method: 'PATCH', path: '/api/tasks/:id' }]),
          feature('tasks-delete', calls, [{ method: 'DELETE', path: '/api/tasks/:id' }]),
        ],
      }),
    ).not.toThrow();
    expect(calls.sort()).toEqual(['tasks-delete', 'tasks-done']);
  });

  test('C3 · createApp without features loads the features found on disk and starts', async () => {
    const app = createApp({ databasePath: ':memory:' });
    const res = await app.request('/api/me');
    expect(res.status).toBe(401);
  });
});

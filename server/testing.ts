// ServerTesting: an app on its own in-memory database with the test endpoints on.
// Feature route tests import testApp() from here.
import type { Hono } from 'hono';
import { buildApp } from './core';
import type { AppEnv, ServerFeature, Task } from './types';

export type SeedTask = { title: string; done?: boolean; dueAt?: string | null; createdAt?: string };

let counter = 0;

export function testApp(opts: { features?: ServerFeature[]; now?: () => Date } = {}): {
  app: Hono<AppEnv>;
  signIn(email?: string): Promise<string>;
  seedTasks(cookie: string, tasks: SeedTask[]): Promise<Task[]>;
} {
  const app = buildApp({ databasePath: ':memory:', features: opts.features, now: opts.now }, { testEndpoints: true });

  async function signIn(email?: string): Promise<string> {
    const address = email ?? `test-${++counter}@example.com`;
    const res = await app.request('/api/test/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: address }),
    });
    if (res.status !== 200) throw new Error(`signIn failed: ${res.status} ${await res.text()}`);
    const sid = res.headers
      .getSetCookie()
      .map((line) => line.split(';')[0].trim())
      .find((pair) => pair.startsWith('sid='));
    if (!sid) throw new Error('signIn: no sid cookie');
    return sid;
  }

  async function seedTasks(cookie: string, tasks: SeedTask[]): Promise<Task[]> {
    const res = await app.request('/api/test/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ tasks }),
    });
    if (res.status !== 200) throw new Error(`seedTasks failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as Task[];
  }

  return { app, signIn, seedTasks };
}

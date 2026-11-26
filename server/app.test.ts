// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app';
import { captureDeps, json, sidCookie } from './__tests__/probe';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function signIn(app: ReturnType<typeof createApp>, email: string): Promise<string> {
  const res = await app.request('/api/test/session', json({ email }));
  expect(res.status).toBe(200);
  const cookie = sidCookie(res);
  expect(cookie).not.toBeNull();
  return cookie!;
}

describe('server/app', () => {
  test('C2 · createApp creates the users, sessions and tasks tables before any feature registers', () => {
    const tablesAtRegister: string[] = [];
    const probe = captureDeps('probe', (_app, deps) => {
      const db = deps.db as unknown as import('better-sqlite3').Database;
      const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
      tablesAtRegister.push(...rows.map((r) => r.name));
    });
    createApp({ databasePath: ':memory:', features: [probe.feature] });
    expect(tablesAtRegister).toEqual(expect.arrayContaining(['users', 'sessions', 'tasks']));
  });

  test('C2 · createApp on an existing database file keeps its data (tables created only if missing)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'todo-app-'));
    try {
      const path = join(dir, 'db.sqlite');
      const first = createApp({ databasePath: path });
      const cookie = await signIn(first, 'keep@example.com');
      await first.request('/api/test/tasks', json({ tasks: [{ title: 'Mua thuốc huyết áp cho bố' }] }, cookie));
      const second = createApp({ databasePath: path });
      const res = await second.request('/api/tasks', { headers: { Cookie: cookie } });
      expect(res.status).toBe(200);
      const tasks = (await res.json()) as Array<{ title: string }>;
      expect(tasks.map((t) => t.title)).toEqual(['Mua thuốc huyết áp cho bố']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('C2 · core routes are registered before features: a feature cannot shadow GET /api/me', async () => {
    const shadow = captureDeps('shadow', (app) => {
      app.get('/api/me', (c) => c.json({ id: 'fake', email: 'fake@example.com' }));
    });
    const app = createApp({ databasePath: ':memory:', features: [shadow.feature] });
    const res = await app.request('/api/me');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
  });

  test('C2 · GET /api/me without a session answers 401 { error: "unauthenticated" }', async () => {
    const app = createApp({ databasePath: ':memory:', features: [] });
    const res = await app.request('/api/me');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
  });

  test('C2 · GET /api/me with a session answers 200 { id, email } and nothing else', async () => {
    const app = createApp({ databasePath: ':memory:', features: [] });
    const cookie = await signIn(app, 'thu.ha@example.com');
    const res = await app.request('/api/me', { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['email', 'id']);
    expect(body.email).toBe('thu.ha@example.com');
    expect(typeof body.id).toBe('string');
  });

  test('C2 · GET /api/me with an unknown sid answers 401', async () => {
    const app = createApp({ databasePath: ':memory:', features: [] });
    const res = await app.request('/api/me', { headers: { Cookie: 'sid=' + 'ab'.repeat(32) } });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
  });

  test('C2 · GET /api/tasks answers 401 without a session', async () => {
    const app = createApp({ databasePath: ':memory:', features: [] });
    const res = await app.request('/api/tasks');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
  });

  test("C2 · GET /api/tasks answers 200 with the session user's tasks only, as Task objects", async () => {
    const app = createApp({ databasePath: ':memory:', features: [] });
    const an = await signIn(app, 'an@example.com');
    const binh = await signIn(app, 'binh@example.com');
    await app.request(
      '/api/test/tasks',
      json({ tasks: [{ title: 'Nộp học phí học kỳ 2 cho bé Bin', dueAt: '2026-11-27T01:00:00.000Z' }] }, an),
    );
    await app.request('/api/test/tasks', json({ tasks: [{ title: 'Rửa xe', done: true }] }, binh));

    const res = await app.request('/api/tasks', { headers: { Cookie: an } });
    expect(res.status).toBe(200);
    const tasks = (await res.json()) as Array<Record<string, unknown>>;
    expect(tasks).toHaveLength(1);
    expect(Object.keys(tasks[0]).sort()).toEqual(['createdAt', 'done', 'dueAt', 'id', 'title']);
    expect(tasks[0]).toMatchObject({
      title: 'Nộp học phí học kỳ 2 cho bé Bin',
      done: false,
      dueAt: '2026-11-27T01:00:00.000Z',
    });
  });

  test('C2 · an unknown /api path answers 404 { error: "not_found" }', async () => {
    const app = createApp({ databasePath: ':memory:', features: [] });
    const res = await app.request('/api/khong-co-dau');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  test('C2 · the app serves only /api/*: a page path answers 404', async () => {
    const app = createApp({ databasePath: ':memory:', features: [] });
    const res = await app.request('/dang-nhap');
    expect(res.status).toBe(404);
  });

  test('C2 · the default export opens the database at DATABASE_PATH', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'todo-default-'));
    try {
      const path = join(dir, 'from-env.sqlite');
      vi.stubEnv('DATABASE_PATH', path);
      vi.resetModules();
      const mod = await import('./app');
      const res = await mod.default.request('/api/me');
      expect(res.status).toBe(401);
      expect(existsSync(path)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('C2 · the default export uses data/todo.sqlite when DATABASE_PATH is unset', async () => {
    vi.stubEnv('DATABASE_PATH', undefined as unknown as string);
    delete process.env.DATABASE_PATH;
    vi.resetModules();
    const mod = await import('./app');
    const res = await mod.default.request('/api/me');
    expect(res.status).toBe(401);
    expect(existsSync(join(process.cwd(), 'data', 'todo.sqlite'))).toBe(true);
  });
});

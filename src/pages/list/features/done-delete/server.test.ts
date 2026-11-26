// @vitest-environment node
// POST /api/tasks/:id/done and DELETE /api/tasks/:id, through testApp() (C34).
import { describe, expect, test } from 'vitest';
import { testApp } from '../../../../../server/testing';
import type { Task } from '../../../../shared/tasks/types';

type Ctx = ReturnType<typeof testApp>;

const DUE = '2026-11-28T01:00:00.000Z';
const CREATED = '2026-11-27T03:00:00.000Z';

const setDone = (app: Ctx['app'], id: string, body: string, cookie?: string) =>
  app.request(`/api/tasks/${id}/done`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body,
  });

const remove = (app: Ctx['app'], id: string, cookie?: string) =>
  app.request(`/api/tasks/${id}`, { method: 'DELETE', headers: cookie ? { Cookie: cookie } : {} });

async function list(app: Ctx['app'], cookie: string): Promise<Task[]> {
  const res = await app.request('/api/tasks', { headers: { Cookie: cookie } });
  expect(res.status).toBe(200);
  return (await res.json()) as Task[];
}

async function setup() {
  const t = testApp();
  const cookie = await t.signIn('an@example.com');
  const [task, other] = await t.seedTasks(cookie, [
    { title: 'Gửi hợp đồng thuê nhà', dueAt: DUE, createdAt: CREATED },
    { title: 'Nộp học phí học kỳ 2', createdAt: '2026-11-26T03:00:00.000Z' },
  ]);
  return { ...t, cookie, task, other };
}

const byId = (tasks: Task[], id: string) => tasks.find((t) => t.id === id);

describe('POST /api/tasks/:id/done', () => {
  test('list/done-delete · C34 · done true answers 200 with the Task, and done false takes it back', async () => {
    const { app, cookie, task, other } = await setup();

    const on = await setDone(app, task.id, JSON.stringify({ done: true }), cookie);
    expect(on.status).toBe(200);
    const expected = { id: task.id, title: 'Gửi hợp đồng thuê nhà', done: true, dueAt: DUE, createdAt: CREATED };
    expect(await on.json()).toEqual(expected);
    expect(byId(await list(app, cookie), task.id)).toEqual(expected);
    expect(byId(await list(app, cookie), other.id)?.done).toBe(false);

    const off = await setDone(app, task.id, JSON.stringify({ done: false }), cookie);
    expect(off.status).toBe(200);
    expect(await off.json()).toEqual({ ...expected, done: false });
    expect(byId(await list(app, cookie), task.id)).toEqual({ ...expected, done: false });
  });

  test.each([
    ['the string "true"', '{"done":"true"}'],
    ['the number 1', '{"done":1}'],
    ['null', '{"done":null}'],
    ['missing', '{}'],
    ['in a body that is null', 'null'],
    ['in a body that is not JSON', 'done=true'],
    ['in an empty body', ''],
  ])('list/done-delete · C34 · done %s answers 400 invalid_done and changes nothing', async (_name, body) => {
    const { app, cookie, task } = await setup();
    const res = await setDone(app, task.id, body, cookie);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_done' });
    expect(byId(await list(app, cookie), task.id)).toEqual(task);
  });

  test("list/done-delete · C34 · another user's task answers 404 and stays as it was", async () => {
    const { app, signIn, cookie, task } = await setup();
    const stranger = await signIn('binh@example.com');

    const res = await setDone(app, task.id, JSON.stringify({ done: true }), stranger);
    expect(res.status).toBe(404);
    expect(byId(await list(app, cookie), task.id)).toEqual(task);
    expect(await list(app, stranger)).toEqual([]);
    // the route is there: the owner gets 200
    expect((await setDone(app, task.id, JSON.stringify({ done: true }), cookie)).status).toBe(200);
  });

  test('list/done-delete · C34 · an unknown id answers 404 and changes nothing', async () => {
    const { app, cookie, task } = await setup();
    const before = await list(app, cookie);

    const res = await setDone(app, 'no-such-task', JSON.stringify({ done: true }), cookie);
    expect(res.status).toBe(404);
    expect(await list(app, cookie)).toEqual(before);
    // the route is there: a known id gets 200
    expect((await setDone(app, task.id, JSON.stringify({ done: true }), cookie)).status).toBe(200);
  });

  test('list/done-delete · C34 · without a session, or with an unknown one, answers 401 and changes nothing', async () => {
    const { app, cookie, task } = await setup();

    for (const session of [undefined, 'sid=not-a-session']) {
      const res = await setDone(app, task.id, JSON.stringify({ done: true }), session);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'unauthenticated' });
    }
    expect(byId(await list(app, cookie), task.id)).toEqual(task);
  });
});

describe('DELETE /api/tasks/:id', () => {
  test('list/done-delete · C34 · answers 204 with no body and the task is gone for good', async () => {
    const { app, cookie, task, other } = await setup();

    const res = await remove(app, task.id, cookie);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(await list(app, cookie)).toEqual([other]);

    expect((await remove(app, task.id, cookie)).status).toBe(404);
    expect(await list(app, cookie)).toEqual([other]);
  });

  test("list/done-delete · C34 · another user's task answers 404 and is not deleted", async () => {
    const { app, signIn, cookie, task } = await setup();
    const stranger = await signIn('binh@example.com');

    const res = await remove(app, task.id, stranger);
    expect(res.status).toBe(404);
    expect(byId(await list(app, cookie), task.id)).toEqual(task);
    // the route is there: the owner gets 204
    expect((await remove(app, task.id, cookie)).status).toBe(204);
  });

  test('list/done-delete · C34 · an unknown id answers 404 and deletes nothing', async () => {
    const { app, cookie, task } = await setup();
    const before = await list(app, cookie);

    const res = await remove(app, 'no-such-task', cookie);
    expect(res.status).toBe(404);
    expect(await list(app, cookie)).toEqual(before);
    // the route is there: a known id gets 204
    expect((await remove(app, task.id, cookie)).status).toBe(204);
  });

  test('list/done-delete · C34 · without a session, or with an unknown one, answers 401 and deletes nothing', async () => {
    const { app, cookie, task } = await setup();

    for (const session of [undefined, 'sid=not-a-session']) {
      const res = await remove(app, task.id, session);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'unauthenticated' });
    }
    expect(byId(await list(app, cookie), task.id)).toEqual(task);
  });
});

// @vitest-environment node
// PATCH /api/tasks/:id, through testApp() (C49).
import { describe, expect, test } from 'vitest';
import { testApp } from '../../../../../server/testing';
import type { Task } from '../../../../shared/tasks/types';

type Ctx = ReturnType<typeof testApp>;

const DUE = '2026-11-28T01:00:00.000Z';
const NEW_DUE = '2026-12-05T13:00:00.000Z';
const CREATED = '2026-11-27T03:00:00.000Z';

const patchRaw = (app: Ctx['app'], id: string, body: string, cookie?: string) =>
  app.request(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body,
  });

const patch = (app: Ctx['app'], id: string, body: unknown, cookie?: string) => patchRaw(app, id, JSON.stringify(body), cookie);

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

async function expectOk(res: Response, expected: Task) {
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual(expected);
}

describe('PATCH /api/tasks/:id', () => {
  test('list/edit-task · C49 · title and dueAt answer 200 with the Task, which is stored', async () => {
    const { app, cookie, task, other } = await setup();
    const expected = { ...task, title: 'Gửi lại hợp đồng', dueAt: NEW_DUE };
    await expectOk(await patch(app, task.id, { title: 'Gửi lại hợp đồng', dueAt: NEW_DUE }, cookie), expected);
    expect(byId(await list(app, cookie), task.id)).toEqual(expected);
    expect(byId(await list(app, cookie), other.id)).toEqual(other);
  });

  test('list/edit-task · C49 · title alone keeps the due; dueAt alone keeps the title; dueAt null removes the due', async () => {
    const { app, cookie, task } = await setup();
    await expectOk(await patch(app, task.id, { title: 'Tên mới' }, cookie), { ...task, title: 'Tên mới' });
    await expectOk(await patch(app, task.id, { dueAt: NEW_DUE }, cookie), { ...task, title: 'Tên mới', dueAt: NEW_DUE });
    await expectOk(await patch(app, task.id, { dueAt: null }, cookie), { ...task, title: 'Tên mới', dueAt: null });
    expect(byId(await list(app, cookie), task.id)).toEqual({ ...task, title: 'Tên mới', dueAt: null });
  });

  test('list/edit-task · C49 · the title is stored as validateTitle returns it: line breaks to spaces, then trimmed', async () => {
    const { app, cookie, task } = await setup();
    await expectOk(await patch(app, task.id, { title: '  Gọi cho\r\nanh\nTuấn  ' }, cookie), {
      ...task,
      title: 'Gọi cho anh Tuấn',
    });
    expect(byId(await list(app, cookie), task.id)?.title).toBe('Gọi cho anh Tuấn');
  });

  test('list/edit-task · C49 · a title of 200 characters is accepted', async () => {
    const { app, cookie, task } = await setup();
    const title = 'a'.repeat(200);
    await expectOk(await patch(app, task.id, { title }, cookie), { ...task, title });
  });

  test.each([
    ['empty', ''],
    ['only spaces and line breaks', ' \n '],
    ['201 characters', 'a'.repeat(201)],
    ['a number', 5],
    ['null', null],
  ])('list/edit-task · C49 · a title that is %s answers 400 invalid_title and changes nothing', async (_name, title) => {
    const { app, cookie, task } = await setup();
    const res = await patch(app, task.id, { title, dueAt: NEW_DUE }, cookie);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_title' });
    expect(byId(await list(app, cookie), task.id)).toEqual(task);
  });

  test.each([
    ['a date without a time', '2026-12-05'],
    ['without a zone', '2026-12-05T13:00:00'],
    ['the form’s text', '05/12/2026'],
    ['an empty string', ''],
    ['a number', 1_796_000_000_000],
  ])('list/edit-task · C49 · a dueAt that is %s answers 400 invalid_due and changes nothing', async (_name, dueAt) => {
    const { app, cookie, task } = await setup();
    const res = await patch(app, task.id, { title: 'Tên mới', dueAt }, cookie);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_due' });
    expect(byId(await list(app, cookie), task.id)).toEqual(task);
  });

  test.each([
    ['an empty object', '{}'],
    ['only other fields', '{"done":true,"createdAt":"2020-01-01T00:00:00.000Z"}'],
    ['null', 'null'],
    ['not JSON', 'title=x'],
    ['empty', ''],
  ])('list/edit-task · C49 · a body that is %s answers 400 invalid_body and changes nothing', async (_name, body) => {
    const { app, cookie, task } = await setup();
    const res = await patchRaw(app, task.id, body, cookie);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_body' });
    expect(byId(await list(app, cookie), task.id)).toEqual(task);
  });

  test('list/edit-task · C49 · other fields beside title are ignored', async () => {
    const { app, cookie, task } = await setup();
    const body = { title: 'Tên mới', done: true, id: 'x', createdAt: '2020-01-01T00:00:00.000Z' };
    await expectOk(await patch(app, task.id, body, cookie), { ...task, title: 'Tên mới' });
    expect(byId(await list(app, cookie), task.id)).toEqual({ ...task, title: 'Tên mới' });
  });

  test("list/edit-task · C49 · another user's task and an unknown id answer 404 and change nothing", async () => {
    const { app, signIn, cookie, task } = await setup();
    const stranger = await signIn('binh@example.com');
    const before = await list(app, cookie);

    expect((await patch(app, task.id, { title: 'Chiếm' }, stranger)).status).toBe(404);
    expect((await patch(app, 'no-such-task', { title: 'Chiếm' }, cookie)).status).toBe(404);
    expect(await list(app, cookie)).toEqual(before);
    expect(await list(app, stranger)).toEqual([]);
    // the route is there: the owner gets 200
    expect((await patch(app, task.id, { title: 'Của tôi' }, cookie)).status).toBe(200);
  });

  test('list/edit-task · C49 · without a session, or with an unknown one, answers 401 and changes nothing', async () => {
    const { app, cookie, task } = await setup();
    for (const session of [undefined, 'sid=not-a-session']) {
      const res = await patch(app, task.id, { title: 'Chiếm' }, session);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'unauthenticated' });
    }
    expect(byId(await list(app, cookie), task.id)).toEqual(task);
  });
});

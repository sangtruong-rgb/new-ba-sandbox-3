// @vitest-environment node
// POST /api/tasks (ticket #5, C29), on the app with the features found on disk.
import { describe, expect, test } from 'vitest';
import { testApp } from '../../../../../server/testing';
import type { Task } from '../../../../shared/tasks/types';

type App = ReturnType<typeof testApp>['app'];

const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DUE = '2026-11-28T02:30:00.000Z';

async function post(app: App, body: unknown, cookie?: string) {
  return app.request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

async function listOf(app: App, cookie: string): Promise<Task[]> {
  const res = await app.request('/api/tasks', { headers: { Cookie: cookie } });
  expect(res.status).toBe(200);
  return (await res.json()) as Task[];
}

async function signedIn() {
  const t = testApp();
  const cookie = await t.signIn('thu.ha@example.com');
  return { app: t.app, signIn: t.signIn, cookie };
}

describe('list/add-task · POST /api/tasks', () => {
  test('list/add-task · C29 · answers 201 with the new Task, not done, with the due that was sent', async () => {
    const { app, cookie } = await signedIn();
    const res = await post(app, { title: 'Mua thuốc huyết áp cho bố', dueAt: DUE }, cookie);
    expect(res.status).toBe(201);
    const task = (await res.json()) as Task;
    expect(task).toEqual({
      id: expect.any(String),
      title: 'Mua thuốc huyết áp cho bố',
      done: false,
      dueAt: DUE,
      createdAt: expect.stringMatching(ISO_MS),
    });
    expect(task.id).not.toBe('');
    expect(await listOf(app, cookie)).toEqual([task]);
  });

  test("list/add-task · C29 · the task belongs to the session's user only", async () => {
    const { app, signIn, cookie } = await signedIn();
    const other = await signIn('an@example.com');
    const res = await post(app, { title: 'Rửa xe', dueAt: null }, other);
    expect(res.status).toBe(201);
    expect((await listOf(app, other)).map((t) => t.title)).toEqual(['Rửa xe']);
    expect(await listOf(app, cookie)).toEqual([]);
  });

  test('list/add-task · C29 · the title is stored as validateTitle returns it: line breaks become spaces, then trimmed', async () => {
    const { app, cookie } = await signedIn();
    const res = await post(app, { title: '  Mua sữa\ncho bé Bin \r\n', dueAt: null }, cookie);
    expect(res.status).toBe(201);
    expect(((await res.json()) as Task).title).toBe('Mua sữa cho bé Bin');
    expect((await listOf(app, cookie)).map((t) => t.title)).toEqual(['Mua sữa cho bé Bin']);
  });

  test('list/add-task · C29 · a title of 200 characters is accepted', async () => {
    const { app, cookie } = await signedIn();
    const title = 'ă'.repeat(200);
    const res = await post(app, { title: `  ${title}  `, dueAt: null }, cookie);
    expect(res.status).toBe(201);
    expect(((await res.json()) as Task).title).toBe(title);
  });

  test('list/add-task · C29 · dueAt null and a missing dueAt both give a task with no due date', async () => {
    const { app, cookie } = await signedIn();
    for (const body of [{ title: 'Có null', dueAt: null }, { title: 'Không gửi dueAt' }]) {
      const res = await post(app, body, cookie);
      expect(res.status).toBe(201);
      expect(((await res.json()) as Task).dueAt).toBeNull();
    }
    expect((await listOf(app, cookie)).map((t) => t.dueAt)).toEqual([null, null]);
  });

  test('list/add-task · C29 · a dueAt with a ±hh:mm offset is accepted', async () => {
    const { app, cookie } = await signedIn();
    const res = await post(app, { title: 'Họp nhóm', dueAt: '2026-11-28T09:30:00+07:00' }, cookie);
    expect(res.status).toBe(201);
    const task = (await res.json()) as Task;
    expect(Date.parse(task.dueAt as string)).toBe(Date.parse(DUE));
  });

  test.each([
    ['empty', { title: '', dueAt: null }],
    ['only spaces', { title: '   ', dueAt: null }],
    ['only line breaks', { title: '\n\r\n', dueAt: null }],
    ['over 200 characters', { title: 'a'.repeat(201), dueAt: null }],
    ['missing', { dueAt: null }],
    ['not a string', { title: 42, dueAt: null }],
  ])('list/add-task · C29 · a title that is %s answers 400 invalid_title and creates nothing', async (_name, body) => {
    const { app, cookie } = await signedIn();
    const res = await post(app, body, cookie);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_title' });
    expect(await listOf(app, cookie)).toEqual([]);
  });

  test.each([
    ['a word', 'ngày mai'],
    ['a date without a time', '2026-11-28'],
    ['a date-time without a zone', '2026-11-28T09:30:00'],
    ['a number', 1795858200000],
    ['an empty string', ''],
  ])('list/add-task · C29 · a dueAt that is %s answers 400 invalid_due and creates nothing', async (_name, dueAt) => {
    const { app, cookie } = await signedIn();
    const res = await post(app, { title: 'Rửa xe', dueAt }, cookie);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_due' });
    expect(await listOf(app, cookie)).toEqual([]);
  });

  test('list/add-task · C29 · without a session, or with an unknown one, answers 401 and creates nothing', async () => {
    const { app, cookie } = await signedIn();
    for (const bad of [undefined, 'sid=khong-co-phien-nay']) {
      const res = await post(app, { title: 'Rửa xe', dueAt: null }, bad);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'unauthenticated' });
    }
    expect(await listOf(app, cookie)).toEqual([]);
  });
});

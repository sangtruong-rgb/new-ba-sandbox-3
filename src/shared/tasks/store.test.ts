// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { taskStore } from './store';
import type { Task } from './types';

const task = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  title: `Việc ${id}`,
  done: false,
  dueAt: null,
  createdAt: '2026-11-27T03:20:00.000Z',
  ...over,
});

let answer: () => Response;
const requests: string[] = [];

beforeEach(() => {
  requests.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      requests.push(`${init.method ?? 'GET'} ${new URL(url, 'http://localhost').pathname}`);
      return Promise.resolve(answer());
    }),
  );
  taskStore.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const byId = (list: Task[]) => [...list].sort((a, b) => (a.id < b.id ? -1 : 1));

describe('taskStore', () => {
  test('C6 · load() gets GET /api/tasks and replaces the content', async () => {
    taskStore.upsert(task('old'));
    answer = () => new Response(JSON.stringify([task('a'), task('b', { done: true })]), { status: 200 });
    await taskStore.load();
    expect(requests).toEqual(['GET /api/tasks']);
    expect(byId(taskStore.all())).toEqual([task('a'), task('b', { done: true })]);

    answer = () => new Response(JSON.stringify([task('c')]), { status: 200 });
    await taskStore.load();
    expect(taskStore.all()).toEqual([task('c')]);
  });

  test('C6 · load() rejects when the server fails', async () => {
    answer = () => new Response(JSON.stringify({ error: 'boom' }), { status: 500 });
    await expect(taskStore.load()).rejects.toBeTruthy();
  });

  test('C6 · upsert adds a new task and replaces one with the same id', () => {
    taskStore.upsert(task('a'));
    taskStore.upsert(task('b'));
    taskStore.upsert(task('a', { title: 'Rửa xe máy', done: true }));
    expect(byId(taskStore.all())).toEqual([task('a', { title: 'Rửa xe máy', done: true }), task('b')]);
  });

  test('C6 · remove drops the task with that id', () => {
    taskStore.upsert(task('a'));
    taskStore.upsert(task('b'));
    taskStore.remove('a');
    expect(taskStore.all()).toEqual([task('b')]);
    taskStore.remove('khong-co');
    expect(taskStore.all()).toEqual([task('b')]);
  });

  test('C6 · clear empties the store', () => {
    taskStore.upsert(task('a'));
    taskStore.clear();
    expect(taskStore.all()).toEqual([]);
  });

  test('C6 · subscribers hear every change until they unsubscribe', async () => {
    const fn = vi.fn();
    const off = taskStore.subscribe(fn);
    taskStore.upsert(task('a'));
    expect(fn).toHaveBeenCalledTimes(1);
    taskStore.remove('a');
    expect(fn).toHaveBeenCalledTimes(2);
    answer = () => new Response(JSON.stringify([task('b')]), { status: 200 });
    await taskStore.load();
    expect(fn).toHaveBeenCalledTimes(3);
    taskStore.clear();
    expect(fn).toHaveBeenCalledTimes(4);
    off();
    taskStore.upsert(task('c'));
    expect(fn).toHaveBeenCalledTimes(4);
  });
});

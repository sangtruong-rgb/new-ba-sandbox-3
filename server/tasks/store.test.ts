// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { createApp } from '../app';
import { tasks } from './store';
import { captureDeps, ISO_MS } from '../__tests__/probe';
import { testApp } from '../testing';

function setup() {
  const probe = captureDeps();
  createApp({ databasePath: ':memory:', features: [probe.feature] });
  const deps = probe.deps();
  const an = deps.users.create('an@example.com', 'mat-khau-dai');
  const binh = deps.users.create('binh@example.com', 'mat-khau-dai');
  return { store: tasks(deps.db), an, binh };
}

describe('server/tasks/store', () => {
  test('C2 · create returns a Task with done false, the given title and dueAt, and an ISO createdAt with milliseconds', () => {
    const { store, an } = setup();
    const t = store.create(an.id, { title: 'Mua thuốc huyết áp cho bố', dueAt: '2026-11-27T10:00:00.000Z' });
    expect(Object.keys(t).sort()).toEqual(['createdAt', 'done', 'dueAt', 'id', 'title']);
    expect(t).toMatchObject({ title: 'Mua thuốc huyết áp cho bố', done: false, dueAt: '2026-11-27T10:00:00.000Z' });
    expect(typeof t.id).toBe('string');
    expect(t.createdAt).toMatch(ISO_MS);
    const noDue = store.create(an.id, { title: 'Học xong bài 7 tiếng Nhật', dueAt: null });
    expect(noDue.dueAt).toBeNull();
    expect(noDue.id).not.toBe(t.id);
  });

  test('C2 · the store validates nothing: an empty title is stored as given', () => {
    const { store, an } = setup();
    const t = store.create(an.id, { title: '', dueAt: null });
    expect(store.list(an.id).map((x) => x.id)).toEqual([t.id]);
    expect(store.list(an.id)[0].title).toBe('');
  });

  test("C2 · list gives only the given user's tasks, newest createdAt first, ties by id", async () => {
    const probe = captureDeps();
    const t = testApp({ features: [probe.feature] });
    const an = await t.signIn('an@example.com');
    const binh = await t.signIn('binh@example.com');
    const seeded = await t.seedTasks(an, [
      { title: 'a', createdAt: '2026-11-20T02:12:00.000Z' },
      { title: 'b', createdAt: '2026-11-25T00:40:00.000Z' },
      { title: 'c', createdAt: '2026-11-25T00:40:00.000Z' },
      { title: 'd', createdAt: '2026-11-26T16:01:00.000Z' },
    ]);
    await t.seedTasks(binh, [{ title: 'của Bình', createdAt: '2026-11-27T00:00:00.000Z' }]);
    const byTitle = Object.fromEntries(seeded.map((x) => [x.title, x]));
    const me = (await (await t.app.request('/api/me', { headers: { Cookie: an } })).json()) as { id: string };
    const other = (await (await t.app.request('/api/me', { headers: { Cookie: binh } })).json()) as { id: string };

    const store = tasks(probe.deps().db);
    const tied = [byTitle.b.id, byTitle.c.id].sort();
    expect(store.list(me.id).map((x) => x.id)).toEqual([byTitle.d.id, ...tied, byTitle.a.id]);
    expect(store.list(me.id)[0].createdAt).toBe('2026-11-26T16:01:00.000Z');
    expect(store.list(other.id).map((x) => x.title)).toEqual(['của Bình']);

    // GET /api/tasks answers in the same order.
    const res = await t.app.request('/api/tasks', { headers: { Cookie: an } });
    const listed = (await res.json()) as Array<{ id: string }>;
    expect(listed.map((x) => x.id)).toEqual([byTitle.d.id, ...tied, byTitle.a.id]);
  });

  test('C2 · update changes title, done and dueAt of the user\'s own task and returns it', () => {
    const { store, an } = setup();
    const t = store.create(an.id, { title: 'Rửa xe', dueAt: null });
    const u1 = store.update(an.id, t.id, { done: true });
    expect(u1).toEqual({ ...t, done: true });
    const u2 = store.update(an.id, t.id, { title: 'Rửa xe máy', dueAt: '2026-11-28T04:00:00.000Z' });
    expect(u2).toEqual({ ...t, done: true, title: 'Rửa xe máy', dueAt: '2026-11-28T04:00:00.000Z' });
    const u3 = store.update(an.id, t.id, { dueAt: null, done: false });
    expect(u3).toEqual({ ...t, title: 'Rửa xe máy', dueAt: null, done: false });
    expect(store.list(an.id)).toEqual([u3]);
  });

  test('C2 · update answers null for an unknown id', () => {
    const { store, an } = setup();
    expect(store.update(an.id, 'khong-co', { done: true })).toBeNull();
  });

  test('C2 · remove deletes the user\'s own task and answers true, then false', () => {
    const { store, an } = setup();
    const t = store.create(an.id, { title: 'Rửa xe', dueAt: null });
    expect(store.remove(an.id, t.id)).toBe(true);
    expect(store.list(an.id)).toEqual([]);
    expect(store.remove(an.id, t.id)).toBe(false);
  });

  test('C2 · no store method reads or changes another user\'s task', () => {
    const { store, an, binh } = setup();
    const mine = store.create(an.id, { title: 'Gửi hợp đồng thuê nhà', dueAt: null });

    expect(store.list(binh.id)).toEqual([]);
    expect(store.update(binh.id, mine.id, { title: 'đã sửa', done: true, dueAt: '2026-12-01T00:00:00.000Z' })).toBeNull();
    expect(store.remove(binh.id, mine.id)).toBe(false);

    expect(store.list(an.id)).toEqual([mine]);
  });
});

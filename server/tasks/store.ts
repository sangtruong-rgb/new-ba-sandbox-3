// TaskStore: every method works on the given user's tasks only, and validates nothing.
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { Task, TaskStoreApi } from '../types';

type Row = { id: string; title: string; done: number; due_at: string | null; created_at: string };

const toTask = (r: Row): Task => ({ id: r.id, title: r.title, done: r.done === 1, dueAt: r.due_at, createdAt: r.created_at });

export function tasks(db: Database.Database): TaskStoreApi {
  const one = db.prepare<[string, string], Row>(
    'SELECT id, title, done, due_at, created_at FROM tasks WHERE id = ? AND user_id = ?',
  );
  return {
    list(userId) {
      const rows = db
        .prepare<[string], Row>(
          'SELECT id, title, done, due_at, created_at FROM tasks WHERE user_id = ? ORDER BY created_at DESC, id ASC',
        )
        .all(userId);
      return rows.map(toTask);
    },
    create(userId, { title, dueAt }) {
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      db.prepare('INSERT INTO tasks (id, user_id, title, done, due_at, created_at) VALUES (?, ?, ?, 0, ?, ?)').run(
        id,
        userId,
        title,
        dueAt,
        createdAt,
      );
      return { id, title, done: false, dueAt, createdAt };
    },
    update(userId, id, patch) {
      const row = one.get(id, userId);
      if (!row) return null;
      const next = { ...toTask(row), ...pick(patch) };
      db.prepare('UPDATE tasks SET title = ?, done = ?, due_at = ? WHERE id = ? AND user_id = ?').run(
        next.title,
        next.done ? 1 : 0,
        next.dueAt,
        id,
        userId,
      );
      return next;
    },
    remove(userId, id) {
      return db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
    },
  };
}

function pick(patch: Partial<Pick<Task, 'title' | 'done' | 'dueAt'>>): Partial<Task> {
  const out: Partial<Task> = {};
  if (patch.title !== undefined) out.title = patch.title;
  if (patch.done !== undefined) out.done = patch.done;
  if (patch.dueAt !== undefined) out.dueAt = patch.dueAt;
  return out;
}

// TaskStoreWeb: the one client copy of the user's tasks. Features change it only
// after the server answered.
import { api } from '../api';
import type { Task } from './types';

let items: Task[] = [];
const listeners = new Set<() => void>();

function set(next: Task[]) {
  items = next;
  for (const fn of [...listeners]) fn();
}

export const taskStore = {
  all(): Task[] {
    return items;
  },
  async load(): Promise<void> {
    const list = await api<Task[]>('GET', '/api/tasks');
    set(Array.isArray(list) ? list : []);
  },
  clear(): void {
    set([]);
  },
  upsert(task: Task): void {
    const i = items.findIndex((t) => t.id === task.id);
    set(i === -1 ? [...items, task] : items.map((t, j) => (j === i ? task : t)));
  },
  remove(id: string): void {
    set(items.filter((t) => t.id !== id));
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

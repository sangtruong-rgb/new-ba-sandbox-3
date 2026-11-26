// The due rules of the list: what is late, what is still due today, and the order.
import type { Task } from '../../../../shared/tasks/types';

/** Not done, and due at or before now (which the clock has cut to the minute). */
export function isLate(t: Task, now: Date): boolean {
  return !t.done && t.dueAt !== null && Date.parse(t.dueAt) <= now.getTime();
}

/** Not done, not late yet, and due on the device's local day of now. */
export function isDueLaterToday(t: Task, now: Date): boolean {
  if (t.done || t.dueAt === null || isLate(t, now)) return false;
  return new Date(t.dueAt).toDateString() === now.toDateString();
}

/** 0: not done with a due date; 1: not done without one; 2: done. */
const group = (t: Task) => (t.done ? 2 : t.dueAt === null ? 1 : 0);

export function compareByDue(a: Task, b: Task): number {
  return (
    group(a) - group(b) ||
    (group(a) === 0 ? Date.parse(a.dueAt!) - Date.parse(b.dueAt!) : 0) ||
    Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

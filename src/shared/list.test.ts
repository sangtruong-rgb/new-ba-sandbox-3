// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
import { setFilter, setOrder, setTone, toneOf, useSelection } from './list';
import { setNow } from './time';
import type { Task } from './tasks/types';

const task = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  title: `Việc ${id}`,
  done: false,
  dueAt: null,
  createdAt: '2026-11-27T03:20:00.000Z',
  ...over,
});

afterEach(() => {
  setNow(null);
});

describe('ListView', () => {
  test('C6 · list.ts exports setOrder, setTone, setFilter, toneOf and useSelection', () => {
    for (const fn of [setOrder, setTone, setFilter, toneOf, useSelection]) expect(typeof fn).toBe('function');
  });

  test("C6 · by default every row's tone is 'normal'", () => {
    setNow(() => new Date(2026, 10, 27, 10, 20));
    expect(toneOf(task('a', { dueAt: new Date(2026, 10, 26, 16, 30).toISOString() }))).toBe('normal');
    expect(toneOf(task('b'))).toBe('normal');
  });

  test('C6 · toneOf gives the tone set by setTone at now(); a later setTone replaces it', () => {
    const at = new Date(2026, 10, 27, 10, 20);
    setNow(() => at);
    const seen: number[] = [];
    setTone((t, now) => {
      seen.push(now.getTime());
      return !t.done && t.dueAt !== null && new Date(t.dueAt) <= now ? 'late' : 'normal';
    });
    const overdue = task('a', { dueAt: new Date(2026, 10, 26, 16, 30).toISOString() });
    const later = task('b', { dueAt: new Date(2026, 10, 27, 17, 0).toISOString() });
    expect(toneOf(overdue)).toBe('late');
    expect(toneOf(later)).toBe('normal');
    expect(seen.every((t) => t === at.getTime())).toBe(true);

    setNow(() => new Date(2026, 10, 27, 17, 0));
    expect(toneOf(later)).toBe('late');

    setTone(() => 'normal');
    expect(toneOf(overdue)).toBe('normal');
  });
});

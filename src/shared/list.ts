// ListView: how the list orders, tones and filters its rows, and which task is selected.
import { useSyncExternalStore } from 'react';
import { now } from './time';
import { taskStore } from './tasks/store';
import type { Task } from './tasks/types';

export type Compare = (a: Task, b: Task, now: Date) => number;
export type Tone = (t: Task, now: Date) => 'late' | 'normal';
export type Filter = { id: string; test(t: Task): boolean; emptyText: string };

const newestFirst: Compare = (a, b) =>
  a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

type Settings = { order: Compare; tone: Tone; filter: Filter };

let settings: Settings = {
  order: newestFirst,
  tone: () => 'normal',
  filter: { id: 'all', test: () => true, emptyText: 'Không có việc nào ở đây.' },
};
const settingsListeners = new Set<() => void>();

function update(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  for (const fn of [...settingsListeners]) fn();
}

export function setOrder(compare: Compare): void {
  update({ order: compare });
}

export function setTone(tone: Tone): void {
  update({ tone });
}

export function setFilter(f: Filter): void {
  update({ filter: f });
}

/** The current tone of a task at now(). */
export function toneOf(t: Task): 'late' | 'normal' {
  return settings.tone(t, now());
}

/** The order, tone and filter, re-rendering on each set* call (used by the list page). */
export function useListSettings(): Settings {
  return useSyncExternalStore(
    (fn) => {
      settingsListeners.add(fn);
      return () => {
        settingsListeners.delete(fn);
      };
    },
    () => settings,
  );
}

// ---- selection ----

let selectedId: string | null = null;
const selectionListeners = new Set<() => void>();

function select(id: string | null): void {
  if (id === selectedId) return;
  selectedId = id;
  for (const fn of [...selectionListeners]) fn();
}

// The selection clears when its task leaves the store; it stays when the task stops passing the filter.
taskStore.subscribe(() => {
  if (selectedId !== null && !taskStore.all().some((t) => t.id === selectedId)) select(null);
});

export function useSelection(): { selectedId: string | null; select(id: string | null): void } {
  const id = useSyncExternalStore(
    (fn) => {
      selectionListeners.add(fn);
      return () => {
        selectionListeners.delete(fn);
      };
    },
    () => selectedId,
  );
  return { selectedId: id, select };
}

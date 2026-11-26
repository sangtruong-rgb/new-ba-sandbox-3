// One change to one task: the store follows only what the server answered.
import { useSyncExternalStore } from 'react';
import { createLogger } from '../../../../app/log';
import { api, ApiError } from '../../../../shared/api';
import { taskStore } from '../../../../shared/tasks/store';
import type { Task } from '../../../../shared/tasks/types';

const FAILED = 'Không lưu được. Thử lại.';
const log = createLogger('[list/done-delete]');

// Tasks with a request running. Kept outside the components: they remount when the selection changes.
const pending = new Set<string>();
const listeners = new Set<() => void>();

function setPending(id: string, on: boolean) {
  if (on) pending.add(id);
  else pending.delete(id);
  for (const fn of [...listeners]) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function usePending(id: string): boolean {
  return useSyncExternalStore(subscribe, () => pending.has(id));
}

type ShowMessage = (text: string | null) => void;

/** Runs the request; `gone` runs when the task no longer exists (deleted here or on another device). */
async function change(id: string, showMessage: ShowMessage, request: () => Promise<void>, gone: () => void) {
  showMessage(null);
  setPending(id, true);
  try {
    await request();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) gone();
    // A 401 is the session's business: the api client has already left the page.
    else if (!(error instanceof ApiError && error.status === 401)) {
      log.error(error);
      showMessage(FAILED);
    }
  } finally {
    setPending(id, false);
  }
}

export function toggleDone(task: Task, showMessage: ShowMessage, gone = () => taskStore.remove(task.id)) {
  return change(
    task.id,
    showMessage,
    async () => {
      taskStore.upsert(await api<Task>('POST', `/api/tasks/${task.id}/done`, { done: !task.done }));
    },
    gone,
  );
}

export function deleteTask(task: Task, showMessage: ShowMessage, gone: () => void) {
  return change(
    task.id,
    showMessage,
    async () => {
      await api('DELETE', `/api/tasks/${task.id}`);
      gone();
    },
    gone,
  );
}

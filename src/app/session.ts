// Session: who is signed in, loaded once from GET /api/me at start.
// Whenever a user appears, the session loads the task store. The gate in App.tsx reads it.
import { useMemo, useSyncExternalStore } from 'react';
import { api, configureApi } from '../shared/api';
import { taskStore } from '../shared/tasks/store';
import type { User } from '../shared/tasks/types';

/** 'pending': the first load after a sign-in; 'reloading': "Thử lại" after a failure. */
export type LoadState = 'idle' | 'pending' | 'ok' | 'failed' | 'reloading';

export type SessionState = {
  user: User | null;
  status: 'loading' | 'ready';
  load: LoadState;
  /** The session ended on a 401 while a user was in it. */
  expired: boolean;
};

let state: SessionState = { user: null, status: 'loading', load: 'idle', expired: false };
let generation = 0;
const listeners = new Set<() => void>();

function set(patch: Partial<SessionState>) {
  state = { ...state, ...patch };
  for (const fn of [...listeners]) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

async function loadTasks(gen: number) {
  try {
    await taskStore.load();
    if (gen === generation) set({ load: 'ok' });
  } catch {
    if (gen === generation && state.user) set({ load: 'failed' });
  }
}

async function fetchUser(gen: number): Promise<void> {
  let user: User | null = null;
  try {
    user = await api<User>('GET', '/api/me');
  } catch {
    user = null;
  }
  if (gen !== generation) return;
  if (!user) {
    set({ user: null, status: 'ready', load: 'idle' });
    return;
  }
  set({ user: { id: user.id, email: user.email }, status: 'ready', load: 'pending', expired: false });
  await loadTasks(gen);
}

function end(expired: boolean) {
  generation += 1;
  set({ user: null, status: 'ready', load: 'idle', expired });
  // emptying the store also clears the selection (src/shared/list.ts)
  taskStore.clear();
}

configureApi({ hasUser: () => state.user !== null, onUnauthenticated: () => end(true) });

/** Starts the session of a newly mounted app: nobody yet, then GET /api/me. */
export function initSession(): void {
  generation += 1;
  state = { user: null, status: 'loading', load: 'idle', expired: false };
  // emptying the store also clears the selection (src/shared/list.ts)
  taskStore.clear();
  for (const fn of [...listeners]) fn();
  void fetchUser(generation);
}

export function refresh(): Promise<void> {
  generation += 1;
  return fetchUser(generation);
}

export function clear(): void {
  end(false);
}

/** "Thử lại" after a failed load: the slots stay mounted. */
export function reloadTasks(): Promise<void> {
  if (!state.user) return Promise.resolve();
  set({ load: 'reloading' });
  return loadTasks(generation);
}

/** The whole session state, for the app's gate and the list page frame. */
export function useSessionState(): SessionState {
  return useSyncExternalStore(subscribe, () => state);
}

export function useSession(): {
  user: User | null;
  status: 'loading' | 'ready';
  refresh(): Promise<void>;
  clear(): void;
} {
  const s = useSyncExternalStore(subscribe, () => state);
  return useMemo(() => ({ user: s.user, status: s.status, refresh, clear }), [s.user, s.status]);
}

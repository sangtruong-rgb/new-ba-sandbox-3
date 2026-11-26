// Test helpers for the server tests of ticket #2. Not production code.
import type Database from 'better-sqlite3';
import type { ServerFeature } from '../types';

export type Deps = Parameters<ServerFeature['register']>[1];

/**
 * A fake feature that registers nothing on its own and keeps the deps that
 * createApp hands to register(), so a test can reach db, users, tasks and the
 * session helpers exactly as a real feature would.
 */
export function captureDeps(
  id = 'probe',
  extra?: (app: Parameters<ServerFeature['register']>[0], deps: Deps) => void,
  routes: ServerFeature['routes'] = [],
): { feature: ServerFeature; deps(): Deps; db(): Database.Database } {
  let captured: Deps | undefined;
  const feature: ServerFeature = {
    id,
    routes,
    register(app, deps) {
      captured = deps;
      extra?.(app, deps);
    },
  };
  return {
    feature,
    deps() {
      if (!captured) throw new Error('register() was not called');
      return captured;
    },
    db() {
      if (!captured) throw new Error('register() was not called');
      return captured.db as unknown as Database.Database;
    },
  };
}

/** The `sid=<value>` pair of a response's Set-Cookie headers, or null. */
export function sidCookie(res: Response): string | null {
  const all = res.headers.getSetCookie();
  for (const line of all) {
    const pair = line.split(';')[0].trim();
    if (pair.startsWith('sid=')) return pair;
  }
  return null;
}

/** The whole Set-Cookie line that sets sid, or null. */
export function sidSetCookieLine(res: Response): string | null {
  return res.headers.getSetCookie().find((l) => l.trim().startsWith('sid=')) ?? null;
}

export function json(body: unknown, cookie?: string): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  };
}

export const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// Sessions: a random sid cookie naming a sessions row, valid for 30 days on the server's clock.
import type Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv, User, UserStoreApi } from '../types';

export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
const COOKIE = 'sid';

/** What the session helpers need from the app handling the request. */
export type SessionContext = { db: Database.Database; users: UserStoreApi; now: () => Date };

const contexts = new WeakMap<Context, SessionContext>();

/** Middleware createApp installs first, so the helpers below find the app's database and clock. */
export function bindSessions(ctx: SessionContext): MiddlewareHandler {
  return async (c, next) => {
    contexts.set(c, ctx);
    await next();
  };
}

function ctxOf(c: Context): SessionContext {
  const ctx = contexts.get(c);
  if (!ctx) throw new Error('sessions: the request did not go through createApp');
  return ctx;
}

export function startSession(c: Context, userId: string): void {
  const { db, now } = ctxOf(c);
  const sid = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (id, user_id, created_at) VALUES (?, ?, ?)').run(sid, userId, now().getTime());
  setCookie(c, COOKIE, sid, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: SESSION_DAYS * 24 * 60 * 60 });
}

export function endSession(c: Context): void {
  const { db } = ctxOf(c);
  const sid = getCookie(c, COOKIE);
  if (!sid) return;
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sid);
  deleteCookie(c, COOKIE, { path: '/', httpOnly: true, sameSite: 'Lax' });
}

/** The user of the request's session, or null when the cookie is missing, unknown or expired. */
export function sessionUser(c: Context): User | null {
  const { db, users, now } = ctxOf(c);
  const sid = getCookie(c, COOKIE);
  if (!sid) return null;
  const row = db.prepare<[string], { user_id: string; created_at: number }>(
    'SELECT user_id, created_at FROM sessions WHERE id = ?',
  ).get(sid);
  if (!row) return null;
  if (now().getTime() - row.created_at >= SESSION_MS) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sid);
    return null;
  }
  return users.byId(row.user_id);
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = sessionUser(c);
  if (!user) return c.json({ error: 'unauthenticated' }, 401);
  c.set('user', user);
  await next();
};

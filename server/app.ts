// The server: Hono on SQLite, serving only /api/*.
// Lifecycle at createApp: the tables users, sessions and tasks are created if missing,
// then the core routes (GET /api/me, GET /api/tasks, and the test endpoints when
// NODE_ENV=test), then every feature's register() in alphabetical order of id.
import type { Hono } from 'hono';
import { buildApp, type CreateAppOptions } from './core';
import type { AppEnv } from './types';

export function createApp(opts: CreateAppOptions = {}): Hono<AppEnv> {
  return buildApp(opts, { testEndpoints: process.env.NODE_ENV === 'test' });
}

export default createApp({ databasePath: process.env.DATABASE_PATH ?? 'data/todo.sqlite' });

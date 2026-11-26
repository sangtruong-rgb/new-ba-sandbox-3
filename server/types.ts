// Shapes shared by the server, its features and their tests.
import type Database from 'better-sqlite3';
import type { Context, Hono, MiddlewareHandler } from 'hono';

/** The same shapes as src/shared/tasks/types.ts. Times are ISO 8601 UTC. */
export type Task = { id: string; title: string; done: boolean; dueAt: string | null; createdAt: string };
export type User = { id: string; email: string };

export type AppEnv = { Variables: { user: User } };

export type UserStoreApi = {
  create(email: string, password: string): User;
  verify(email: string, password: string): User | null;
  byId(id: string): User | null;
};

export type TaskStoreApi = {
  list(userId: string): Task[];
  create(userId: string, input: { title: string; dueAt: string | null }): Task;
  update(userId: string, id: string, patch: Partial<Pick<Task, 'title' | 'done' | 'dueAt'>>): Task | null;
  remove(userId: string, id: string): boolean;
};

export type ServerDeps = {
  db: Database.Database;
  users: UserStoreApi;
  tasks: TaskStoreApi;
  startSession(c: Context, userId: string): void;
  endSession(c: Context): void;
  requireUser: MiddlewareHandler<AppEnv>;
};

export type RouteDecl = { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string };

/** What a feature's server.ts exports. */
export type ServerFeature = {
  id: string;
  routes: RouteDecl[];
  register(app: Hono<AppEnv>, deps: ServerDeps): void;
};

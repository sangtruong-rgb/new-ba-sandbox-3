/** A task as the server answers it. Times are ISO 8601 UTC. */
export type Task = { id: string; title: string; done: boolean; dueAt: string | null; createdAt: string };

export type User = { id: string; email: string };

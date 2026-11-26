// E2eFixtures: the Playwright `test` every e2e of the batch imports.
// signedIn: a unique email per test, signed in through POST /api/test/session,
// the cookie kept in the page's context.
// seedTasks: creates tasks for that user through POST /api/test/tasks.
import { test as base, expect } from '@playwright/test';
import type { Task } from '../../src/shared/tasks/types';

export type SeedTask = { title: string; done?: boolean; dueAt?: string | null };

type Fixtures = {
  signedIn: { email: string };
  seedTasks: (tasks: SeedTask[]) => Promise<Task[]>;
};

let counter = 0;

export const test = base.extend<Fixtures>({
  signedIn: async ({ page }, use, testInfo) => {
    counter += 1;
    const unique = `${Date.now().toString(36)}-${testInfo.workerIndex}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `e2e-${unique}@example.com`;
    const res = await page.request.post('/api/test/session', { data: { email } });
    expect(res.status(), await res.text()).toBe(200);
    const body = (await res.json()) as { id: string; email: string };
    await use({ email: body.email });
  },

  seedTasks: async ({ page, signedIn }, use) => {
    void signedIn;
    await use(async (tasks) => {
      const res = await page.request.post('/api/test/tasks', { data: { tasks } });
      expect(res.status(), await res.text()).toBe(200);
      return (await res.json()) as Task[];
    });
  },
});

export { expect };

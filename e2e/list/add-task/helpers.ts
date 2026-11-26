// Helpers for the add-task e2e of ticket #5.
import type { Locator, Page, Request } from '@playwright/test';
import { expect } from '../../support/fixtures';
import type { Task } from '../../../src/shared/tasks/types';

export const EMPTY_LIST = 'Chưa có việc nào. Thêm việc đầu tiên ở ô phía trên.';
export const FAILED = 'Không thêm được việc. Thử lại.';

/** The add form's elements, all inside the input slot (other forms reuse the due labels). */
export function addForm(page: Page) {
  const slot = page.locator('[data-slot="input"]');
  return {
    slot,
    title: slot.getByLabel('Việc mới', { exact: true }),
    date: slot.getByLabel('Ngày hạn', { exact: true }),
    time: slot.getByLabel('Giờ', { exact: true }),
    add: slot.getByRole('button', { name: 'Thêm', exact: true }),
  };
}

export async function openList(page: Page) {
  await page.goto('/');
  const form = addForm(page);
  await expect(form.title).toBeVisible();
  return form;
}

/** The user's tasks as the server has them. */
export async function serverTasks(page: Page): Promise<Task[]> {
  const res = await page.request.get('/api/tasks');
  expect(res.status()).toBe(200);
  return (await res.json()) as Task[];
}

/** Every POST /api/tasks the page sends from now on. */
export function watchPosts(page: Page): Request[] {
  const posts: Request[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/tasks') posts.push(r);
  });
  return posts;
}

/** A title as a row of the list shows it. */
export function listed(page: Page, title: string): Locator {
  return page.getByText(title, { exact: true });
}

export async function box(locator: Locator) {
  const b = await locator.boundingBox();
  expect(b, 'the element is drawn').not.toBeNull();
  return b!;
}

/** Do two elements share a horizontal band (are they on one row)? */
export async function sameRow(a: Locator, b: Locator): Promise<boolean> {
  const x = await box(a);
  const y = await box(b);
  return x.y < y.y + y.height && y.y < x.y + x.height;
}

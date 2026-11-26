// Helpers for the edit-task e2e of ticket #9.
import type { Page, Request } from '@playwright/test';
import { expect } from '../../support/fixtures';
import type { Task } from '../../../src/shared/tasks/types';
import { TZ, hcm, row } from '../../shell/helpers';

export { TZ, hcm, row };
export const FAILED = 'Không lưu được. Thử lại.';
export const A = 'Gửi hợp đồng thuê nhà';
export const B = 'Nộp học phí học kỳ 2';
export const TASK_URL = '**/api/tasks/*';

/** A due far ahead: the same text on any day this runs, and never late. */
export const DUE = hcm(2099, 12, 5, 20, 0);

export const slot = (page: Page, name: string) => page.locator(`[data-slot="${name}"]`);

/** The edit form's elements, all inside the detail slot. */
export function editForm(page: Page) {
  const root = slot(page, 'detail');
  return {
    root,
    heading: root.getByRole('heading', { name: 'Sửa việc', exact: true }),
    title: root.getByLabel('Tên việc', { exact: true }),
    date: root.getByLabel('Ngày hạn', { exact: true }),
    time: root.getByLabel('Giờ', { exact: true }),
    save: root.getByRole('button', { name: 'Lưu', exact: true }),
    cancel: root.getByRole('button', { name: 'Hủy', exact: true }),
    created: root.getByText(/^Tạo lúc /),
  };
}

/** The title button of a task's row. */
export const titleOf = (page: Page, title: string) => page.getByRole('button', { name: title, exact: true });

export async function openTask(page: Page, title: string) {
  await page.goto('/');
  await titleOf(page, title).click();
  const form = editForm(page);
  await expect(form.title).toHaveValue(title);
  return form;
}

export async function serverTasks(page: Page): Promise<Task[]> {
  const res = await page.request.get('/api/tasks');
  expect(res.status()).toBe(200);
  return (await res.json()) as Task[];
}

export function watchPatches(page: Page): Request[] {
  const patches: Request[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH') patches.push(r);
  });
  return patches;
}

/** Holds every PATCH until release(); then it goes to the server. */
export async function holdPatch(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let seen = 0;
  await page.route(TASK_URL, async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    seen += 1;
    await gate;
    await route.fallback();
  });
  return { release, count: () => seen };
}

// While a change is being saved, and when it fails (C35).
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
  DESKTOP,
  DONE_URL,
  FAILED,
  HINT,
  TASK_URL,
  actions,
  checkbox,
  decoration,
  deleteButton,
  doneButton,
  fail,
  hold,
  row,
  titleOf,
  undoneButton,
  type Failure,
} from './helpers';

const A = 'Gửi hợp đồng thuê nhà';
const B = 'Nộp học phí học kỳ 2';
const FAILURES: Failure[] = ['no answer', 500, 503];

const message = (page: Page) => page.getByText(FAILED, { exact: true });

/** The message is shown once, below the buttons of detail-actions, and not in the row. */
async function expectUnderActions(page: Page) {
  await expect(message(page)).toHaveCount(1);
  await expect(message(page)).toBeVisible();
  await expect(row(page, A).getByText(FAILED, { exact: true })).toHaveCount(0);
  const m = (await message(page).boundingBox())!;
  const b = (await deleteButton(page).boundingBox())!;
  expect(m.y).toBeGreaterThanOrEqual(b.y + b.height - 1);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(DESKTOP);
});

test.describe('list/done-delete · while a request runs', () => {
  test('list/done-delete · C35 · the checkbox is disabled and nothing changes until the server answers', async ({ page, seedTasks }) => {
    await seedTasks([{ title: A }]);
    await page.goto('/');
    const held = await hold(page, 'POST', DONE_URL);

    await checkbox(page, A).click();
    await expect.poll(held.count).toBe(1);
    await expect(checkbox(page, A)).toBeDisabled();
    await expect(checkbox(page, A)).not.toBeChecked();
    expect(await decoration(titleOf(page, A))).not.toContain('line-through');

    held.release();
    await expect(checkbox(page, A)).toBeChecked();
    await expect(checkbox(page, A)).toBeEnabled();
    expect(await decoration(titleOf(page, A))).toContain('line-through');
  });

  test('list/done-delete · C35 · "Đánh dấu xong" is disabled and keeps its label until the server answers', async ({
    page,
    seedTasks,
  }) => {
    await seedTasks([{ title: A }]);
    await page.goto('/');
    await titleOf(page, A).click();
    const held = await hold(page, 'POST', DONE_URL);

    await doneButton(page).click();
    await expect.poll(held.count).toBe(1);
    await expect(doneButton(page)).toBeDisabled();
    await expect(checkbox(page, A)).not.toBeChecked();
    expect(await decoration(titleOf(page, A))).not.toContain('line-through');

    held.release();
    await expect(undoneButton(page)).toBeEnabled();
    await expect(checkbox(page, A)).toBeChecked();
  });

  test('list/done-delete · C35 · "Xóa việc" is disabled and the task stays until the server answers', async ({ page, seedTasks }) => {
    await seedTasks([{ title: A }]);
    await page.goto('/');
    await titleOf(page, A).click();
    const held = await hold(page, 'DELETE', TASK_URL);

    await deleteButton(page).click();
    await expect.poll(held.count).toBe(1);
    await expect(deleteButton(page)).toBeDisabled();
    await expect(titleOf(page, A)).toBeVisible();
    await expect(actions(page)).toHaveCount(1);

    held.release();
    await expect(titleOf(page, A)).toHaveCount(0);
    await expect(actions(page)).toHaveCount(0);
  });
});

test.describe('list/done-delete · when saving fails', () => {
  for (const how of FAILURES) {
    test(`list/done-delete · C35 · checkbox, ${how}: nothing changes and "${FAILED}" shows under the row`, async ({
      page,
      seedTasks,
    }) => {
      await seedTasks([{ title: A }, { title: B }]);
      await page.goto('/');
      await fail(page, 'POST', DONE_URL, how);

      await checkbox(page, A).click();
      await expect(row(page, A).getByText(FAILED, { exact: true })).toBeVisible();
      await expect(message(page)).toHaveCount(1);
      await expect(checkbox(page, A)).not.toBeChecked();
      await expect(checkbox(page, A)).toBeEnabled();
      expect(await decoration(titleOf(page, A))).not.toContain('line-through');
      const m = (await message(page).boundingBox())!;
      const t = (await titleOf(page, A).boundingBox())!;
      expect(m.y).toBeGreaterThanOrEqual(t.y + t.height - 2);
    });

    test(`list/done-delete · C35 · "Đánh dấu xong", ${how}: nothing changes and the message shows under the actions`, async ({
      page,
      seedTasks,
    }) => {
      await seedTasks([{ title: A }]);
      await page.goto('/');
      await titleOf(page, A).click();
      await fail(page, 'POST', DONE_URL, how);

      await doneButton(page).click();
      await expectUnderActions(page);
      await expect(doneButton(page)).toBeEnabled();
      await expect(undoneButton(page)).toHaveCount(0);
      await expect(checkbox(page, A)).not.toBeChecked();
    });

    test(`list/done-delete · C35 · "Xóa việc", ${how}: the task stays, the detail stays open and the message shows under the actions`, async ({
      page,
      seedTasks,
    }) => {
      await seedTasks([{ title: A }]);
      await page.goto('/');
      await titleOf(page, A).click();
      await fail(page, 'DELETE', TASK_URL, how);

      await deleteButton(page).click();
      await expectUnderActions(page);
      await expect(deleteButton(page)).toBeEnabled();
      await expect(titleOf(page, A)).toBeVisible();
      await expect(actions(page)).toHaveCount(1);
    });
  }

  test('list/done-delete · C35 · the message under a row goes at the next action there', async ({ page, seedTasks }) => {
    await seedTasks([{ title: A }]);
    await page.goto('/');
    await fail(page, 'POST', DONE_URL, 500);
    await checkbox(page, A).click();
    await expect(message(page)).toBeVisible();

    await page.unroute(DONE_URL);
    const held = await hold(page, 'POST', DONE_URL);
    await checkbox(page, A).click();
    await expect.poll(held.count).toBe(1);
    await expect(message(page)).toHaveCount(0);

    held.release();
    await expect(checkbox(page, A)).toBeChecked();
    await expect(message(page)).toHaveCount(0);
  });

  test('list/done-delete · C35 · the message under the actions goes at the next action there, whichever button', async ({
    page,
    seedTasks,
  }) => {
    await seedTasks([{ title: A }]);
    await page.goto('/');
    await titleOf(page, A).click();
    await fail(page, 'DELETE', TASK_URL, 500);
    await deleteButton(page).click();
    await expect(message(page)).toBeVisible();

    const held = await hold(page, 'POST', DONE_URL);
    await doneButton(page).click();
    await expect.poll(held.count).toBe(1);
    await expect(message(page)).toHaveCount(0);

    held.release();
    await expect(undoneButton(page)).toBeVisible();
    await expect(message(page)).toHaveCount(0);
  });
});

test.describe('list/done-delete · deleted on another device', () => {
  const cases: Array<[string, boolean, (page: Page) => Promise<void>]> = [
    ['the checkbox', false, (page) => checkbox(page, A).click()],
    ['"Đánh dấu xong"', true, (page) => doneButton(page).click()],
    ['"Xóa việc"', true, (page) => deleteButton(page).click()],
  ];

  for (const [name, select, act] of cases) {
    test(`list/done-delete · C35 · a 404 on ${name} removes the task from the list`, async ({ page, seedTasks }) => {
      const [a] = await seedTasks([{ title: A }, { title: B }]);
      await page.goto('/');
      await expect(titleOf(page, A)).toBeVisible();
      if (select) await titleOf(page, A).click();
      // the other device
      const gone = await page.request.delete(`/api/tasks/${a.id}`);
      expect(gone.status()).toBe(204);

      await act(page);
      await expect(titleOf(page, A)).toHaveCount(0);
      await expect(checkbox(page, A)).toHaveCount(0);
      await expect(titleOf(page, B)).toBeVisible();
      await expect(actions(page)).toHaveCount(0);
      await expect(page.getByText(HINT, { exact: true })).toBeVisible();
      await expect(message(page)).toHaveCount(0);
    });
  }
});

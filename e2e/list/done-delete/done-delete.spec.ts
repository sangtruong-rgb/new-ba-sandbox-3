// Marking a task done and deleting it: the item-lead and detail-actions slots (C32, C33).
import { test, expect } from '../../support/fixtures';
import {
  DESKTOP,
  HINT,
  MOBILE,
  actions,
  checkbox,
  decoration,
  deleteButton,
  doneButton,
  resolveColor,
  paintedShares,
  slot,
  titleOf,
  undoneButton,
} from './helpers';

const A = 'Gửi hợp đồng thuê nhà';
const B = 'Nộp học phí học kỳ 2';

test.describe('list/done-delete · the row checkbox', () => {
  test('list/done-delete · C32 · each row has a checkbox in item-lead labelled "Đánh dấu xong: <title>", checked when the task is done', async ({
    page,
    seedTasks,
  }) => {
    await seedTasks([{ title: A }, { title: B, done: true }]);
    await page.goto('/');
    await expect(checkbox(page, A)).not.toBeChecked();
    await expect(checkbox(page, B)).toBeChecked();
    await expect(slot(page, 'item-lead').getByRole('checkbox')).toHaveCount(2);
  });

  test('list/done-delete · C32 · checking marks the task done, with a tick in the accent disc, and it stays done after a reload', async ({
    page,
    seedTasks,
  }) => {
    await page.setViewportSize(DESKTOP);
    await seedTasks([{ title: A }, { title: B }]);
    await page.goto('/');

    await checkbox(page, A).click();
    await expect(checkbox(page, A)).toBeChecked();
    await expect.poll(() => decoration(titleOf(page, A))).toContain('line-through');
    await expect(checkbox(page, B)).not.toBeChecked();
    expect(await decoration(titleOf(page, B))).not.toContain('line-through');

    const colours = [await resolveColor(page, 'var(--accent)'), await resolveColor(page, 'var(--accent-ink)')];
    await page.mouse.move(0, 0);
    const [disc, tick] = await paintedShares(page, checkbox(page, A), colours);
    expect(disc).toBeGreaterThan(0.5);
    expect(tick).toBeGreaterThan(0.04);

    await page.reload();
    await expect(checkbox(page, A)).toBeChecked();
    expect(await decoration(titleOf(page, A))).toContain('line-through');
    await expect(checkbox(page, B)).not.toBeChecked();
  });

  test('list/done-delete · C32 · unchecking makes the task not done, also after a reload', async ({ page, seedTasks }) => {
    await seedTasks([{ title: A, done: true }]);
    await page.goto('/');

    await checkbox(page, A).click();
    await expect(checkbox(page, A)).not.toBeChecked();
    await expect.poll(() => decoration(titleOf(page, A))).not.toContain('line-through');

    await page.reload();
    await expect(checkbox(page, A)).not.toBeChecked();
    expect(await decoration(titleOf(page, A))).not.toContain('line-through');
  });
});

test.describe('list/done-delete · the detail actions', () => {
  test('list/done-delete · C33 · "Đánh dấu xong" marks the selected task done and becomes "Bỏ đánh dấu xong", which takes it back', async ({
    page,
    seedTasks,
  }) => {
    await page.setViewportSize(DESKTOP);
    await seedTasks([{ title: A }, { title: B }]);
    await page.goto('/');
    await titleOf(page, A).click();
    await expect(undoneButton(page)).toHaveCount(0);

    await doneButton(page).click();
    await expect(undoneButton(page)).toBeEnabled();
    await expect(doneButton(page)).toHaveCount(0);
    await expect(checkbox(page, A)).toBeChecked();
    expect(await decoration(titleOf(page, A))).toContain('line-through');
    await expect(checkbox(page, B)).not.toBeChecked();

    await page.reload();
    await expect(checkbox(page, A)).toBeChecked();
    await titleOf(page, A).click();
    await undoneButton(page).click();
    await expect(doneButton(page)).toBeEnabled();
    await expect(checkbox(page, A)).not.toBeChecked();
    expect(await decoration(titleOf(page, A))).not.toContain('line-through');

    await page.reload();
    await expect(checkbox(page, A)).not.toBeChecked();
  });

  test('list/done-delete · C33 · checking the row of the selected task turns the button into "Bỏ đánh dấu xong"', async ({
    page,
    seedTasks,
  }) => {
    await page.setViewportSize(DESKTOP);
    await seedTasks([{ title: A }]);
    await page.goto('/');
    await titleOf(page, A).click();
    await expect(doneButton(page)).toBeVisible();
    await checkbox(page, A).click();
    await expect(undoneButton(page)).toBeVisible();
  });

  test('list/done-delete · C33 · "Xóa việc" deletes the task with no confirmation, closes the detail, and it does not come back', async ({
    page,
    seedTasks,
  }) => {
    await page.setViewportSize(DESKTOP);
    await seedTasks([{ title: A }, { title: B }]);
    let dialogs = 0;
    page.on('dialog', (d) => {
      dialogs += 1;
      void d.dismiss();
    });
    await page.goto('/');
    await titleOf(page, A).click();

    await deleteButton(page).click();
    await expect(titleOf(page, A)).toHaveCount(0);
    await expect(checkbox(page, A)).toHaveCount(0);
    await expect(actions(page)).toHaveCount(0);
    await expect(page.getByText(HINT, { exact: true })).toBeVisible();
    await expect(titleOf(page, B)).toBeVisible();
    expect(dialogs).toBe(0);

    await page.reload();
    await expect(titleOf(page, B)).toBeVisible();
    await expect(titleOf(page, A)).toHaveCount(0);
  });

  test('list/done-delete · C33 · at 390 "Xóa việc" closes the detail and shows the list again', async ({ page, seedTasks }) => {
    await page.setViewportSize(MOBILE);
    await seedTasks([{ title: A }, { title: B }]);
    await page.goto('/');
    await titleOf(page, A).click();
    await deleteButton(page).click();

    await expect(actions(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(titleOf(page, B)).toBeVisible();
    await expect(titleOf(page, A)).toHaveCount(0);
    await expect(page.getByRole('button', { name: '← Danh sách' })).toBeHidden();
    expect(new URL(page.url()).pathname).toBe('/');
  });
});

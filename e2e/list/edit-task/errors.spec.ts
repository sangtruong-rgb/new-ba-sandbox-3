// Invalid input (C48) and saving: in progress, failed, deleted elsewhere (C50).
import { test, expect } from '../../support/fixtures';
import { DESKTOP, precedes } from '../../shell/helpers';
import {
  A,
  B,
  DUE,
  FAILED,
  TASK_URL,
  TZ,
  editForm,
  holdPatch,
  openTask,
  serverTasks,
  slot,
  titleOf,
  watchPatches,
} from './helpers';

test.use({ timezoneId: TZ, viewport: DESKTOP });

for (const [name, value, message] of [
  ['empty', '', 'Nhập tên việc'],
  ['only spaces', '   ', 'Nhập tên việc'],
  ['201 characters', 'a'.repeat(201), 'Tên việc tối đa 200 ký tự'],
] as const) {
  test(`list/edit-task · C48 · a title that is ${name} shows "${message}", sends nothing, keeps the edits and focuses "Tên việc"`, async ({
    page,
    seedTasks,
  }) => {
    await seedTasks([{ title: A, dueAt: DUE }]);
    const form = await openTask(page, A);
    const patches = watchPatches(page);

    await form.title.fill(value);
    await form.time.fill('07:00');
    await form.save.click();

    const error = form.root.getByText(message, { exact: true });
    await expect(error).toBeVisible();
    await expect(form.title).toBeFocused();
    await expect(form.title).toHaveAttribute('aria-invalid', 'true');
    await expect(form.title).toHaveAccessibleDescription(message);
    await expect(form.title).toHaveValue(value);
    await expect(form.time).toHaveValue('07:00');
    expect(await precedes(form.title, error)).toBe(true);
    expect(await precedes(error, form.date)).toBe(true);
    expect(patches).toHaveLength(0);
  });
}

for (const [date, time, message, focus] of [
  ['', '09:00', 'Chọn ngày cho hạn chót', 'date'],
  ['31/02/2099', '09:00', 'Ngày theo dạng dd/mm/yyyy', 'date'],
  ['mai', '', 'Ngày theo dạng dd/mm/yyyy', 'date'],
  ['05/12/2099', '25:00', 'Giờ theo dạng hh:mm', 'time'],
] as const) {
  test(`list/edit-task · C48 · date "${date}" time "${time}" shows "${message}" under the due fields and focuses ${focus}`, async ({
    page,
    seedTasks,
  }) => {
    await seedTasks([{ title: A, dueAt: DUE }]);
    const form = await openTask(page, A);
    const patches = watchPatches(page);

    await form.title.fill('Tên đang sửa');
    await form.date.fill(date);
    await form.time.fill(time);
    await form.save.click();

    const error = form.root.getByText(message, { exact: true });
    await expect(error).toBeVisible();
    await expect(focus === 'date' ? form.date : form.time).toBeFocused();
    await expect(form.date).toHaveAttribute('aria-invalid', 'true');
    await expect(form.time).toHaveAttribute('aria-invalid', 'true');
    await expect(form.title).toHaveValue('Tên đang sửa');
    await expect(form.date).toHaveValue(date);
    await expect(form.time).toHaveValue(time);
    expect(await precedes(form.time, error)).toBe(true);
    expect(patches).toHaveLength(0);
    expect((await serverTasks(page))[0].title).toBe(A);
  });
}

test('list/edit-task · C50 · while saving, "Lưu" is disabled and reads "Đang lưu…"', async ({ page, seedTasks }) => {
  await seedTasks([{ title: A }]);
  const form = await openTask(page, A);
  const held = await holdPatch(page);

  await form.title.fill('Tên mới');
  await form.save.click();
  await expect.poll(held.count).toBe(1);
  const saving = form.root.getByRole('button', { name: 'Đang lưu…', exact: true });
  await expect(saving).toBeDisabled();
  await expect(form.save).toHaveCount(0);
  // the row changes only after the server answered
  await expect(titleOf(page, A)).toBeVisible();

  held.release();
  await expect(titleOf(page, 'Tên mới')).toBeVisible();
  await expect(form.save).toBeDisabled();
});

for (const how of ['no answer', 500, 503] as const) {
  test(`list/edit-task · C50 · ${how}: "${FAILED}" shows under the form and the edits stay`, async ({ page, seedTasks }) => {
    await seedTasks([{ title: A }]);
    const form = await openTask(page, A);
    await page.route(TASK_URL, async (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      if (how === 'no answer') return route.abort('failed');
      await route.fulfill({ status: how, contentType: 'application/json', body: '{"error":"server_error"}' });
    });

    await form.title.fill('Tên mới');
    await form.date.fill('01/01/2099');
    await form.save.click();

    const message = page.getByText(FAILED, { exact: true });
    await expect(message).toBeVisible();
    await expect(form.title).toHaveValue('Tên mới');
    await expect(form.date).toHaveValue('01/01/2099');
    await expect(form.save).toBeEnabled();
    await expect(titleOf(page, A)).toBeVisible();
    const m = (await message.boundingBox())!;
    const b = (await form.save.boundingBox())!;
    expect(m.y).toBeGreaterThanOrEqual(b.y + b.height - 1);

    // "Thử lại": with the server back, the same edits are saved
    await page.unroute(TASK_URL);
    await form.save.click();
    await expect(titleOf(page, 'Tên mới')).toBeVisible();
    await expect(message).toHaveCount(0);
  });
}

test('list/edit-task · C50 · a task deleted on another device leaves the list and the detail closes', async ({ page, seedTasks }) => {
  const [a] = await seedTasks([{ title: A }, { title: B }]);
  const form = await openTask(page, A);
  expect((await page.request.delete(`/api/tasks/${a.id}`)).status()).toBe(204);

  await form.title.fill('Tên mới');
  await form.save.click();

  await expect(editForm(page).root).toHaveCount(0);
  await expect(slot(page, 'detail')).toHaveCount(0);
  await expect(titleOf(page, A)).toHaveCount(0);
  await expect(titleOf(page, B)).toBeVisible();
});

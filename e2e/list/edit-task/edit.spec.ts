// The edit form: what it shows, saving, removing the due and cancelling (C46, C47).
import { test, expect } from '../../support/fixtures';
import { DESKTOP, precedes } from '../../shell/helpers';
import { A, B, DUE, TZ, editForm, hcm, openTask, row, serverTasks, titleOf, watchPatches } from './helpers';

test.use({ timezoneId: TZ, viewport: DESKTOP });

test('list/edit-task · C46 · the detail shows the heading, the title, the due fields, "Tạo lúc" and the buttons, in order', async ({
  page,
  seedTasks,
}) => {
  const [task] = await seedTasks([{ title: A, dueAt: DUE }]);
  const form = await openTask(page, A);

  await expect(form.heading).toBeVisible();
  expect(await form.title.evaluate((el) => el.tagName)).toBe('TEXTAREA');
  await expect(form.date).toHaveValue('05/12/2099');
  await expect(form.time).toHaveValue('20:00');
  await expect(form.date).toHaveAttribute('id', 'edit-date');
  await expect(form.time).toHaveAttribute('id', 'edit-time');

  // The creation date in the formatDue form: seeded just now, so today.
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(task.createdAt),
  );
  await expect(form.created).toHaveText(new RegExp(`^Tạo lúc (Hôm nay|Hôm qua) · ${hm}$`));

  await expect(form.root.getByRole('button')).toHaveText(['Lưu', 'Hủy']);
  await expect(form.root.getByText(/^Trễ · /)).toHaveCount(0);
  const parts = [form.heading, form.title, form.date, form.time, form.created, form.save, form.cancel];
  for (let i = 1; i < parts.length; i++) expect(await precedes(parts[i - 1], parts[i]), `part ${i}`).toBe(true);
});

test('list/edit-task · C46 · "Lưu" is disabled until a field’s text differs from the saved text', async ({ page, seedTasks }) => {
  await seedTasks([{ title: A, dueAt: DUE }]);
  const form = await openTask(page, A);
  await expect(form.save).toBeDisabled();

  for (const [field, saved] of [
    [form.title, A],
    [form.date, '05/12/2099'],
    [form.time, '20:00'],
  ] as const) {
    await field.fill(`${saved} `);
    await expect(form.save).toBeEnabled();
    await field.fill(saved);
    await expect(form.save).toBeDisabled();
  }
});

test('list/edit-task · C46 · after "Lưu" the row shows the new title and due, the detail stays with the saved values', async ({
  page,
  seedTasks,
}) => {
  const [task] = await seedTasks([{ title: A, dueAt: DUE }]);
  const form = await openTask(page, A);

  await form.title.fill('  Gửi lại hợp đồng  ');
  await form.date.fill('7/1/2099');
  await form.time.fill('8:05');
  await form.save.click();

  await expect(row(page, 'Gửi lại hợp đồng')).toContainText('07/01/2099 · 08:05');
  await expect(titleOf(page, A)).toHaveCount(0);
  await expect(form.heading).toBeVisible();
  await expect(form.title).toHaveValue('Gửi lại hợp đồng');
  await expect(form.date).toHaveValue('07/01/2099');
  await expect(form.time).toHaveValue('08:05');
  await expect(form.save).toHaveText('Lưu');
  await expect(form.save).toBeDisabled();
  expect(await serverTasks(page)).toEqual([{ ...task, title: 'Gửi lại hợp đồng', dueAt: hcm(2099, 1, 7, 8, 5) }]);
});

test('list/edit-task · C46 · Enter in "Tên việc" saves, and line breaks become spaces', async ({ page, seedTasks }) => {
  await seedTasks([{ title: A }]);
  const form = await openTask(page, A);

  await form.title.fill('Gọi cho\nanh Tuấn');
  await form.title.press('Enter');

  await expect(titleOf(page, 'Gọi cho anh Tuấn')).toBeVisible();
  await expect(form.title).toHaveValue('Gọi cho anh Tuấn');
  await expect(form.save).toBeDisabled();
  expect((await serverTasks(page)).map((t) => t.title)).toEqual(['Gọi cho anh Tuấn']);
});

test('list/edit-task · C46 · a long title wraps in the text area', async ({ page, seedTasks }) => {
  const long = 'Đặt bàn sinh nhật ở quán quen, nhớ hỏi có phòng riêng và chỗ đậu xe máy không';
  await seedTasks([{ title: long }]);
  const form = await openTask(page, long);
  const size = await form.title.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, height: el.clientHeight }));
  expect(size.scroll).toBeLessThanOrEqual(size.client);
  expect(size.height).toBeGreaterThan(50);
});

test('list/edit-task · C47 · emptying both due fields and pressing "Lưu" removes the due date', async ({ page, seedTasks }) => {
  await seedTasks([{ title: A, dueAt: DUE }]);
  const form = await openTask(page, A);
  await expect(row(page, A)).toContainText('05/12/2099 · 20:00');

  await form.date.fill('');
  await form.time.fill('');
  await form.save.click();

  await expect(row(page, A)).not.toContainText('2099');
  await expect(form.date).toHaveValue('');
  await expect(form.time).toHaveValue('');
  await expect(form.save).toBeDisabled();
  expect((await serverTasks(page))[0].dueAt).toBeNull();
});

test('list/edit-task · C47 · "Hủy" drops the edits and closes the detail', async ({ page, seedTasks }) => {
  await seedTasks([{ title: A, dueAt: DUE }, { title: B }]);
  const form = await openTask(page, A);
  const patches = watchPatches(page);

  await form.title.fill('Không giữ');
  await form.date.fill('01/01/2099');
  await form.cancel.click();

  await expect(editForm(page).root).toHaveCount(0);
  await expect(titleOf(page, A)).toBeVisible();
  expect(patches).toHaveLength(0);
  expect((await serverTasks(page)).find((t) => t.title === A)?.dueAt).toBe(DUE);

  await titleOf(page, A).click();
  await expect(form.title).toHaveValue(A);
  await expect(form.date).toHaveValue('05/12/2099');
  await expect(form.save).toBeDisabled();
});

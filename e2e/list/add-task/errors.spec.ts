// Refused and failed adds (ticket #5, C28 and C30).
import type { Page, Route } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { DESKTOP, MOBILE, TZ } from '../../shell/helpers';
import { FAILED, addForm, box, listed, openList, serverTasks, watchPosts } from './helpers';

test.use({ timezoneId: TZ });

const NO_TITLE = 'Nhập tên việc';
const LONG_TITLE = 'Tên việc tối đa 200 ký tự';

/** The title is marked invalid and described by `message`, which sits under it. */
async function expectTitleError(page: Page, message: string) {
  const form = addForm(page);
  const text = form.slot.getByText(message, { exact: true });
  await expect(text).toBeVisible();
  await expect(form.title).toHaveAttribute('aria-invalid', 'true');
  await expect(form.title).toHaveAccessibleDescription(message);
  const t = await box(form.title);
  const m = await box(text);
  expect(m.y).toBeGreaterThanOrEqual(t.y + t.height);
  expect(m.x).toBeLessThan(t.x + t.width);
}

test.describe('list/add-task · refused input', () => {
  for (const [name, typed, message] of [
    ['an empty title', '', NO_TITLE],
    ['a title of only spaces', '    ', NO_TITLE],
    ['a title over 200 characters', 'a'.repeat(201), LONG_TITLE],
  ] as const) {
    test(`list/add-task · C28 · ${name} shows "${message}", marks the field, keeps the text, sends nothing and focuses the title`, async ({
      page,
      signedIn,
    }) => {
      void signedIn;
      await page.setViewportSize(DESKTOP);
      const form = await openList(page);
      const posts = watchPosts(page);
      await form.title.fill(typed);
      await form.add.click();

      await expectTitleError(page, message);
      await expect(form.title).toBeFocused();
      await expect(form.title).toHaveValue(typed);
      expect(posts).toHaveLength(0);
      expect(await serverTasks(page)).toEqual([]);
    });
  }

  test('list/add-task · C28 · at 390 "Thêm" with an empty title shows "Nhập tên việc" and focuses the title', async ({ page, signedIn }) => {
    void signedIn;
    await page.setViewportSize(MOBILE);
    const form = await openList(page);
    const posts = watchPosts(page);
    await form.add.click();
    await expectTitleError(page, NO_TITLE);
    await expect(form.title).toBeFocused();
    expect(posts).toHaveLength(0);
  });

  for (const [date, time, message, focused] of [
    ['', '09:00', 'Chọn ngày cho hạn chót', 'date'],
    ['31/02/2099', '', 'Ngày theo dạng dd/mm/yyyy', 'date'],
    ['mai', '09:00', 'Ngày theo dạng dd/mm/yyyy', 'date'],
    ['05/12/2099', '25:00', 'Giờ theo dạng hh:mm', 'time'],
    ['05/12/2099', '9h', 'Giờ theo dạng hh:mm', 'time'],
  ] as const) {
    test(`list/add-task · C28 · date "${date}" and time "${time}" show "${message}" under the due fields and focus ${focused === 'date' ? '"Ngày hạn"' : '"Giờ"'}`, async ({
      page,
      signedIn,
    }) => {
      void signedIn;
      await page.setViewportSize(DESKTOP);
      const form = await openList(page);
      const posts = watchPosts(page);
      await form.title.fill('Rửa xe');
      await form.date.fill(date);
      await form.time.fill(time);
      await form.add.click();

      const error = form.slot.locator('#add-due-error');
      await expect(error).toHaveText(message);
      await expect(error).toBeVisible();
      const d = await box(form.date);
      expect((await box(error)).y).toBeGreaterThanOrEqual(d.y + d.height);
      await expect(form.date).toHaveAttribute('aria-invalid', 'true');
      await expect(form.time).toHaveAttribute('aria-invalid', 'true');
      await expect(form.title).not.toHaveAttribute('aria-invalid', 'true');
      await expect(focused === 'date' ? form.date : form.time).toBeFocused();
      await expect(form.title).toHaveValue('Rửa xe');
      await expect(form.date).toHaveValue(date);
      await expect(form.time).toHaveValue(time);
      expect(posts).toHaveLength(0);
      expect(await serverTasks(page)).toEqual([]);
    });
  }

  test('list/add-task · C28 · with both a title and a due error, both show and focus moves to the title', async ({ page, signedIn }) => {
    void signedIn;
    await page.setViewportSize(DESKTOP);
    const form = await openList(page);
    const posts = watchPosts(page);
    await form.date.fill('05/12/2099');
    await form.time.fill('25:00');
    await form.add.click();

    await expectTitleError(page, NO_TITLE);
    await expect(form.slot.locator('#add-due-error')).toHaveText('Giờ theo dạng hh:mm');
    await expect(form.title).toBeFocused();
    await expect(form.date).toHaveValue('05/12/2099');
    await expect(form.time).toHaveValue('25:00');
    expect(posts).toHaveLength(0);
  });

  test('list/add-task · C28 · once the input is put right, the task is added and the errors are gone', async ({ page, signedIn }) => {
    void signedIn;
    await page.setViewportSize(DESKTOP);
    const form = await openList(page);
    await form.time.fill('09:00');
    await form.add.click();
    await expect(form.slot.getByText(NO_TITLE, { exact: true })).toBeVisible();
    await expect(form.slot.getByText('Chọn ngày cho hạn chót', { exact: true })).toBeVisible();

    await form.title.fill('Rửa xe');
    await form.date.fill('05/12/2099');
    await form.add.click();

    await expect(listed(page, 'Rửa xe')).toBeVisible();
    await expect(form.slot.getByText(NO_TITLE, { exact: true })).toHaveCount(0);
    await expect(form.slot.locator('#add-due-error')).toHaveCount(0);
    for (const field of [form.title, form.date, form.time]) await expect(field).not.toHaveAttribute('aria-invalid', 'true');
  });
});

/** Holds every POST /api/tasks until release(); other requests go through. */
async function holdPosts(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route('**/api/tasks', async (route) => {
    if (route.request().method() === 'POST') await gate;
    await route.continue();
  });
  return release;
}

/** Answers every POST /api/tasks with `fail`; other requests go through. */
async function failPosts(page: Page, fail: (route: Route) => Promise<void>) {
  await page.route('**/api/tasks', (route) => (route.request().method() === 'POST' ? fail(route) : route.continue()));
}

test.describe('list/add-task · in flight and failed', () => {
  for (const how of ['"Thêm"', 'Enter'] as const) {
    test(`list/add-task · C30 · after ${how}, while in flight "Thêm" is disabled and a second Enter adds nothing`, async ({
      page,
      signedIn,
    }) => {
      void signedIn;
      await page.setViewportSize(DESKTOP);
      const form = await openList(page);
      const release = await holdPosts(page);
      const posts = watchPosts(page);

      await form.title.fill('Gửi hợp đồng thuê nhà');
      if (how === 'Enter') await form.title.press('Enter');
      else await form.add.click();

      await expect(form.add).toBeDisabled();
      await form.title.focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      // nothing reaches the list before the server answers
      await expect(listed(page, 'Gửi hợp đồng thuê nhà')).toHaveCount(0);

      release();
      await expect(listed(page, 'Gửi hợp đồng thuê nhà')).toBeVisible();
      await expect(form.add).toBeEnabled();
      await expect(form.title).toHaveValue('');
      expect(posts).toHaveLength(1);
      expect(await serverTasks(page)).toHaveLength(1);
    });
  }

  for (const [name, fail] of [
    ['the server answers 500', (r: Route) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"server_error"}' })],
    ['the server answers 503 without JSON', (r: Route) => r.fulfill({ status: 503, contentType: 'text/plain', body: 'unavailable' })],
    ['there is no answer', (r: Route) => r.abort('connectionrefused')],
  ] as const) {
    test(`list/add-task · C30 · when ${name}, "${FAILED}" shows under the form and what was typed stays`, async ({ page, signedIn }) => {
      void signedIn;
      await page.setViewportSize(DESKTOP);
      const form = await openList(page);
      await failPosts(page, fail);

      await form.title.fill('Gửi hợp đồng thuê nhà');
      await form.date.fill('05/12/2099');
      await form.time.fill('16:30');
      await form.add.click();

      const message = form.slot.getByText(FAILED, { exact: true });
      await expect(message).toBeVisible();
      for (const part of [form.title, form.date, form.time, form.add]) {
        const b = await box(part);
        expect((await box(message)).y).toBeGreaterThanOrEqual(b.y + b.height);
      }
      await expect(form.title).toHaveValue('Gửi hợp đồng thuê nhà');
      await expect(form.date).toHaveValue('05/12/2099');
      await expect(form.time).toHaveValue('16:30');
      await expect(form.add).toBeEnabled();
      await expect(listed(page, 'Gửi hợp đồng thuê nhà')).toHaveCount(0);
    });
  }

  test('list/add-task · C30 · pressing "Thêm" again after a failure adds the task and the message goes', async ({ page, signedIn }) => {
    void signedIn;
    await page.setViewportSize(MOBILE);
    const form = await openList(page);
    await failPosts(page, (r) => r.fulfill({ status: 502, contentType: 'text/plain', body: 'bad gateway' }));
    await form.title.fill('Rửa xe');
    await form.add.click();
    await expect(form.slot.getByText(FAILED, { exact: true })).toBeVisible();
    await expect(form.title).toHaveValue('Rửa xe');

    await page.unroute('**/api/tasks');
    await form.add.click();
    await expect(listed(page, 'Rửa xe')).toBeVisible();
    await expect(form.slot.getByText(FAILED, { exact: true })).toHaveCount(0);
    await expect(form.title).toHaveValue('');
    expect(await serverTasks(page)).toHaveLength(1);
  });
});

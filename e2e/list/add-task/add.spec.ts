// Adding a task (ticket #5, C26 and C27).
import { test, expect } from '../../support/fixtures';
import { DESKTOP, MOBILE, TZ, hcm, precedes } from '../../shell/helpers';
import { box, listed, openList, sameRow, serverTasks, watchPosts } from './helpers';

test.use({ timezoneId: TZ });

test.describe('list/add-task · adding', () => {
  for (const how of ['"Thêm"', 'Enter'] as const) {
    test(`list/add-task · C26 · ${how} adds the typed title, not done and with no due; it shows in the list, the title is emptied and keeps focus`, async ({
      page,
      signedIn,
    }) => {
      void signedIn;
      await page.setViewportSize(DESKTOP);
      const form = await openList(page);
      const posts = watchPosts(page);

      await form.title.fill('Mua thuốc huyết áp cho bố');
      if (how === 'Enter') await form.title.press('Enter');
      else await form.add.click();

      await expect(listed(page, 'Mua thuốc huyết áp cho bố')).toBeVisible();
      await expect(form.title).toHaveValue('');
      await expect(form.title).toBeFocused();
      await expect(form.date).toHaveValue('');
      await expect(form.time).toHaveValue('');
      expect(await serverTasks(page)).toMatchObject([{ title: 'Mua thuốc huyết áp cho bố', done: false, dueAt: null }]);
      expect(posts).toHaveLength(1);
    });
  }

  test('list/add-task · C26 · tasks can be added one after another without touching the mouse', async ({ page, seedTasks }) => {
    await page.setViewportSize(DESKTOP);
    await seedTasks([{ title: 'Rửa xe' }]);
    const form = await openList(page);

    await form.title.focus();
    await page.keyboard.type('Việc thứ nhất');
    await page.keyboard.press('Enter');
    await expect(listed(page, 'Việc thứ nhất')).toBeVisible();
    await expect(form.title).toHaveValue('');
    await page.keyboard.type('Việc thứ hai');
    await page.keyboard.press('Enter');
    await expect(listed(page, 'Việc thứ hai')).toBeVisible();

    await expect(listed(page, 'Việc thứ nhất')).toBeVisible();
    await expect(listed(page, 'Rửa xe')).toBeVisible();
    expect((await serverTasks(page)).map((t) => t.title).sort()).toEqual(['Rửa xe', 'Việc thứ hai', 'Việc thứ nhất']);
  });

  test('list/add-task · C26 · at 390, adding from the "Thêm" button leaves the title empty and focused', async ({ page, signedIn }) => {
    void signedIn;
    await page.setViewportSize(MOBILE);
    const form = await openList(page);
    await form.title.fill('Học xong bài 7 tiếng Nhật');
    await form.add.click();
    await expect(listed(page, 'Học xong bài 7 tiếng Nhật')).toBeVisible();
    await expect(form.title).toHaveValue('');
    await expect(form.title).toBeFocused();
  });

  test('list/add-task · C27 · with "Ngày hạn" and "Giờ" filled in, the task has that due and the three fields are emptied', async ({
    page,
    signedIn,
  }) => {
    void signedIn;
    await page.setViewportSize(DESKTOP);
    const form = await openList(page);
    await form.title.fill('Đặt bàn sinh nhật vợ');
    await form.date.fill('5/12/2099');
    await form.time.fill('9:30');
    await form.add.click();

    await expect(listed(page, 'Đặt bàn sinh nhật vợ')).toBeVisible();
    await expect(page.getByText('05/12/2099 · 09:30', { exact: true })).toBeVisible();
    await expect(form.title).toHaveValue('');
    await expect(form.date).toHaveValue('');
    await expect(form.time).toHaveValue('');
    await expect(form.title).toBeFocused();
    const tasks = await serverTasks(page);
    expect(tasks).toHaveLength(1);
    expect(Date.parse(tasks[0].dueAt as string)).toBe(Date.parse(hcm(2099, 12, 5, 9, 30)));
  });

  test('list/add-task · C27 · a date without a time gives 23:59 that day', async ({ page, signedIn }) => {
    void signedIn;
    await page.setViewportSize(DESKTOP);
    const form = await openList(page);
    await form.title.fill('Nộp học phí học kỳ 2');
    await form.date.fill('28/02/2099');
    await form.title.press('Enter');

    await expect(listed(page, 'Nộp học phí học kỳ 2')).toBeVisible();
    await expect(page.getByText('28/02/2099 · 23:59', { exact: true })).toBeVisible();
    const tasks = await serverTasks(page);
    expect(tasks).toHaveLength(1);
    expect(Date.parse(tasks[0].dueAt as string)).toBe(Date.parse(hcm(2099, 2, 28, 23, 59)));
  });

  for (const width of [1100, 1440]) {
    test(`list/add-task · C27 · at ${width} the title, "Ngày hạn", "Giờ" and "Thêm" are one row, in that order, also the tab order`, async ({
      page,
      signedIn,
    }) => {
      void signedIn;
      await page.setViewportSize({ width, height: 900 });
      const form = await openList(page);
      const parts = [form.title, form.date, form.time, form.add];

      // all four show before anything is typed or focused
      for (const part of parts) await expect(part).toBeVisible();
      for (let i = 1; i < parts.length; i++) {
        expect(await sameRow(parts[0], parts[i])).toBe(true);
        const left = await box(parts[i - 1]);
        expect((await box(parts[i])).x).toBeGreaterThanOrEqual(left.x + left.width);
        expect(await precedes(parts[i - 1], parts[i])).toBe(true);
      }

      await form.title.focus();
      for (const next of [form.date, form.time, form.add]) {
        await page.keyboard.press('Tab');
        await expect(next).toBeFocused();
      }
    });
  }

  for (const width of [390, 1099]) {
    test(`list/add-task · C27 · at ${width} the title and "Thêm" are one row, "Việc mới" is for screen readers only, and the due fields are not shown at first`, async ({
      page,
      signedIn,
    }) => {
      void signedIn;
      await page.setViewportSize({ width, height: 844 });
      const form = await openList(page);

      await expect(form.add).toBeVisible();
      expect(await sameRow(form.title, form.add)).toBe(true);
      const t = await box(form.title);
      expect((await box(form.add)).x).toBeGreaterThanOrEqual(t.x + t.width);
      await expect(form.date).toBeHidden();
      await expect(form.time).toBeHidden();

      // the label still names the field, but takes no visible room
      await expect(form.slot.getByRole('textbox', { name: 'Việc mới', exact: true })).toBeVisible();
      const label = await form.slot.locator('label', { hasText: 'Việc mới' }).evaluate((el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return { display: s.display, visibility: s.visibility, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      });
      expect(label.display).not.toBe('none');
      expect(label.visibility).not.toBe('hidden');
      const tiny = label.width <= 1 && label.height <= 1;
      const offScreen = label.right <= 0 || label.bottom <= 0;
      expect(tiny || offScreen).toBe(true);
    });
  }

  test('list/add-task · C27 · at 390 the due fields show on a second row once the title has focus, and stay while a due field is used', async ({
    page,
    signedIn,
  }) => {
    void signedIn;
    await page.setViewportSize(MOBILE);
    const form = await openList(page);
    await expect(form.date).toBeHidden();

    await form.title.focus();
    await expect(form.date).toBeVisible();
    await expect(form.time).toBeVisible();
    const t = await box(form.title);
    expect((await box(form.date)).y).toBeGreaterThanOrEqual(t.y + t.height);
    expect(await sameRow(form.date, form.time)).toBe(true);
    const d = await box(form.date);
    expect((await box(form.time)).x).toBeGreaterThanOrEqual(d.x + d.width);

    await form.date.click();
    await expect(form.date).toBeFocused();
    await expect(form.date).toBeVisible();
    await form.time.click();
    await expect(form.time).toBeFocused();
    await expect(form.time).toBeVisible();
  });

  test('list/add-task · C27 · at 390 the due fields stay while the title has text, and go once it is empty and unfocused', async ({
    page,
    signedIn,
  }) => {
    void signedIn;
    await page.setViewportSize(MOBILE);
    const form = await openList(page);

    await form.title.fill('Rửa xe');
    await form.title.blur();
    await expect(form.title).not.toBeFocused();
    await expect(form.date).toBeVisible();
    await expect(form.time).toBeVisible();

    await form.title.fill('');
    await form.title.blur();
    await expect(form.date).toBeHidden();
    await expect(form.time).toBeHidden();
  });

  test('list/add-task · C27 · at 390 a due typed in the second row is saved with the task', async ({ page, signedIn }) => {
    void signedIn;
    await page.setViewportSize(MOBILE);
    const form = await openList(page);
    await form.title.fill('Họp nhóm chốt kế hoạch');
    await form.date.fill('05/12/2099');
    await form.time.fill('19:30');
    await form.add.click();
    await expect(listed(page, 'Họp nhóm chốt kế hoạch')).toBeVisible();
    await expect(form.date).toHaveValue('');
    await expect(form.time).toHaveValue('');
    const tasks = await serverTasks(page);
    expect(tasks).toHaveLength(1);
    expect(Date.parse(tasks[0].dueAt as string)).toBe(Date.parse(hcm(2099, 12, 5, 19, 30)));
  });
});

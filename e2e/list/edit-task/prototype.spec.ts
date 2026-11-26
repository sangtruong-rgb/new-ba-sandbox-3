// The detail slot against the prototype's #list, #task and #task-invalid (C51), and the
// late line's colour and weight (C46). QC judges the look.
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { DESKTOP, MOBILE, precedes, resolveColor, style } from '../../shell/helpers';
import { A, DUE, TZ, editForm, openTask } from './helpers';

test.use({ timezoneId: TZ });

const token = (page: Page, name: string) => resolveColor(page, `var(${name})`);
const box = async (l: Locator) => (await l.boundingBox())!;

/** The tone is another ticket's: set it through ListView, as the app's own module. */
const makeLate = (page: Page) => page.evaluate("import('/src/shared/list.ts').then((m) => m.setTone(() => 'late'))");

async function expectElements(page: Page) {
  const form = editForm(page);
  await expect(form.heading).toBeVisible();
  await expect(form.root.locator('label')).toHaveText(['Tên việc', 'Ngày hạn', 'Giờ']);
  await expect(form.root.locator('textarea')).toHaveCount(1);
  await expect(form.root.locator('input')).toHaveCount(2);
  await expect(form.date).toHaveAttribute('placeholder', 'dd/mm/yyyy');
  await expect(form.time).toHaveAttribute('placeholder', 'hh:mm');
  await expect(form.root.getByRole('button')).toHaveText(['Lưu', 'Hủy']);
  await expect(form.created).toBeVisible();
}

/** Date and "Giờ" (104 wide) side by side 8 apart; the buttons side by side 8 apart, left. */
async function expectLayout(page: Page) {
  const form = editForm(page);
  const [area, h, t, d, g, c, s, x] = await Promise.all(
    [form.root, form.heading, form.title, form.date, form.time, form.created, form.save, form.cancel].map(box),
  );
  expect(h.y + h.height).toBeLessThanOrEqual(t.y);
  // a text area of about three lines, as in the prototype
  expect(t.height).toBeGreaterThanOrEqual(70);
  expect(t.y + t.height).toBeLessThanOrEqual(d.y);
  expect(Math.abs(t.x - area.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(t.width - area.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(d.x - t.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(g.y - d.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(g.width - 104)).toBeLessThanOrEqual(2);
  expect(Math.abs(g.x - (d.x + d.width) - 8)).toBeLessThanOrEqual(2);
  expect(Math.abs(g.x + g.width - (t.x + t.width))).toBeLessThanOrEqual(2);
  expect(c.y).toBeGreaterThanOrEqual(d.y + d.height);
  expect(s.y).toBeGreaterThanOrEqual(c.y + c.height);
  expect(Math.abs(s.x - t.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(x.y - s.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(x.x - (s.x + s.width) - 8)).toBeLessThanOrEqual(2);
}

async function expectLook(page: Page) {
  const form = editForm(page);
  expect(await style(form.heading, 'font-family')).toContain('Literata');
  expect(await style(form.heading, 'font-size')).toBe('24px');
  expect(await style(form.heading, 'font-weight')).toBe('600');
  for (const field of [form.title, form.date, form.time]) {
    expect(await style(field, 'background-color')).toBe(await token(page, '--paper'));
    expect(await style(field, 'border-top-color')).toBe(await token(page, '--line'));
    expect(await style(field, 'border-top-left-radius')).toBe('6px');
    expect(await style(field, 'font-family')).toContain('Be Vietnam Pro');
  }
  expect(await style(form.created, 'color')).toBe(await token(page, '--muted'));
  expect(await style(form.created, 'font-size')).toBe('14px');

  // "Lưu" at rest is a disabled primary; "Hủy" is quiet
  await expect(form.save).toBeDisabled();
  expect(await style(form.save, 'color')).toBe(await token(page, '--muted'));
  expect(await style(form.save, 'background-color')).toBe(await token(page, '--paper'));
  expect(await style(form.cancel, 'color')).toBe(await token(page, '--ink'));
  expect(await style(form.cancel, 'background-color')).toBe(await token(page, '--paper'));
  expect(await style(form.cancel, 'border-top-color')).toBe(await token(page, '--line'));
  expect(await style(form.cancel, 'font-weight')).toBe('600');
}

async function expectEnabledSave(page: Page) {
  const form = editForm(page);
  await expect(form.save).toBeEnabled();
  expect(await style(form.save, 'background-color')).toBe(await token(page, '--accent'));
  expect(await style(form.save, 'color')).toBe(await token(page, '--accent-ink'));
}

for (const [size, viewport] of [
  ['1440', DESKTOP],
  ['390', MOBILE],
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`list/edit-task · C51 · #task at ${size} (${scheme}): elements, order, labels, layout, colours and fonts`, async ({
      page,
      seedTasks,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize(viewport);
      await seedTasks([{ title: A, dueAt: DUE }]);
      const form = await openTask(page, A);
      await expectElements(page);
      await expectLayout(page);
      await expectLook(page);
      await form.title.fill('Tên mới');
      await expectEnabledSave(page);
    });
  }

  test(`list/edit-task · C51 · #list at ${size}: a late task's "Trễ · " line is in --late at 600, between the due fields and "Tạo lúc"`, async ({
    page,
    seedTasks,
  }) => {
    await page.setViewportSize(viewport);
    await seedTasks([{ title: A, dueAt: DUE }]);
    await page.goto('/');
    await expect(page.getByRole('button', { name: A, exact: true })).toBeVisible();
    await makeLate(page);
    await page.getByRole('button', { name: A, exact: true }).click();

    const form = editForm(page);
    const line = form.root.getByText('Trễ · 05/12/2099 · 20:00', { exact: true });
    await expect(line).toBeVisible();
    expect(await style(line, 'color')).toBe(await token(page, '--late'));
    expect(await style(line, 'font-weight')).toBe('600');
    expect(await style(line, 'font-size')).toBe('13px');
    expect(await precedes(form.time, line)).toBe(true);
    expect(await precedes(line, form.created)).toBe(true);
    const [d, l, c] = [await box(form.date), await box(line), await box(form.created)];
    expect(l.y).toBeGreaterThanOrEqual(d.y + d.height);
    expect(c.y).toBeGreaterThanOrEqual(l.y + l.height);
  });

  test(`list/edit-task · C46 · at ${size} the late line is in --late at weight 600`, async ({ page, seedTasks }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: 'dark' });
    await seedTasks([{ title: A, dueAt: DUE }]);
    await page.goto('/');
    await expect(page.getByRole('button', { name: A, exact: true })).toBeVisible();
    await makeLate(page);
    await page.getByRole('button', { name: A, exact: true }).click();
    const line = editForm(page).root.getByText('Trễ · 05/12/2099 · 20:00', { exact: true });
    await expect(line).toBeVisible();
    expect(await style(line, 'color')).toBe(await token(page, '--late'));
    expect(await style(line, 'font-weight')).toBe('600');
  });

  test(`list/edit-task · C51 · #task-invalid at ${size}: "Nhập tên việc" in --late at 13px under "Tên việc", whose border is --late`, async ({
    page,
    seedTasks,
  }) => {
    await page.setViewportSize(viewport);
    await seedTasks([{ title: A, dueAt: DUE }]);
    const form = await openTask(page, A);
    await form.title.fill('');
    await form.save.click();

    const message = form.root.getByText('Nhập tên việc', { exact: true });
    await expect(message).toBeVisible();
    const late = await token(page, '--late');
    expect(await style(message, 'color')).toBe(late);
    expect(await style(message, 'font-size')).toBe('13px');
    expect(await style(form.title, 'border-top-color')).toBe(late);
    expect(await style(form.date, 'border-top-color')).toBe(await token(page, '--line'));
    await expectEnabledSave(page);
    const [t, m, d] = [await box(form.title), await box(message), await box(form.date)];
    expect(m.y).toBeGreaterThanOrEqual(t.y + t.height);
    expect(d.y).toBeGreaterThanOrEqual(m.y + m.height);
    expect(Math.abs(m.x - t.x)).toBeLessThanOrEqual(2);
  });

  test(`list/edit-task · C51 · at ${size} a due error is in --late at 13px under both due fields, which are bordered --late`, async ({
    page,
    seedTasks,
  }) => {
    await page.setViewportSize(viewport);
    await seedTasks([{ title: A, dueAt: DUE }]);
    const form = await openTask(page, A);
    await form.date.fill('');
    await form.save.click();

    const message = form.root.getByText('Chọn ngày cho hạn chót', { exact: true });
    await expect(message).toBeVisible();
    const late = await token(page, '--late');
    expect(await style(message, 'color')).toBe(late);
    expect(await style(message, 'font-size')).toBe('13px');
    expect(await style(form.date, 'border-top-color')).toBe(late);
    expect(await style(form.time, 'border-top-color')).toBe(late);
    const [d, m, c] = [await box(form.date), await box(message), await box(form.created)];
    expect(m.y).toBeGreaterThanOrEqual(d.y + d.height);
    expect(c.y).toBeGreaterThanOrEqual(m.y + m.height);
    expect(Math.abs(m.x - d.x)).toBeLessThanOrEqual(2);
  });
}

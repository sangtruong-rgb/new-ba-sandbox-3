// The input slot against the prototype's #list, #list-empty and #add-invalid (ticket #5, C31):
// elements, order, labels, messages, states, colours and fonts. QC judges the look.
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { DESKTOP, MOBILE, TZ, precedes, resolveColor, style } from '../../shell/helpers';
import { EMPTY_LIST, addForm, box, openList, sameRow } from './helpers';

test.use({ timezoneId: TZ });

const token = (page: Page, name: string) => resolveColor(page, `var(${name})`);

/** The labels, placeholders, order, colours and fonts of the form at rest. */
async function expectFormAtRest(page: Page) {
  const form = addForm(page);
  // the title has focus so the due fields show below 1100px too
  await form.title.focus();

  await expect(form.slot.locator('label')).toHaveText(['Việc mới', 'Ngày hạn', 'Giờ']);
  await expect(form.slot.locator('input')).toHaveCount(3);
  await expect(form.slot.locator('textarea')).toHaveCount(0);
  await expect(form.slot.getByRole('button')).toHaveText(['Thêm']);
  await expect(form.title).toHaveAttribute('placeholder', 'Thêm một việc…');
  await expect(form.date).toHaveAttribute('placeholder', 'dd/mm/yyyy');
  await expect(form.time).toHaveAttribute('placeholder', 'hh:mm');
  expect(await precedes(form.title, form.date)).toBe(true);
  expect(await precedes(form.date, form.time)).toBe(true);
  expect(await precedes(form.time, form.add)).toBe(true);
  await expect(form.add).toBeEnabled();

  for (const field of [form.title, form.date, form.time]) {
    await expect(field).toBeVisible();
    await expect(field).not.toHaveAttribute('aria-invalid', 'true');
    expect(await style(field, 'background-color')).toBe(await token(page, '--paper'));
    expect(await style(field, 'border-top-color')).toBe(await token(page, '--line'));
    expect(await style(field, 'border-top-width')).toBe('1px');
    expect(await style(field, 'border-top-left-radius')).toBe('6px');
    expect(await style(field, 'font-family')).toMatch(/Be Vietnam Pro/);
  }
  const dateLabel = form.slot.locator('label', { hasText: 'Ngày hạn' });
  expect(await style(dateLabel, 'font-size')).toBe('13px');
  expect(await style(dateLabel, 'font-weight')).toBe('600');

  expect(await style(form.add, 'background-color')).toBe(await token(page, '--accent'));
  expect(await style(form.add, 'color')).toBe(await token(page, '--accent-ink'));
  expect(await style(form.add, 'font-weight')).toBe('600');
  expect(await style(form.add, 'border-top-left-radius')).toBe('6px');
  expect(await style(form.add, 'font-family')).toMatch(/Be Vietnam Pro/);
}

/** At 1440: the title takes the room; 160 and 104 wide due fields, 8 apart; "Thêm" level with the inputs. */
async function expectDesktopLayout(page: Page) {
  const form = addForm(page);
  const slot = await box(form.slot);
  const [t, d, h, b] = [await box(form.title), await box(form.date), await box(form.time), await box(form.add)];
  expect(Math.abs(t.x - slot.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(b.x + b.width - (slot.x + slot.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(d.width - 160)).toBeLessThanOrEqual(2);
  expect(Math.abs(h.width - 104)).toBeLessThanOrEqual(2);
  expect(t.width).toBeGreaterThan(d.width * 2);
  expect(Math.abs(d.x - (t.x + t.width) - 8)).toBeLessThanOrEqual(2);
  expect(Math.abs(h.x - (d.x + d.width) - 8)).toBeLessThanOrEqual(2);
  expect(Math.abs(b.x - (h.x + h.width) - 8)).toBeLessThanOrEqual(2);
  expect(Math.abs(d.y - t.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(h.y - t.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(b.y - t.y)).toBeLessThanOrEqual(4);
  await expect(form.slot.locator('label', { hasText: 'Việc mới' })).toBeVisible();
}

/** At 390: title and "Thêm" on the first row; the due fields below, "Giờ" 104 wide at the right. */
async function expectMobileLayout(page: Page) {
  const form = addForm(page);
  const slot = await box(form.slot);
  const [t, d, h, b] = [await box(form.title), await box(form.date), await box(form.time), await box(form.add)];
  expect(await sameRow(form.title, form.add)).toBe(true);
  expect(Math.abs(b.y - t.y)).toBeLessThanOrEqual(4);
  expect(Math.abs(t.x - slot.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(b.x + b.width - (slot.x + slot.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(b.x - (t.x + t.width) - 8)).toBeLessThanOrEqual(2);
  expect(d.y).toBeGreaterThanOrEqual(t.y + t.height);
  expect(Math.abs(d.x - slot.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(h.width - 104)).toBeLessThanOrEqual(2);
  expect(Math.abs(h.x + h.width - (slot.x + slot.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(h.x - (d.x + d.width) - 8)).toBeLessThanOrEqual(2);
}

for (const [name, viewport, layout] of [
  ['1440', DESKTOP, expectDesktopLayout],
  ['390', MOBILE, expectMobileLayout],
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`list/add-task · C31 · #list at ${name} (${scheme}): the add form's elements, order, labels, layout, colours and fonts`, async ({
      page,
      seedTasks,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize(viewport);
      await seedTasks([{ title: 'Mua thuốc huyết áp cho bố' }]);
      await openList(page);
      await expectFormAtRest(page);
      await layout(page);
    });
  }

  test(`list/add-task · C31 · #list-empty at ${name}: the add form stands above the empty-list message`, async ({ page, signedIn }) => {
    void signedIn;
    await page.setViewportSize(viewport);
    const form = await openList(page);
    const empty = page.getByText(EMPTY_LIST, { exact: true });
    await expect(empty).toBeVisible();
    await expectFormAtRest(page);
    await layout(page);
    expect(await precedes(form.slot, empty)).toBe(true);
    const e = await box(empty);
    for (const part of [form.title, form.date, form.time, form.add]) {
      const b = await box(part);
      expect(e.y).toBeGreaterThanOrEqual(b.y + b.height);
    }
  });

  test(`list/add-task · C31 · #add-invalid at ${name}: "Nhập tên việc" in --late at 13px under the title, whose border is --late`, async ({
    page,
    seedTasks,
  }) => {
    await page.setViewportSize(viewport);
    await seedTasks([{ title: 'Mua thuốc huyết áp cho bố' }]);
    const form = await openList(page);
    await form.add.click();

    const message = form.slot.getByText('Nhập tên việc', { exact: true });
    await expect(message).toBeVisible();
    await expect(form.title).toBeFocused();
    const late = await token(page, '--late');
    expect(await style(message, 'color')).toBe(late);
    expect(await style(message, 'font-size')).toBe('13px');
    expect(await style(form.title, 'border-top-color')).toBe(late);
    expect(await style(form.date, 'border-top-color')).toBe(await token(page, '--line'));
    await expect(form.add).toBeEnabled();
    expect(await style(form.add, 'background-color')).toBe(await token(page, '--accent'));

    const t = await box(form.title);
    const m = await box(message);
    expect(m.y).toBeGreaterThanOrEqual(t.y + t.height);
    expect(Math.abs(m.x - t.x)).toBeLessThanOrEqual(2);
    // the error does not push "Thêm" out of line with the title field
    expect(Math.abs((await box(form.add)).y - t.y)).toBeLessThanOrEqual(4);
  });

  test(`list/add-task · C31 · at ${name} a due error is in --late at 13px under the due fields, both bordered --late`, async ({
    page,
    signedIn,
  }) => {
    void signedIn;
    await page.setViewportSize(viewport);
    const form = await openList(page);
    await form.title.fill('Rửa xe');
    await form.time.fill('09:00');
    await form.add.click();

    const message = form.slot.getByText('Chọn ngày cho hạn chót', { exact: true });
    await expect(message).toBeVisible();
    const late = await token(page, '--late');
    expect(await style(message, 'color')).toBe(late);
    expect(await style(message, 'font-size')).toBe('13px');
    expect(await style(form.date, 'border-top-color')).toBe(late);
    expect(await style(form.time, 'border-top-color')).toBe(late);
    const d = await box(form.date);
    const m = await box(message);
    expect(m.y).toBeGreaterThanOrEqual(d.y + d.height);
    // it starts where "Ngày hạn" starts
    expect(Math.abs(m.x - d.x)).toBeLessThanOrEqual(2);
  });
}

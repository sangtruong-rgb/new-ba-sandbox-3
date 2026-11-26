// The item-lead and detail-actions slots against docs/prototypes/todo-v1 #list and #task (C36).
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
  DESKTOP,
  MOBILE,
  actions,
  checkbox,
  deleteButton,
  doneButton,
  paintedShares,
  resolveColor,
  row,
  slot,
  style,
  titleOf,
  undoneButton,
} from './helpers';

const A = 'Gửi hợp đồng thuê nhà';
const B = 'Nộp học phí học kỳ 2';

const box = async (l: Locator) => (await l.boundingBox())!;
const px = async (l: Locator, prop: string) => parseFloat(await style(l, prop));

async function expectTick(page: Page, title: string) {
  const tick = checkbox(page, title);
  const b = await box(tick);
  expect(b.width).toBeCloseTo(18, 0);
  expect(b.height).toBeCloseTo(18, 0);
  const radius = await style(tick, 'border-top-left-radius');
  expect(radius === '50%' || parseFloat(radius) >= 9, `round: ${radius}`).toBe(true);
}

/** The row: an 18px round checkbox first, on the title's line. */
async function expectRowLead(page: Page, title: string) {
  await expectTick(page, title);
  await expect(row(page, title).locator('[data-slot="item-lead"]').getByRole('checkbox')).toHaveCount(1);
  const c = await box(checkbox(page, title));
  const t = await box(titleOf(page, title));
  const r = await box(row(page, title));
  expect(c.x - r.x).toBeLessThanOrEqual(8);
  expect(c.x + c.width).toBeLessThan(t.x);
  expect(Math.abs(c.y + c.height / 2 - (t.y + t.height / 2))).toBeLessThanOrEqual(5);
}

/** The actions: a quiet button, then "Xóa việc" as a link, side by side with a 16px gap. */
async function expectActions(page: Page, toggle: Locator) {
  await expect(actions(page).getByRole('button')).toHaveCount(2);
  await expect(actions(page).getByRole('button').nth(0)).toHaveText(await toggle.innerText());
  await expect(actions(page).getByRole('button').nth(1)).toHaveText('Xóa việc');

  const t = await box(toggle);
  const d = await box(deleteButton(page));
  const area = await box(actions(page));
  expect(Math.abs(t.x - area.x)).toBeLessThanOrEqual(1);
  expect(d.x - (t.x + t.width)).toBeGreaterThanOrEqual(15);
  expect(d.x - (t.x + t.width)).toBeLessThanOrEqual(17);
  expect(Math.abs(t.y + t.height / 2 - (d.y + d.height / 2))).toBeLessThanOrEqual(2);

  const ink = await resolveColor(page, 'var(--ink)');
  expect(await style(toggle, 'background-color')).toBe(await resolveColor(page, 'var(--paper)'));
  expect(await style(toggle, 'color')).toBe(ink);
  expect(await style(toggle, 'border-top-style')).toBe('solid');
  expect(await px(toggle, 'border-top-width')).toBe(1);
  expect(await style(toggle, 'border-top-color')).toBe(await resolveColor(page, 'var(--line)'));
  expect(await style(toggle, 'border-top-left-radius')).toBe('6px');
  expect(await style(toggle, 'font-weight')).toBe('600');
  expect(await style(toggle, 'padding-left')).toBe('18px');
  expect(await style(toggle, 'font-family')).toContain('Be Vietnam Pro');

  const del = deleteButton(page);
  expect(await style(del, 'text-decoration-line')).toContain('underline');
  expect(await style(del, 'color')).toBe(ink);
  expect(await style(del, 'background-color')).toBe('rgba(0, 0, 0, 0)');
  expect(await px(del, 'border-top-width')).toBe(0);
  expect(await style(del, 'padding-left')).toBe('0px');
  expect(await style(del, 'font-family')).toContain('Be Vietnam Pro');
}

for (const [size, viewport] of [
  ['1440', DESKTOP],
  ['390', MOBILE],
] as const) {
  test(`list/done-delete · C36 · at ${size} the rows have a round 18px checkbox before the title; a checked one is a tick in an accent disc`, async ({
    page,
    seedTasks,
  }) => {
    await page.setViewportSize(viewport);
    await seedTasks([{ title: A, dueAt: '2026-11-20T01:00:00.000Z' }, { title: B, done: true }]);
    await page.goto('/');

    await expectRowLead(page, A);
    await expectRowLead(page, B);

    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const accent = await resolveColor(page, 'var(--accent)');
      const accentInk = await resolveColor(page, 'var(--accent-ink)');
      expect(await style(checkbox(page, A), 'border-top-color')).toBe(await resolveColor(page, 'var(--muted)'));
      const [emptyAccent] = await paintedShares(page, checkbox(page, A), [accent]);
      expect(emptyAccent, scheme).toBeLessThan(0.05);
      const [disc, tick] = await paintedShares(page, checkbox(page, B), [accent, accentInk]);
      expect(disc, scheme).toBeGreaterThan(0.5);
      expect(tick, scheme).toBeGreaterThan(0.04);
    }
  });

  test(`list/done-delete · C36 · at ${size} the detail has "Đánh dấu xong" then "Xóa việc", styled and placed as in the prototype`, async ({
    page,
    seedTasks,
  }) => {
    await page.setViewportSize(viewport);
    await seedTasks([{ title: A }]);
    await page.goto('/');
    await titleOf(page, A).click();
    await expect(slot(page, 'detail-actions')).toBeVisible();
    await expect(doneButton(page)).toBeVisible();
    await expectActions(page, doneButton(page));
  });

  test(`list/done-delete · C36 · at ${size} a done task's detail has "Bỏ đánh dấu xong" then "Xóa việc", in the same style`, async ({
    page,
    seedTasks,
  }) => {
    await page.setViewportSize(viewport);
    await seedTasks([{ title: A, done: true }]);
    await page.goto('/');
    await titleOf(page, A).click();
    await expect(undoneButton(page)).toBeVisible();
    await expectActions(page, undoneButton(page));
  });
}

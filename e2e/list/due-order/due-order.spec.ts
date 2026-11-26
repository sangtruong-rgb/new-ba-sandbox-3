// The due-order feature in the browser: order, the late rows and the summary line,
// in light and dark, at the two widths of docs/prototypes/todo-v1 #list.
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { DESKTOP, MOBILE, TZ, hcm, precedes, resolveColor, row, style } from '../../shell/helpers';

test.use({ timezoneId: TZ });

/** Friday 27 November 2026 at h:mi in Hồ Chí Minh City. */
const friday = (h: number, mi: number) => new Date(hcm(2026, 11, 27, h, mi));

const LATE_OLD = 'Gửi hợp đồng thuê nhà đã ký';
const LATE_NEW = 'Nộp học phí học kỳ 2';
const TODAY_A = 'Mua thuốc huyết áp cho bố';
const TODAY_B = 'Họp nhóm chốt kế hoạch quý 1';
const TOMORROW = 'Đặt bàn sinh nhật ở quán quen';
const NO_DUE = 'Học xong bài 7 tiếng Nhật';
const DONE = 'Rửa xe';

// Seeded in an order that is not the expected one.
const SEED = [
  { title: DONE, done: true, dueAt: hcm(2026, 11, 23, 7, 0) },
  { title: TODAY_B, dueAt: hcm(2026, 11, 27, 19, 30) },
  { title: NO_DUE },
  { title: LATE_NEW, dueAt: hcm(2026, 11, 27, 8, 0) },
  { title: TOMORROW, dueAt: hcm(2026, 11, 28, 11, 0) },
  { title: LATE_OLD, dueAt: hcm(2026, 11, 26, 16, 30) },
  { title: TODAY_A, dueAt: hcm(2026, 11, 27, 17, 0) },
];
const ORDER = [LATE_OLD, LATE_NEW, TODAY_A, TODAY_B, TOMORROW, NO_DUE, DONE];
const SUMMARY = '2 việc trễ hạn · 2 việc hôm nay';

const summary = (page: Page) => page.locator('[data-slot="summary"]');
const titleOf = (page: Page, title: string) => page.getByRole('button', { name: title, exact: true });
const dueOf = (page: Page, title: string) => row(page, title).locator('[data-slot="item-lead"] + *');

/** The colour, weight, size and family each non-space character of an element is drawn in, by text range. */
async function drawn(locator: Locator, part: string) {
  return locator.evaluate((root, wanted) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const chars: Array<{ ch: string; el: Element }> = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      for (const ch of n.textContent ?? '') chars.push({ ch, el: n.parentElement! });
    }
    const start = chars.map((c) => c.ch).join('').indexOf(wanted);
    if (start === -1) return [`"${wanted}" is not there`];
    const looks = chars
      .slice(start, start + wanted.length)
      .filter((c) => c.ch.trim() !== '')
      .map((c) => {
        const s = getComputedStyle(c.el);
        return `${s.color} ${s.fontWeight} ${s.fontSize} ${s.fontFamily.split(',')[0].replace(/["']/g, '')}`;
      });
    return [...new Set(looks)];
  }, part);
}

async function expectRowLook(page: Page, title: string, colour: string, weight: string) {
  expect(await style(titleOf(page, title), 'color'), title).toBe(colour);
  expect(await style(titleOf(page, title), 'font-weight'), title).toBe(weight);
}

async function expectLateRow(page: Page, title: string) {
  const late = await resolveColor(page, 'var(--late)');
  await expect(dueOf(page, title)).toHaveText(/^Trễ · /);
  await expectRowLook(page, title, late, '600');
  expect(await style(dueOf(page, title), 'color'), title).toBe(late);
  expect(await style(dueOf(page, title), 'font-weight'), title).toBe('600');
}

async function expectSummaryLook(page: Page) {
  const late = await resolveColor(page, 'var(--late)');
  const muted = await resolveColor(page, 'var(--muted)');
  expect(await drawn(summary(page), '2 việc trễ hạn')).toEqual([`${late} 600 15px Be Vietnam Pro`]);
  expect(await drawn(summary(page), '·')).toEqual([`${muted} 400 15px Be Vietnam Pro`]);
  expect(await drawn(summary(page), '2 việc hôm nay')).toEqual([`${muted} 400 15px Be Vietnam Pro`]);
}

for (const [size, viewport] of [
  ['1440', DESKTOP],
  ['390', MOBILE],
] as const) {
  test(`list/due-order · C41 C37 C38 C39 · at ${size} the date, the summary line, then the rows in due order with the late ones in red`, async ({
    page,
    seedTasks,
  }) => {
    await page.setViewportSize(viewport);
    await seedTasks(SEED);
    await page.clock.install({ time: friday(10, 20) });
    await page.goto('/');

    await expect(summary(page)).toHaveText(SUMMARY, { useInnerText: true });
    expect(await summary(page).textContent()).toBe(SUMMARY);

    const heading = page.getByRole('heading', { name: 'Thứ Sáu, 27 tháng 11', exact: true });
    const filters = page.locator('[data-slot="filters"]');
    expect(await precedes(heading, summary(page))).toBe(true);
    expect(await precedes(summary(page), filters)).toBe(true);
    expect(await precedes(summary(page), titleOf(page, LATE_OLD))).toBe(true);

    // one line under the date, at its left edge, spaced as in the prototype
    const h = (await heading.boundingBox())!;
    const s = (await summary(page).boundingBox())!;
    const f = (await filters.boundingBox())!;
    expect(Math.abs(s.x - h.x)).toBeLessThanOrEqual(1);
    expect(s.height).toBeLessThanOrEqual(25);
    expect(Math.abs(s.y - (h.y + h.height) - 6)).toBeLessThanOrEqual(2);
    expect(Math.abs(f.y - (s.y + s.height) - 18)).toBeLessThanOrEqual(2);

    await expect(page.locator('[data-slot="item-lead"] ~ button')).toHaveText(ORDER);
    await expect(dueOf(page, TODAY_A)).toHaveText('Hôm nay · 17:00');
    await expect(dueOf(page, DONE)).not.toHaveText(/Trễ/);

    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await expectSummaryLook(page);
      await expectLateRow(page, LATE_OLD);
      await expectLateRow(page, LATE_NEW);
      await expectRowLook(page, TODAY_A, await resolveColor(page, 'var(--ink)'), '400');
      expect(await style(dueOf(page, TODAY_A), 'color')).toBe(await resolveColor(page, 'var(--muted)'));
      await expectRowLook(page, DONE, await resolveColor(page, 'var(--muted)'), '400');
    }
  });
}

test('list/due-order · C38 C39 · a task due at 10:05 turns late at 10:05 without a reload, and the summary follows', async ({
  page,
  seedTasks,
}) => {
  await seedTasks([{ title: TODAY_A, dueAt: hcm(2026, 11, 27, 10, 5) }]);
  await page.clock.install({ time: friday(10, 4) });
  await page.goto('/');

  await expect(summary(page)).toHaveText('1 việc hôm nay');
  await expect(dueOf(page, TODAY_A)).toHaveText('Hôm nay · 10:05');
  expect(await style(titleOf(page, TODAY_A), 'font-weight')).toBe('400');
  await page.evaluate(() => Object.assign(window, { notReloaded: true }));

  await page.clock.fastForward('01:00');

  await expect(summary(page)).toHaveText('1 việc trễ hạn');
  await expect(dueOf(page, TODAY_A)).toHaveText('Trễ · Hôm nay · 10:05');
  await expectLateRow(page, TODAY_A);
  expect(await page.evaluate(() => 'notReloaded' in window)).toBe(true);
});

test('list/due-order · C40 · at midnight of the device a task due the next day counts as today, without a reload', async ({
  page,
  seedTasks,
}) => {
  // 01:00 on the 28th in Hồ Chí Minh City is still the 27th in UTC.
  await seedTasks([
    { title: LATE_NEW, dueAt: hcm(2026, 11, 27, 8, 0) },
    { title: TOMORROW, dueAt: hcm(2026, 11, 28, 1, 0) },
  ]);
  await page.clock.install({ time: friday(23, 59) });
  await page.goto('/');

  await expect(summary(page)).toHaveText('1 việc trễ hạn');
  await page.evaluate(() => Object.assign(window, { notReloaded: true }));

  await page.clock.fastForward('01:00');

  await expect(summary(page)).toHaveText('1 việc trễ hạn · 1 việc hôm nay');
  expect(await page.evaluate(() => 'notReloaded' in window)).toBe(true);
});

test('list/due-order · C39 · marking the last late task done empties the line, which then takes no height', async ({
  page,
  seedTasks,
}) => {
  await seedTasks([{ title: LATE_NEW, dueAt: hcm(2026, 11, 27, 8, 0) }]);
  await page.clock.install({ time: friday(10, 20) });
  await page.goto('/');
  await expect(summary(page)).toHaveText('1 việc trễ hạn');

  await page.getByRole('checkbox', { name: `Đánh dấu xong: ${LATE_NEW}`, exact: true }).click();

  await expect(summary(page)).toHaveText('');
  await expect(summary(page)).toBeHidden();
  await expect(dueOf(page, LATE_NEW)).toHaveText('Hôm nay · 08:00');
});

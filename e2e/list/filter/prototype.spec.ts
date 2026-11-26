// The filters slot against the prototype's #list and #filter-done-empty (ticket #8, C45):
// elements, order, labels, messages, states, colours and fonts. QC judges the look.
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { DESKTOP, MOBILE, precedes, resolveColor, style } from '../../shell/helpers';
import { LABELS, box, filters, fontsSettled, tab, textStyles } from './helpers';

const DONE_EMPTY = 'Tick một việc ở Chưa xong, nó sẽ hiện ở đây.';
const FIRST = 'Mua thuốc huyết áp cho bố';

/** Three buttons and nothing else, in one row from the slot's left edge, between the summary and the add form. */
async function expectTabs(page: Page, gap: number, counts: [number, number, number]) {
  const slot = filters(page);
  await expect(slot.getByRole('button')).toHaveText(LABELS.map((l, i) => new RegExp(`^${l}\\s*${counts[i]}$`)));
  expect((await slot.innerText()).replace(/\s+/g, '')).toBe(LABELS.map((l, i) => `${l}${counts[i]}`.replace(/\s+/g, '')).join(''));
  await expect(slot.locator('input, select, a, [role="tab"]')).toHaveCount(0);

  await fontsSettled(page);
  const area = await box(slot);
  const boxes = [];
  for (const label of LABELS) boxes.push(await box(tab(page, label)));
  expect(Math.abs(boxes[0].x - area.x)).toBeLessThanOrEqual(1);
  for (let i = 1; i < boxes.length; i++) {
    expect(Math.abs(boxes[i].y - boxes[0].y), 'one row').toBeLessThanOrEqual(1);
    expect(Math.abs(boxes[i].x - (boxes[i - 1].x + boxes[i - 1].width) - gap), 'the gap').toBeLessThanOrEqual(1);
  }
  for (const b of boxes) {
    // 8px above and below one line of text; the tabs stand on the line the frame draws
    expect(b.height).toBeGreaterThanOrEqual(36);
    expect(b.height).toBeLessThanOrEqual(41);
    expect(Math.abs(b.y + b.height - (area.y + area.height))).toBeLessThanOrEqual(1);
  }

  for (const label of LABELS) {
    const button = tab(page, label);
    expect(await style(button, 'background-color')).toBe('rgba(0, 0, 0, 0)');
    expect(await style(button, 'padding-left')).toBe('0px');
    expect(await style(button, 'padding-right')).toBe('0px');
    for (const side of ['top', 'left', 'right']) {
      expect(await style(button, `border-${side}-width`), `${label} border ${side}`).toBe('0px');
    }
    for (const [part, s] of Object.entries(await textStyles(button))) {
      expect(s, `${label} ${part}`).not.toBeNull();
      expect(s!.family, `${label} ${part} font`).toContain('Be Vietnam Pro');
      expect(s!.size, `${label} ${part} size`).toBe('15px');
    }
  }

  const summary = page.locator('[data-slot="summary"]');
  const input = page.locator('[data-slot="input"]');
  expect(await precedes(summary, slot)).toBe(true);
  expect(await precedes(slot, input)).toBe(true);
  expect(area.y + area.height).toBeLessThanOrEqual((await box(input)).y);
}

async function expectStates(page: Page, chosen: (typeof LABELS)[number]) {
  const ink = await resolveColor(page, 'var(--ink)');
  const muted = await resolveColor(page, 'var(--muted)');
  for (const label of LABELS) {
    const on = label === chosen;
    await expect(tab(page, label)).toHaveAttribute('aria-pressed', String(on));
    const { label: word, count } = await textStyles(tab(page, label));
    expect(word!.color).toBe(on ? ink : muted);
    expect(count!.color).toBe(on ? ink : muted);
  }
}

for (const [size, viewport, gap] of [
  ['1440', DESKTOP, 24],
  ['390', MOBILE, 16],
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`list/filter · C45 · #list at ${size} (${scheme}): the tabs' labels, order, layout, states, colours and fonts`, async ({
      page,
      seedTasks,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize(viewport);
      await seedTasks([{ title: FIRST, dueAt: '2026-11-20T01:00:00.000Z' }, { title: 'Học bài 7 tiếng Nhật' }, { title: 'Rửa xe', done: true }]);
      await page.goto('/');
      await expect(tab(page, 'Tất cả')).toBeVisible();

      await expectTabs(page, gap, [3, 2, 1]);
      await expectStates(page, 'Tất cả');
      await expect(page.getByText(FIRST, { exact: true })).toBeVisible();
      await expect(page.getByText('Rửa xe', { exact: true })).toBeVisible();
    });

    test(`list/filter · C45 · #filter-done-empty at ${size} (${scheme}): "Đã xong 0" chosen and its message below the add form`, async ({
      page,
      seedTasks,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize(viewport);
      await seedTasks([{ title: FIRST }, { title: 'Học bài 7 tiếng Nhật' }]);
      await page.goto('/');
      await tab(page, 'Đã xong').click();

      await expectTabs(page, gap, [2, 2, 0]);
      await expectStates(page, 'Đã xong');

      const message = page.getByText(DONE_EMPTY, { exact: true });
      await expect(message).toBeVisible();
      await expect(page.getByText(FIRST, { exact: true })).toHaveCount(0);
      expect(await style(message, 'color')).toBe(await resolveColor(page, 'var(--muted)'));
      expect(await style(message, 'font-family')).toContain('Be Vietnam Pro');
      const input = page.locator('[data-slot="input"]');
      expect(await precedes(input, message)).toBe(true);
      const form = await box(input);
      expect((await box(message)).y).toBeGreaterThanOrEqual(form.y + form.height);
    });
  }
}

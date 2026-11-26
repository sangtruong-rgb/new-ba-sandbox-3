// The look of the tabs (ticket #8, C42): tabular counts, --muted when not chosen,
// --ink, weight 600 and a 2px --accent line under the chosen one.
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { DESKTOP, MOBILE, resolveColor } from '../../shell/helpers';
import { LABELS, filters, linesAtBottom, tab, textStyles, type Label } from './helpers';

async function expectChosen(page: Page, chosen: Label) {
  const muted = await resolveColor(page, 'var(--muted)');
  const ink = await resolveColor(page, 'var(--ink)');
  const accent = await resolveColor(page, 'var(--accent)');
  for (const label of LABELS) {
    const on = label === chosen;
    const button = tab(page, label);
    await expect(button).toHaveAttribute('aria-pressed', String(on));
    const styles = await textStyles(button);
    for (const [part, s] of Object.entries(styles)) {
      expect(s, `${label} ${part}`).not.toBeNull();
      expect(s!.color, `${label} ${part} colour`).toBe(on ? ink : muted);
      expect(s!.weight, `${label} ${part} weight`).toBe(on ? '600' : '400');
    }
    expect(styles.count!.numeric, `${label} count`).toContain('tabular-nums');

    const line = await linesAtBottom(page, button, accent);
    if (!on) expect(line, `no line under ${label}`).toEqual([]);
    else {
      expect(line, `a 2px line under ${label}`).toHaveLength(2);
      expect(line[1] - line[0]).toBe(1);
      expect(line[0]).toBeGreaterThanOrEqual(-3);
      expect(line[1]).toBeLessThanOrEqual(1);
    }
  }
}

for (const [size, viewport] of [
  ['1440', DESKTOP],
  ['390', MOBILE],
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`list/filter · C42 · at ${size} (${scheme}) the chosen tab is --ink, 600, underlined in --accent; the others are --muted`, async ({
      page,
      seedTasks,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize(viewport);
      await seedTasks([{ title: 'Rửa xe', done: true }, { title: 'Mua sữa' }, { title: 'Đổi bình nước' }]);
      await page.goto('/');
      await expect(filters(page).getByRole('button')).toHaveText([/^Tất cả\s*3$/, /^Chưa xong\s*2$/, /^Đã xong\s*1$/]);

      await expectChosen(page, 'Tất cả');
      for (const next of ['Chưa xong', 'Đã xong'] as const) {
        await tab(page, next).click();
        await expectChosen(page, next);
      }
    });
  }
}

import { test, expect } from '../support/fixtures';
import { DESKTOP, MOBILE, boxOfBackground, resolveColor, style } from './helpers';

const TAGLINE = 'Ghi việc, đặt hạn chót, đánh dấu xong. Mở trên máy nào cũng thấy như nhau.';

const pages = [
  { path: '/dang-nhap', slot: 'sign-in-form' },
  { path: '/dang-ky', slot: 'sign-up-form' },
] as const;

for (const { path, slot } of pages) {
  test.describe(`shell · ${path}`, () => {
    test(`C1 · at 1440 ${path} draws the ink brand panel with Việc and its line on the left (40%), and the form column holding ${slot} on the right`, async ({
      page,
    }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto(path);
      const brandColor = await resolveColor(page, 'var(--brand)');
      const logo = page.getByText('Việc', { exact: true });
      await expect(logo).toBeVisible();
      await expect(page.getByText(TAGLINE, { exact: true })).toBeVisible();

      const panel = await boxOfBackground(logo, brandColor);
      expect(panel).not.toBeNull();
      expect(panel!.x).toBeLessThanOrEqual(1);
      expect(panel!.width).toBeGreaterThan(1440 * 0.4 - 16);
      expect(panel!.width).toBeLessThan(1440 * 0.4 + 16);
      expect(panel!.height).toBeGreaterThan(600);

      const form = page.locator(`[data-slot="${slot}"]`);
      await expect(form).toHaveCount(1);
      const fb = (await form.boundingBox())!;
      expect(fb).not.toBeNull();
      expect(fb.x).toBeGreaterThanOrEqual(panel!.x + panel!.width - 1);

      expect(await style(logo, 'color')).toBe(await resolveColor(page, 'var(--brand-ink)'));
      expect(await style(logo, 'font-family')).toMatch(/Literata/);
    });

    test(`C1 · at 390 ${path} draws the brand panel above the form column holding ${slot}, without its line`, async ({ page }) => {
      await page.setViewportSize(MOBILE);
      await page.goto(path);
      const brandColor = await resolveColor(page, 'var(--brand)');
      const logo = page.getByText('Việc', { exact: true });
      await expect(logo).toBeVisible();
      await expect(page.getByText(TAGLINE, { exact: true })).toBeHidden();
      const panel = await boxOfBackground(logo, brandColor);
      expect(panel).not.toBeNull();
      expect(panel!.width).toBeGreaterThan(390 - 2);

      const form = page.locator(`[data-slot="${slot}"]`);
      await expect(form).toHaveCount(1);
      const fb = (await form.boundingBox())!;
      expect(fb).not.toBeNull();
      expect(fb.y).toBeGreaterThanOrEqual(panel!.y + panel!.height - 1);
    });

    test(`C12 · ${path} uses the page colours and Be Vietnam Pro for the body`, async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto(path);
      await expect(page.locator(`[data-slot="${slot}"]`)).toHaveCount(1);
      const body = page.locator('body');
      expect(await style(body, 'background-color')).toBe(await resolveColor(page, 'var(--bg)'));
      expect(await style(body, 'color')).toBe(await resolveColor(page, 'var(--ink)'));
      expect(await style(body, 'font-family')).toMatch(/Be Vietnam Pro/);
    });
  });
}

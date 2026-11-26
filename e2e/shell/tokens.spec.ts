import { test, expect } from '../support/fixtures';
import { DESKTOP, resolveColor, style } from './helpers';

// The DesignTokens of taste.md, light and dark.
const LIGHT: Record<string, string> = {
  '--bg': '#f5f6f8',
  '--paper': '#ffffff',
  '--ink': '#16213a',
  '--muted': '#566075',
  '--accent': '#1f4fd1',
  '--accent-ink': '#ffffff',
  '--late': '#b4361c',
  '--line': '#dfe3ea',
  '--brand': '#16213a',
  '--brand-ink': '#f5f6f8',
};
const DARK: Record<string, string> = {
  '--bg': '#0e1320',
  '--paper': '#151b2b',
  '--ink': '#e6e9f2',
  '--muted': '#a1aabe',
  '--accent': '#7da2ff',
  '--accent-ink': '#0e1320',
  '--late': '#ff8a6b',
  '--line': '#28314a',
  '--brand': '#1b2338',
  '--brand-ink': '#e6e9f2',
};

for (const [scheme, values] of [
  ['light', LIGHT],
  ['dark', DARK],
] as const) {
  test(`C10 · the ${scheme} tokens, color-scheme and accent-color follow the system`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/dang-nhap');
    await expect(page.locator('[data-slot="sign-in-form"]')).toHaveCount(1);
    for (const [name, hex] of Object.entries(values)) {
      expect(await resolveColor(page, `var(${name})`), name).toBe(await resolveColor(page, hex));
    }
    const html = page.locator('html');
    expect(await style(html, 'color-scheme')).toContain(scheme);
    expect(await style(html, 'accent-color')).toBe(await resolveColor(page, values['--accent']));
  });
}

test('C10 · Literata 600 and Be Vietnam Pro 400 and 600 are embedded from @fontsource', async ({ page }) => {
  await page.goto('/dang-nhap');
  await expect(page.locator('[data-slot="sign-in-form"]')).toHaveCount(1);
  const loaded = await page.evaluate(async () => {
    const out: Record<string, string[]> = {};
    for (const spec of ['600 36px "Literata"', '400 15px "Be Vietnam Pro"', '600 15px "Be Vietnam Pro"']) {
      const faces = await document.fonts.load(spec, 'Việc Thứ Sáu');
      out[spec] = faces.map((f) => `${f.family.replace(/["']/g, '')} ${f.weight}`);
    }
    return out;
  });
  expect(loaded['600 36px "Literata"']).toContain('Literata 600');
  expect(loaded['400 15px "Be Vietnam Pro"']).toContain('Be Vietnam Pro 400');
  expect(loaded['600 15px "Be Vietnam Pro"']).toContain('Be Vietnam Pro 600');
});

test('C12 · on the list page the date title is Literata, the page is --bg and the detail column is --paper', async ({ page, seedTasks }) => {
  await page.setViewportSize(DESKTOP);
  await seedTasks([{ title: 'Mua thuốc huyết áp cho bố' }]);
  await page.goto('/');
  const title = page.getByRole('heading', { level: 1 });
  await expect(title).toBeVisible();
  expect(await style(title, 'font-family')).toMatch(/Literata/);
  expect(await style(page.locator('body'), 'background-color')).toBe(await resolveColor(page, 'var(--bg)'));
  expect(await style(page.locator('body'), 'font-family')).toMatch(/Be Vietnam Pro/);
  const hint = page.getByText('Chọn một việc để xem và sửa.', { exact: true });
  await expect(hint).toBeVisible();
  const paper = await resolveColor(page, 'var(--paper)');
  const column = await hint.evaluate((el) => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
    }
    return '';
  });
  expect(column).toBe(paper);
  expect(await style(hint, 'color')).toBe(await resolveColor(page, 'var(--muted)'));
});

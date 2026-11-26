// Helpers for the filter e2e of ticket #8.
import type { Locator, Page } from '@playwright/test';
import { expect } from '../../support/fixtures';

export const LABELS = ['Tất cả', 'Chưa xong', 'Đã xong'] as const;
export type Label = (typeof LABELS)[number];

export const filters = (page: Page) => page.locator('[data-slot="filters"]');
export const tab = (page: Page, label: Label) =>
  filters(page).getByRole('button', { name: new RegExp(`^${label}\\s*\\d+$`) });

/** Waits for the web fonts the page uses: a swap between two measurements moves the tabs. */
export async function fontsSettled(page: Page) {
  await page.evaluate(async () => {
    document.body.getBoundingClientRect(); // lay out first, so the fonts in use have started to load
    await document.fonts.ready;
  });
}

export async function box(locator: Locator) {
  const b = await locator.boundingBox();
  expect(b, 'the element is drawn').not.toBeNull();
  return b!;
}

/** The computed style of the element that directly holds the tab's label, and of the one holding its count. */
export function textStyles(button: Locator) {
  return button.evaluate((el) => {
    const read = (match: RegExp) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!match.test(n.textContent ?? '')) continue;
        const s = getComputedStyle(n.parentElement!);
        return {
          color: s.color,
          weight: s.fontWeight,
          family: s.fontFamily,
          size: s.fontSize,
          numeric: s.fontVariantNumeric,
        };
      }
      return null;
    };
    return { label: read(/\p{L}/u), count: read(/\d/) };
  });
}

/**
 * The rows of pixels around the bottom edge of an element that are painted `rgb` across its width,
 * as offsets from that edge (-1 is the last row inside the element).
 */
export async function linesAtBottom(page: Page, locator: Locator, rgb: string): Promise<number[]> {
  await fontsSettled(page);
  const b = await box(locator);
  const bottom = Math.round(b.y + b.height);
  const clip = { x: Math.ceil(b.x) + 1, y: bottom - 6, width: Math.floor(b.width) - 2, height: 9 };
  const png = (await page.screenshot({ clip })).toString('base64');
  const painted = await page.evaluate(
    async ({ png, rgb }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const g = canvas.getContext('2d')!;
      g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, img.width, img.height).data;
      const want = rgb.match(/\d+/g)!.slice(0, 3).map(Number);
      const out: number[] = [];
      for (let y = 0; y < img.height; y++) {
        let hits = 0;
        for (let x = 0; x < img.width; x++) {
          const i = (y * img.width + x) * 4;
          if (want.every((v, k) => Math.abs(data[i + k] - v) <= 30)) hits++;
        }
        if (hits / img.width > 0.9) out.push(y);
      }
      return out;
    },
    { png, rgb },
  );
  return painted.map((y) => y - 6);
}

// Helpers for the done-delete e2e of ticket #6. Not production code.
import type { Locator, Page } from '@playwright/test';

export const DESKTOP = { width: 1440, height: 900 };
export const MOBILE = { width: 390, height: 844 };
export const FAILED = 'Không lưu được. Thử lại.';
export const HINT = 'Chọn một việc để xem và sửa.';

export const slot = (page: Page, name: string) => page.locator(`[data-slot="${name}"]`);

/** The round checkbox of a task's row. */
export const checkbox = (page: Page, title: string) =>
  page.getByRole('checkbox', { name: `Đánh dấu xong: ${title}`, exact: true });

/** The title of a task's row (the frame's button). */
export const titleOf = (page: Page, title: string) => page.getByRole('button', { name: title, exact: true });

/** The innermost element holding a row's item-lead and its title. */
export const row = (page: Page, title: string) =>
  page
    .locator('*')
    .filter({ has: page.locator('[data-slot="item-lead"]') })
    .filter({ has: titleOf(page, title) })
    .last();

export const actions = (page: Page) => slot(page, 'detail-actions');
export const doneButton = (page: Page) => actions(page).getByRole('button', { name: 'Đánh dấu xong', exact: true });
export const undoneButton = (page: Page) => actions(page).getByRole('button', { name: 'Bỏ đánh dấu xong', exact: true });
export const deleteButton = (page: Page) => actions(page).getByRole('button', { name: 'Xóa việc', exact: true });

export const decoration = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).textDecorationLine);

export const style = (locator: Locator, prop: string) =>
  locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

/** The rgb() a CSS colour (a token like var(--paper)) resolves to on the page. */
export const resolveColor = (page: Page, css: string) =>
  page.evaluate((value) => {
    const el = document.createElement('span');
    el.style.color = value;
    document.body.appendChild(el);
    const out = getComputedStyle(el).color;
    el.remove();
    return out;
  }, css);

/** The share of pixels near each colour, in the middle of what the element paints (radius 7px). */
export async function paintedShares(page: Page, locator: Locator, colours: string[]): Promise<number[]> {
  const png = (await locator.screenshot()).toString('base64');
  return page.evaluate(
    async ({ png, colours }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const g = canvas.getContext('2d')!;
      g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, img.width, img.height).data;
      const wanted = colours.map((c) => c.match(/\d+/g)!.slice(0, 3).map(Number));
      const hits = wanted.map(() => 0);
      let total = 0;
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          if (Math.hypot(x + 0.5 - img.width / 2, y + 0.5 - img.height / 2) > 7) continue;
          total++;
          const i = (y * img.width + x) * 4;
          wanted.forEach((rgb, n) => {
            if (rgb.every((v, k) => Math.abs(data[i + k] - v) <= 60)) hits[n]++;
          });
        }
      }
      return hits.map((h) => h / total);
    },
    { png, colours },
  );
}

/** Holds every request of `method` matching `url` until release(); then it goes to the server. */
export async function hold(page: Page, method: 'POST' | 'DELETE', url: string) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let seen = 0;
  await page.route(url, async (route) => {
    if (route.request().method() !== method) return route.fallback();
    seen += 1;
    await gate;
    await route.fallback();
  });
  return { release, count: () => seen };
}

export type Failure = 'no answer' | 500 | 503;

/** Makes every request of `method` matching `url` fail. */
export async function fail(page: Page, method: 'POST' | 'DELETE', url: string, how: Failure) {
  await page.route(url, async (route) => {
    if (route.request().method() !== method) return route.fallback();
    if (how === 'no answer') return route.abort('failed');
    await route.fulfill({ status: how, contentType: 'application/json', body: JSON.stringify({ error: 'server_error' }) });
  });
}

export const DONE_URL = '**/api/tasks/*/done';
export const TASK_URL = '**/api/tasks/*';

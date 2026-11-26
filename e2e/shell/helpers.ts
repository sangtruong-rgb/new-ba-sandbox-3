// Helpers for the shell e2e of ticket #2. Not production code.
import type { Locator, Page } from '@playwright/test';

export const DESKTOP = { width: 1440, height: 900 };
export const MOBILE = { width: 390, height: 844 };

/** The rgb() a CSS colour (a token like var(--paper), or a hex) resolves to on the page. */
export async function resolveColor(page: Page, css: string): Promise<string> {
  return page.evaluate((value) => {
    const el = document.createElement('span');
    el.style.color = value;
    document.body.appendChild(el);
    const out = getComputedStyle(el).color;
    el.remove();
    return out;
  }, css);
}

export async function style(locator: Locator, prop: string): Promise<string> {
  return locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
}

/** Does `a` come before `b` in the document? */
export async function precedes(a: Locator, b: Locator): Promise<boolean> {
  const handleB = await b.elementHandle();
  return a.evaluate((x, y) => !!y && !!(x.compareDocumentPosition(y as Node) & Node.DOCUMENT_POSITION_FOLLOWING), handleB);
}

/** The row of the list that holds a title: the innermost element with an item-lead and that title. */
export function row(page: Page, title: string): Locator {
  return page
    .locator('*')
    .filter({ has: page.locator('[data-slot="item-lead"]') })
    .filter({ hasText: title })
    .last();
}

/** The nearest ancestor (or the element itself) with a painted background, as rgb(). */
export async function paintedBackground(locator: Locator): Promise<string> {
  return locator.evaluate((el) => {
    let node: Element | null = el;
    while (node) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg;
      node = node.parentElement;
    }
    return '';
  });
}

/** The box of the nearest ancestor (or itself) whose background is `rgb`. */
export async function boxOfBackground(locator: Locator, rgb: string) {
  return locator.evaluate((el, want) => {
    let node: Element | null = el;
    while (node) {
      if (getComputedStyle(node).backgroundColor === want) {
        const r = node.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }
      node = node.parentElement;
    }
    return null;
  }, rgb);
}

/** Local wall-clock time in Asia/Ho_Chi_Minh (UTC+7, no DST) as an ISO UTC string. */
export function hcm(y: number, m: number, d: number, h = 0, mi = 0): string {
  return new Date(Date.UTC(y, m - 1, d, h - 7, mi)).toISOString();
}

export const TZ = 'Asia/Ho_Chi_Minh';

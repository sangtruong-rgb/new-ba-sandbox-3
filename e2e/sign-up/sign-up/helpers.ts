// Helpers for the sign-up e2e of ticket #3. Not production code.
import type { Locator, Page } from '@playwright/test';

export const DESKTOP = { width: 1440, height: 900 };
export const MOBILE = { width: 390, height: 844 };

export const SIGN_UP_PATH = '/api/auth/sign-up';

let counter = 0;

/** A lower-case email no other test uses. */
export function uniqueEmail(prefix = 'dk'): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export const pathOf = (url: string) => {
  const u = new URL(url);
  return u.pathname + u.search;
};

/** The sign-up-form slot and what it holds, found by role and label. */
export function form(page: Page) {
  const slot = page.locator('[data-slot="sign-up-form"]');
  return {
    slot,
    heading: slot.getByRole('heading', { name: 'Tạo tài khoản', exact: true }),
    email: slot.getByLabel('Email', { exact: true }),
    password: slot.getByLabel('Mật khẩu', { exact: true }),
    submit: slot.getByRole('button', { name: 'Tạo tài khoản', exact: true }),
    busy: slot.getByRole('button', { name: 'Đang tạo…', exact: true }),
  };
}

/** Counts every request the page makes to POST /api/auth/sign-up. */
export function countSignUps(page: Page): () => number {
  let n = 0;
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === SIGN_UP_PATH) n += 1;
  });
  return () => n;
}

/** The error of a field: the element its input names in aria-describedby. */
export async function errorOf(page: Page, input: Locator): Promise<Locator> {
  const ids = (await input.getAttribute('aria-describedby')) ?? '';
  const id = ids.trim().split(/\s+/)[0];
  if (!id) throw new Error('the input has no aria-describedby');
  return page.locator(`[id="${id}"]`);
}

/** Does `a` come before `b` in the document? */
export async function precedes(a: Locator, b: Locator): Promise<boolean> {
  const handleB = await b.elementHandle();
  return a.evaluate((x, y) => !!y && !!(x.compareDocumentPosition(y as Node) & Node.DOCUMENT_POSITION_FOLLOWING), handleB);
}

/** Is the top of `below` at or under the bottom of `above` on screen? */
export async function isBelow(above: Locator, below: Locator): Promise<boolean> {
  const a = (await above.boundingBox())!;
  const b = (await below.boundingBox())!;
  return !!a && !!b && b.y >= a.y + a.height - 1;
}

/** The rgb() a CSS colour (a token like var(--late)) resolves to on the page. */
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

export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

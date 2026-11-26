// Helpers for the session e2e of ticket #4. Not production code.
import { expect, type Locator, type Page } from '@playwright/test';
import type { Task } from '../../src/shared/tasks/types';

export const DESKTOP = { width: 1440, height: 900 };
export const MOBILE = { width: 390, height: 844 };
export const PASSWORD = 'test-password-1';

export const WRONG = 'Email hoặc mật khẩu không đúng.';
export const ENDED = 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.';
export const FAILED = 'Không đăng nhập được. Thử lại.';
export const NEED_EMAIL = 'Nhập email';
export const NEED_PASSWORD = 'Nhập mật khẩu';
export const SIGNING_IN = 'Đang đăng nhập…';

let counter = 0;

/** A unique lower-case email for this test. */
export function uniqueEmail(tag: string): string {
  counter += 1;
  return `${tag}-${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/**
 * An account with the test password and its tasks, made through the test endpoints;
 * the page's context is left with no cookie, so nobody is signed in.
 */
export async function account(page: Page, email: string, tasks: Array<{ title: string; done?: boolean; dueAt?: string | null }> = []) {
  const res = await page.request.post('/api/test/session', { data: { email } });
  expect(res.status(), await res.text()).toBe(200);
  let seeded: Task[] = [];
  if (tasks.length) {
    const t = await page.request.post('/api/test/tasks', { data: { tasks } });
    expect(t.status(), await t.text()).toBe(200);
    seeded = (await t.json()) as Task[];
  }
  await page.context().clearCookies();
  return seeded;
}

export const path = (url: string) => {
  const u = new URL(url);
  return u.pathname + u.search;
};

/** The sign-in-form slot and the controls in it. */
export function form(page: Page) {
  const slot = page.locator('[data-slot="sign-in-form"]');
  return {
    slot,
    heading: slot.getByRole('heading', { name: 'Đăng nhập', exact: true }),
    email: slot.getByLabel('Email', { exact: true }),
    emailLabel: slot.locator('label').filter({ hasText: /^Email$/ }),
    password: slot.getByLabel('Mật khẩu', { exact: true }),
    passwordLabel: slot.locator('label').filter({ hasText: /^Mật khẩu$/ }),
    /** The one button of the form, whatever it reads. */
    submit: slot.getByRole('button'),
    signUp: slot.getByRole('link', { name: 'Tạo tài khoản', exact: true }),
  };
}

/** Every request the page sends to POST /api/auth/sign-in from now on. */
export function signInRequests(page: Page): string[] {
  const sent: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/auth/sign-in') sent.push(req.postData() ?? '');
  });
  return sent;
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

/** Does `a` come before `b` in the document? */
export async function precedes(a: Locator, b: Locator): Promise<boolean> {
  const handleB = await b.elementHandle();
  return a.evaluate((x, y) => !!y && !!(x.compareDocumentPosition(y as Node) & Node.DOCUMENT_POSITION_FOLLOWING), handleB);
}

/** How many lines the text of an element takes on screen. */
export async function lineCount(locator: Locator): Promise<number> {
  return locator.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = new Set<number>();
    for (const r of Array.from(range.getClientRects())) {
      if (r.width > 0 && r.height > 0) tops.add(Math.round(r.top));
    }
    return tops.size;
  });
}

/** `a` sits wholly above `b` on screen. */
export async function above(a: Locator, b: Locator): Promise<boolean> {
  const ba = await a.boundingBox();
  const bb = await b.boundingBox();
  if (!ba || !bb) return false;
  return ba.y + ba.height <= bb.y + 1;
}

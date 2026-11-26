// The sign-in-form slot against the prototype's #sign-in, #sign-in-error and #session-ended,
// and the header-action slot against #list, at 1440 and 390 wide (C25): elements, order,
// labels and messages, states, and the colours and fonts the prototype gives them.
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { DESKTOP, ENDED, MOBILE, WRONG, above, account, form, path, precedes, resolveColor, style, uniqueEmail } from './helpers';

const ALT = 'Chưa có tài khoản? Tạo tài khoản';

const widths = [
  { name: '1440', size: DESKTOP },
  { name: '390', size: MOBILE },
] as const;

/** Each locator comes before the next in the document and sits lower (or level) on screen. */
async function inOrder(items: Locator[]) {
  for (let i = 0; i + 1 < items.length; i++) {
    expect(await precedes(items[i], items[i + 1]), `item ${i} comes before item ${i + 1}`).toBe(true);
    const a = (await items[i].boundingBox())!;
    const b = (await items[i + 1].boundingBox())!;
    expect(a, `item ${i} is on screen`).not.toBeNull();
    expect(b, `item ${i + 1} is on screen`).not.toBeNull();
    expect(a.y, `item ${i} is not below item ${i + 1}`).toBeLessThanOrEqual(b.y + 1);
  }
}

async function checkForm(page: Page) {
  const f = form(page);
  await expect(f.slot).toHaveCount(1);
  await expect(f.heading).toBeVisible();
  await expect(f.slot.getByRole('heading', { level: 1, name: 'Đăng nhập', exact: true })).toHaveCount(1);
  await expect(f.email).toBeVisible();
  await expect(f.email).toHaveAttribute('type', 'email');
  await expect(f.password).toBeVisible();
  await expect(f.password).toHaveAttribute('type', 'password');
  const submit = f.slot.getByRole('button', { name: 'Đăng nhập', exact: true });
  await expect(submit).toBeVisible();
  await expect(f.submit).toHaveCount(1);
  const alt = f.slot.getByText(ALT, { exact: true });
  await expect(alt).toBeVisible();
  await expect(f.signUp).toHaveAttribute('href', '/dang-ky');
  // the slot draws everything in it: heading, the form and the link, all inside the slot
  await expect(f.slot.locator('form')).toHaveCount(1);
  await expect(f.slot.locator('form').getByLabel('Email', { exact: true })).toHaveCount(1);
  await expect(f.slot.locator('form').getByLabel('Mật khẩu', { exact: true })).toHaveCount(1);
  await expect(f.slot.locator('form').getByRole('button', { name: 'Đăng nhập', exact: true })).toHaveCount(1);
  await inOrder([f.heading, f.emailLabel, f.email, f.passwordLabel, f.password, submit, alt]);

  // colours and fonts of the prototype
  expect(await style(f.heading, 'font-family')).toMatch(/Literata/);
  expect(await style(f.heading, 'font-weight')).toBe('600');
  expect(await style(f.email, 'font-family')).toMatch(/Be Vietnam Pro/);
  expect(await style(submit, 'font-family')).toMatch(/Be Vietnam Pro/);
  expect(await style(submit, 'background-color')).toBe(await resolveColor(page, 'var(--accent)'));
  expect(await style(submit, 'color')).toBe(await resolveColor(page, 'var(--accent-ink)'));
  expect(await style(f.email, 'background-color')).toBe(await resolveColor(page, 'var(--paper)'));
  expect(await style(f.signUp, 'color')).toBe(await resolveColor(page, 'var(--ink)'));
  return { f, submit, alt };
}

for (const { name, size } of widths) {
  test.describe(`session · prototype at ${name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(size);
    });

    test(`session · C25 · at ${name} the sign-in-form slot matches #sign-in: heading, Email, Mật khẩu, Đăng nhập, then "${ALT}" linking to /dang-ky`, async ({
      page,
    }) => {
      await page.goto('/dang-nhap');
      const { f } = await checkForm(page);
      await expect(f.email).toHaveValue('');
      await expect(f.password).toHaveValue('');
      await expect(page.getByText(ENDED, { exact: true })).toHaveCount(0);
      await expect(page.getByText(WRONG, { exact: true })).toHaveCount(0);

      await f.signUp.click();
      await expect.poll(() => path(page.url())).toBe('/dang-ky');
      await expect(page.locator('[data-slot="sign-up-form"]')).toHaveCount(1);
    });

    test(`session · C25 · at ${name} the sign-in-form slot matches #sign-in-error: the message after the heading and above Email, the email kept, the password emptied`, async ({
      page,
    }) => {
      const email = uniqueEmail('c25-err');
      await account(page, email);
      await page.goto('/dang-nhap');
      const f = form(page);
      await f.email.fill(email);
      await f.password.fill('mat-khau-sai-1');
      await f.slot.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      const message = f.slot.getByText(WRONG, { exact: true });
      await expect(message).toBeVisible();

      await checkForm(page);
      await inOrder([f.heading, message, f.emailLabel]);
      expect(await above(message, f.emailLabel)).toBe(true);
      expect(await style(message, 'color')).toBe(await resolveColor(page, 'var(--late)'));
      expect(await style(message, 'font-weight')).toBe('600');
      await expect(f.email).toHaveValue(email);
      await expect(f.password).toHaveValue('');
      await expect(page.getByText(ENDED, { exact: true })).toHaveCount(0);
    });

    test(`session · C25 · at ${name} the sign-in-form slot matches #session-ended: the line after the heading and above Email, in ink`, async ({
      page,
    }) => {
      await page.goto('/dang-nhap?het-phien=1');
      const f = form(page);
      const message = f.slot.getByText(ENDED, { exact: true });
      await expect(message).toBeVisible();

      await checkForm(page);
      await inOrder([f.heading, message, f.emailLabel]);
      expect(await above(message, f.emailLabel)).toBe(true);
      expect(await style(message, 'color')).toBe(await resolveColor(page, 'var(--ink)'));
      expect(await style(message, 'font-weight')).toBe('600');
      await expect(page.getByText(WRONG, { exact: true })).toHaveCount(0);
    });

    test(`session · C25 · at ${name} the header-action slot matches #list: a link-style button "Đăng xuất" at the right end of the header`, async ({
      page,
      signedIn,
    }) => {
      await page.goto('/');
      const header = page.locator('header');
      const slot = header.locator('[data-slot="header-action"]');
      const button = slot.getByRole('button', { name: 'Đăng xuất', exact: true });
      await expect(button).toBeVisible();
      await expect(slot.getByRole('button')).toHaveCount(1);
      await expect(slot.getByRole('link')).toHaveCount(0);

      const email = header.getByText(signedIn.email, { exact: true });
      await expect(email).toHaveCount(1);
      expect(await precedes(email, button)).toBe(true);
      if (name === '1440') {
        await expect(email).toBeVisible();
        const e = (await email.boundingBox())!;
        const b = (await button.boundingBox())!;
        expect(b.x).toBeGreaterThanOrEqual(e.x + e.width);
      }
      const b = (await button.boundingBox())!;
      expect(b.x + b.width).toBeGreaterThan(size.width * 0.75);
      expect(b.x + b.width).toBeLessThanOrEqual(size.width);

      // a link look: no fill, underlined, in ink, the body font
      expect(await style(button, 'background-color')).toBe('rgba(0, 0, 0, 0)');
      expect(await style(button, 'text-decoration-line')).toBe('underline');
      expect(await style(button, 'color')).toBe(await resolveColor(page, 'var(--ink)'));
      expect(await style(button, 'font-family')).toMatch(/Be Vietnam Pro/);
    });
  });
}

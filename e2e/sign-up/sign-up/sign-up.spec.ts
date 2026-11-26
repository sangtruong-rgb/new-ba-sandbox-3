// e2e of ticket #3: signing up with an email and a password on /dang-ky.
import { test, expect } from '../../support/fixtures';
import {
  DESKTOP,
  MOBILE,
  SIGN_UP_PATH,
  countSignUps,
  deferred,
  errorOf,
  form,
  isBelow,
  pathOf,
  precedes,
  resolveColor,
  style,
  uniqueEmail,
} from './helpers';

const EMPTY = 'Chưa có việc nào. Thêm việc đầu tiên ở ô phía trên.';
const INVALID_EMAIL = 'Email không hợp lệ';
const SHORT_PASSWORD = 'Mật khẩu cần ít nhất 8 ký tự';
const TAKEN = 'Email này đã có tài khoản.';
const FAILED = 'Không tạo được tài khoản. Thử lại.';
const GOOD_PASSWORD = 'mat-khau-dai';

async function openSignUp(page: import('@playwright/test').Page) {
  await page.goto('/dang-ky');
  const f = form(page);
  await expect(f.slot).toHaveCount(1);
  await expect(f.email).toBeVisible();
  return f;
}

test.describe('sign-up/sign-up · creating an account', () => {
  test('sign-up/sign-up · C13 · filling Email and Mật khẩu and pressing Tạo tài khoản creates the account, signs in and lands on / with the empty list', async ({
    page,
  }) => {
    const email = uniqueEmail();
    const f = await openSignUp(page);
    await f.email.fill(email);
    await f.password.fill(GOOD_PASSWORD);
    const answer = page.waitForResponse((r) => new URL(r.url()).pathname === SIGN_UP_PATH);
    await f.submit.click();
    expect((await answer).status()).toBe(201);

    await expect.poll(() => pathOf(page.url())).toBe('/');
    await expect(page.getByText(EMPTY, { exact: true })).toBeVisible();
    await expect(page.locator('header').getByText(email, { exact: true })).toBeVisible();

    // the browser holds a session of the new account
    const me = await page.request.get('/api/me');
    expect(me.status()).toBe(200);
    expect(((await me.json()) as { email: string }).email).toBe(email);

    // and it stays signed in after a reload
    await page.reload();
    await expect(page.getByText(EMPTY, { exact: true })).toBeVisible();
    expect(pathOf(page.url())).toBe('/');
  });
});

test.describe('sign-up/sign-up · checking what was typed', () => {
  test('sign-up/sign-up · C14 · an email with no dot after the "@" and a short password show both errors under their fields; nothing is sent; values stay; focus on Email', async ({
    page,
  }) => {
    const sent = countSignUps(page);
    const f = await openSignUp(page);
    await f.email.fill('thu.ha@example');
    await f.password.fill('abc123');
    await f.submit.click();

    const emailError = await errorOf(page, f.email);
    const passwordError = await errorOf(page, f.password);
    await expect(emailError).toHaveText(INVALID_EMAIL);
    await expect(passwordError).toHaveText(SHORT_PASSWORD);
    await expect(f.email).toHaveAttribute('aria-invalid', 'true');
    await expect(f.password).toHaveAttribute('aria-invalid', 'true');

    // under their fields: each after its input, the email error before the password field
    expect(await isBelow(f.email, emailError)).toBe(true);
    expect(await precedes(f.email, emailError)).toBe(true);
    expect(await precedes(emailError, f.password)).toBe(true);
    expect(await isBelow(f.password, passwordError)).toBe(true);
    expect(await precedes(f.password, passwordError)).toBe(true);
    expect(await precedes(passwordError, f.submit)).toBe(true);

    await expect(f.email).toHaveValue('thu.ha@example');
    await expect(f.password).toHaveValue('abc123');
    await expect(f.email).toBeFocused();

    await page.waitForTimeout(300);
    expect(sent()).toBe(0);
    expect(pathOf(page.url())).toBe('/dang-ky');
  });

  test('sign-up/sign-up · C14 · an email with no "@" shows "Email không hợp lệ" under Email only, and focus moves to Email', async ({ page }) => {
    const sent = countSignUps(page);
    const f = await openSignUp(page);
    await f.email.fill('thu.ha.example.com');
    await f.password.fill(GOOD_PASSWORD);
    await f.password.focus();
    await f.submit.click();

    await expect(await errorOf(page, f.email)).toHaveText(INVALID_EMAIL);
    await expect(f.email).toBeFocused();
    await expect(f.password).not.toHaveAttribute('aria-invalid', 'true');
    await expect(f.slot.getByText(SHORT_PASSWORD, { exact: true })).toHaveCount(0);
    await expect(f.email).toHaveValue('thu.ha.example.com');
    await expect(f.password).toHaveValue(GOOD_PASSWORD);

    await page.waitForTimeout(300);
    expect(sent()).toBe(0);
  });

  test('sign-up/sign-up · C14 · an email whose only dot is before the "@" is not valid', async ({ page }) => {
    const sent = countSignUps(page);
    const f = await openSignUp(page);
    await f.email.fill('ho.ten@localhost');
    await f.password.fill(GOOD_PASSWORD);
    await f.submit.click();
    await expect(await errorOf(page, f.email)).toHaveText(INVALID_EMAIL);
    await expect(f.email).toHaveValue('ho.ten@localhost');
    await page.waitForTimeout(300);
    expect(sent()).toBe(0);
  });

  test('sign-up/sign-up · C14 · spaces alone are not an email', async ({ page }) => {
    const sent = countSignUps(page);
    const f = await openSignUp(page);
    await f.email.fill('    ');
    await f.password.fill(GOOD_PASSWORD);
    await f.submit.click();
    await expect(await errorOf(page, f.email)).toHaveText(INVALID_EMAIL);
    await page.waitForTimeout(300);
    expect(sent()).toBe(0);
  });

  test('sign-up/sign-up · C14 · a password of 7 characters shows "Mật khẩu cần ít nhất 8 ký tự" under Mật khẩu only, and focus moves to Mật khẩu', async ({
    page,
  }) => {
    const sent = countSignUps(page);
    const f = await openSignUp(page);
    const email = uniqueEmail();
    await f.email.fill(email);
    await f.password.fill('1234567');
    await f.email.focus();
    await f.submit.click();

    await expect(await errorOf(page, f.password)).toHaveText(SHORT_PASSWORD);
    await expect(f.password).toBeFocused();
    await expect(f.email).not.toHaveAttribute('aria-invalid', 'true');
    await expect(f.slot.getByText(INVALID_EMAIL, { exact: true })).toHaveCount(0);
    await expect(f.email).toHaveValue(email);
    await expect(f.password).toHaveValue('1234567');

    await page.waitForTimeout(300);
    expect(sent()).toBe(0);
  });

  test('sign-up/sign-up · C14 · an email with spaces around it and a password of exactly 8 characters are accepted and sent', async ({ page }) => {
    const sent = countSignUps(page);
    const email = uniqueEmail();
    const f = await openSignUp(page);
    await f.email.fill(`   ${email}   `);
    await f.password.fill('12345678');
    await f.submit.click();
    await expect.poll(() => pathOf(page.url())).toBe('/');
    expect(sent()).toBe(1);
    await expect(page.getByText(INVALID_EMAIL, { exact: true })).toHaveCount(0);
    const me = await page.request.get('/api/me');
    expect(((await me.json()) as { email: string }).email).toBe(email);
  });
});

test.describe('sign-up/sign-up · an email that already has an account', () => {
  test('sign-up/sign-up · C15 · the email in another case with spaces around it shows "Email này đã có tài khoản." under Email with a link Đăng nhập to /dang-nhap; no session, no second account', async ({
    page,
    request,
  }) => {
    // the account, made in a separate request context so the page stays signed out
    const email = uniqueEmail('co-roi');
    const made = await request.post('/api/test/session', { data: { email } });
    expect(made.status()).toBe(200);
    const existing = (await made.json()) as { id: string };

    const f = await openSignUp(page);
    const typed = `  ${email.toUpperCase()}  `;
    await f.email.fill(typed);
    await f.password.fill(GOOD_PASSWORD);
    const answer = page.waitForResponse((r) => new URL(r.url()).pathname === SIGN_UP_PATH);
    await f.submit.click();
    expect((await answer).status()).toBe(409);

    const emailError = await errorOf(page, f.email);
    await expect(emailError).toContainText(TAKEN);
    expect(await isBelow(f.email, emailError)).toBe(true);
    expect(await precedes(emailError, f.password)).toBe(true);
    const link = emailError.getByRole('link', { name: 'Đăng nhập', exact: true });
    await expect(link).toHaveAttribute('href', '/dang-nhap');

    await expect(f.email).toHaveValue(typed);
    expect(pathOf(page.url())).toBe('/dang-ky');

    // not signed in, and the account is still the first one
    const me = await page.request.get('/api/me');
    expect(me.status()).toBe(401);
    const again = await request.post('/api/test/session', { data: { email } });
    expect(((await again.json()) as { id: string }).id).toBe(existing.id);

    await link.click();
    await expect.poll(() => pathOf(page.url())).toBe('/dang-nhap');
  });
});

test.describe('sign-up/sign-up · while sending, and when it fails', () => {
  test('sign-up/sign-up · C17 · while the request is in flight the button is disabled and reads "Đang tạo…"', async ({ page }) => {
    const hold = deferred();
    await page.route(`**${SIGN_UP_PATH}`, async (route) => {
      await hold.promise;
      await route.continue();
    });
    const f = await openSignUp(page);
    await f.email.fill(uniqueEmail());
    await f.password.fill(GOOD_PASSWORD);
    await f.submit.click();

    await expect(f.busy).toBeVisible();
    await expect(f.busy).toBeDisabled();
    await expect(f.submit).toHaveCount(0);

    hold.resolve();
    await expect.poll(() => pathOf(page.url())).toBe('/');
    await expect(page.getByText(EMPTY, { exact: true })).toBeVisible();
  });

  for (const [what, reply] of [
    ['answers 500', { status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'server_error' }) }],
    ['answers 503 with no JSON', { status: 503, contentType: 'text/plain', body: 'Service Unavailable' }],
  ] as const) {
    test(`sign-up/sign-up · C17 · when the server ${what}, "Không tạo được tài khoản. Thử lại." shows under the form and what was typed stays`, async ({
      page,
    }) => {
      await page.route(`**${SIGN_UP_PATH}`, (route) => route.fulfill(reply));
      const email = uniqueEmail();
      const f = await openSignUp(page);
      await f.email.fill(email);
      await f.password.fill(GOOD_PASSWORD);
      await f.submit.click();

      const message = f.slot.getByText(FAILED, { exact: true });
      await expect(message).toBeVisible();
      expect(await precedes(f.password, message)).toBe(true);
      expect(await isBelow(f.password, message)).toBe(true);
      await expect(f.email).toHaveValue(email);
      await expect(f.password).toHaveValue(GOOD_PASSWORD);
      await expect(f.submit).toBeEnabled();
      expect(pathOf(page.url())).toBe('/dang-ky');
    });
  }

  test('sign-up/sign-up · C17 · when there is no answer, "Không tạo được tài khoản. Thử lại." shows under the form and what was typed stays', async ({
    page,
  }) => {
    await page.route(`**${SIGN_UP_PATH}`, (route) => route.abort('failed'));
    const email = uniqueEmail();
    const f = await openSignUp(page);
    await f.email.fill(email);
    await f.password.fill(GOOD_PASSWORD);
    await f.submit.click();

    const message = f.slot.getByText(FAILED, { exact: true });
    await expect(message).toBeVisible();
    expect(await precedes(f.password, message)).toBe(true);
    await expect(f.email).toHaveValue(email);
    await expect(f.password).toHaveValue(GOOD_PASSWORD);
    await expect(f.submit).toBeEnabled();
    expect(pathOf(page.url())).toBe('/dang-ky');
  });

  test('sign-up/sign-up · C17 · after a failure, pressing Tạo tài khoản again with the server back creates the account', async ({ page }) => {
    let fail = true;
    await page.route(`**${SIGN_UP_PATH}`, (route) =>
      fail ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"server_error"}' }) : route.continue(),
    );
    const f = await openSignUp(page);
    await f.email.fill(uniqueEmail());
    await f.password.fill(GOOD_PASSWORD);
    await f.submit.click();
    await expect(f.slot.getByText(FAILED, { exact: true })).toBeVisible();
    fail = false;
    await f.submit.click();
    await expect.poll(() => pathOf(page.url())).toBe('/');
  });
});

for (const [name, size] of [
  ['1440', DESKTOP],
  ['390', MOBILE],
] as const) {
  test.describe(`sign-up/sign-up · the prototype at ${name}`, () => {
    test(`sign-up/sign-up · C18 · at ${name} the slot holds the heading Tạo tài khoản, Email, Mật khẩu, the button and "Đã có tài khoản? Đăng nhập" to /dang-nhap, in that order`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      const f = await openSignUp(page);

      await expect(f.heading).toBeVisible();
      await expect(f.slot.getByRole('heading', { level: 1, name: 'Tạo tài khoản', exact: true })).toHaveCount(1);
      await expect(f.email).toBeVisible();
      await expect(f.email).toHaveAttribute('type', 'email');
      await expect(f.email).toHaveAttribute('autocomplete', 'email');
      await expect(f.email).toHaveValue('');
      await expect(f.password).toBeVisible();
      await expect(f.password).toHaveAttribute('type', 'password');
      await expect(f.password).toHaveAttribute('autocomplete', 'new-password');
      await expect(f.password).toHaveValue('');
      await expect(f.submit).toBeVisible();
      await expect(f.submit).toBeEnabled();

      const alt = f.slot.getByText(/^\s*Đã có tài khoản\?\s*Đăng nhập\s*$/);
      await expect(alt).toBeVisible();
      const link = alt.getByRole('link', { name: 'Đăng nhập', exact: true });
      await expect(link).toHaveAttribute('href', '/dang-nhap');

      // order, top to bottom
      const labelEmail = f.slot.getByText('Email', { exact: true });
      const labelPassword = f.slot.getByText('Mật khẩu', { exact: true });
      expect(await precedes(f.heading, labelEmail)).toBe(true);
      expect(await precedes(labelEmail, f.email)).toBe(true);
      expect(await precedes(f.email, labelPassword)).toBe(true);
      expect(await precedes(labelPassword, f.password)).toBe(true);
      expect(await precedes(f.password, f.submit)).toBe(true);
      expect(await precedes(f.submit, alt)).toBe(true);
      expect(await isBelow(f.heading, f.email)).toBe(true);
      expect(await isBelow(f.email, f.password)).toBe(true);
      expect(await isBelow(f.password, f.submit)).toBe(true);
      expect(await isBelow(f.submit, alt)).toBe(true);

      // no field errors and no failure line at rest
      await expect(f.slot.getByText(INVALID_EMAIL, { exact: true })).toHaveCount(0);
      await expect(f.slot.getByText(SHORT_PASSWORD, { exact: true })).toHaveCount(0);
      await expect(f.slot.getByText(FAILED, { exact: true })).toHaveCount(0);

      // it fits the width
      const box = (await f.slot.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
      const inputBox = (await f.email.boundingBox())!;
      expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(size.width);

      // fonts and colours of the prototype
      expect(await style(f.heading, 'font-family')).toMatch(/Literata/);
      expect(await style(f.heading, 'font-size')).toBe('30px');
      expect(await style(f.email, 'font-family')).toMatch(/Be Vietnam Pro/);
      expect(await style(f.submit, 'background-color')).toBe(await resolveColor(page, 'var(--accent)'));
      expect(await style(f.submit, 'color')).toBe(await resolveColor(page, 'var(--accent-ink)'));
      expect(await style(f.email, 'background-color')).toBe(await resolveColor(page, 'var(--paper)'));
      expect(await style(f.email, 'border-top-color')).toBe(await resolveColor(page, 'var(--line)'));
      expect(await style(link, 'color')).toBe(await resolveColor(page, 'var(--ink)'));

      await link.click();
      await expect.poll(() => pathOf(page.url())).toBe('/dang-nhap');
    });

    test(`sign-up/sign-up · C18 · at ${name} the error state shows both errors under their fields in --late, the inputs bordered in --late, the values kept`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      const f = await openSignUp(page);
      await f.email.fill('thu.ha@example');
      await f.password.fill('abc123');
      await f.submit.click();

      const late = await resolveColor(page, 'var(--late)');
      const emailError = await errorOf(page, f.email);
      const passwordError = await errorOf(page, f.password);
      await expect(emailError).toHaveText(INVALID_EMAIL);
      await expect(passwordError).toHaveText(SHORT_PASSWORD);
      expect(await style(emailError, 'color')).toBe(late);
      expect(await style(passwordError, 'color')).toBe(late);
      expect(await style(emailError, 'font-size')).toBe('13px');
      expect(await style(f.email, 'border-top-color')).toBe(late);
      expect(await style(f.password, 'border-top-color')).toBe(late);

      expect(await precedes(f.heading, f.email)).toBe(true);
      expect(await precedes(emailError, f.password)).toBe(true);
      expect(await precedes(passwordError, f.submit)).toBe(true);
      expect(await isBelow(f.email, emailError)).toBe(true);
      expect(await isBelow(emailError, f.password)).toBe(true);
      expect(await isBelow(f.password, passwordError)).toBe(true);
      expect(await isBelow(passwordError, f.submit)).toBe(true);

      await expect(f.email).toHaveValue('thu.ha@example');
      await expect(f.password).toHaveValue('abc123');
      await expect(f.submit).toBeEnabled();
      await expect(f.slot.getByText(/^\s*Đã có tài khoản\?\s*Đăng nhập\s*$/)).toBeVisible();
    });
  });
}

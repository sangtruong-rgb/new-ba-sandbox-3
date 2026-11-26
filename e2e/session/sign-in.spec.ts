// Signing in on /dang-nhap through the sign-in-form slot (C19, C20, C21, C24).
import { test, expect } from '../support/fixtures';
import {
  DESKTOP,
  ENDED,
  FAILED,
  NEED_EMAIL,
  NEED_PASSWORD,
  PASSWORD,
  SIGNING_IN,
  WRONG,
  above,
  account,
  form,
  lineCount,
  path,
  precedes,
  resolveColor,
  signInRequests,
  style,
  uniqueEmail,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(DESKTOP);
});

test.describe('session · sign in', () => {
  test('session · C19 · an email in another case with spaces around it and its password sign in: / shows their own tasks', async ({
    page,
  }) => {
    const other = uniqueEmail('c19-other');
    const email = uniqueEmail('c19');
    await account(page, other, [{ title: 'Gọi thợ sửa máy giặt' }]);
    await account(page, email, [{ title: 'Nộp hồ sơ xin visa' }, { title: 'Mua thuốc huyết áp cho bố' }]);

    await page.goto('/dang-nhap');
    const f = form(page);
    await f.email.fill(`  ${email.toUpperCase()}  `);
    await f.password.fill(PASSWORD);
    await f.slot.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    await expect.poll(() => path(page.url())).toBe('/');
    await expect(page.getByText('Nộp hồ sơ xin visa', { exact: true })).toBeVisible();
    await expect(page.getByText('Mua thuốc huyết áp cho bố', { exact: true })).toBeVisible();
    await expect(page.getByText('Gọi thợ sửa máy giặt', { exact: true })).toHaveCount(0);
    await expect(page.locator('header').getByText(email, { exact: true })).toBeVisible();

    // The session is in the cookie: opening / again keeps them on their list.
    await page.goto('/');
    await expect(page.getByText('Nộp hồ sơ xin visa', { exact: true })).toBeVisible();
    expect(path(page.url())).toBe('/');
  });

  test('session · C19 · an email typed exactly as made signs in too', async ({ page }) => {
    const email = uniqueEmail('c19-plain');
    await account(page, email, [{ title: 'Đóng tiền điện tháng 11' }]);
    await page.goto('/dang-nhap');
    const f = form(page);
    await f.email.fill(email);
    await f.password.fill(PASSWORD);
    await f.slot.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect.poll(() => path(page.url())).toBe('/');
    await expect(page.getByText('Đóng tiền điện tháng 11', { exact: true })).toBeVisible();
  });
});

test.describe('session · wrong credentials', () => {
  for (const which of ['a wrong password', 'an email no account has'] as const) {
    test(`session · C20 · with ${which}, "${WRONG}" shows as one line in --late above the first field; the password is emptied and focused, the email stays`, async ({
      page,
    }) => {
      const email = uniqueEmail('c20');
      await account(page, email);
      const typed = which === 'a wrong password' ? email : uniqueEmail('c20-nobody');
      const password = which === 'a wrong password' ? 'mat-khau-sai-1' : PASSWORD;

      await page.goto('/dang-nhap');
      const f = form(page);
      await f.email.fill(typed);
      await f.password.fill(password);
      await f.slot.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

      const message = f.slot.getByText(WRONG, { exact: true });
      await expect(message).toBeVisible();
      await expect(message).toHaveCount(1);
      expect(await lineCount(message)).toBe(1);
      expect(await style(message, 'color')).toBe(await resolveColor(page, 'var(--late)'));
      expect(await precedes(message, f.emailLabel)).toBe(true);
      expect(await above(message, f.emailLabel)).toBe(true);

      await expect(f.password).toHaveValue('');
      await expect(f.password).toBeFocused();
      await expect(f.email).toHaveValue(typed);
      expect(path(page.url())).toBe('/dang-nhap');
    });
  }
});

test.describe('session · empty fields', () => {
  test(`session · C20 · both fields empty: "${NEED_EMAIL}" and "${NEED_PASSWORD}" show under their fields, nothing is sent, the email has focus`, async ({
    page,
  }) => {
    await page.goto('/dang-nhap');
    const f = form(page);
    await expect(f.email).toBeVisible();
    const sent = signInRequests(page);
    await f.slot.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    const needEmail = f.slot.getByText(NEED_EMAIL, { exact: true });
    const needPassword = f.slot.getByText(NEED_PASSWORD, { exact: true });
    await expect(needEmail).toBeVisible();
    await expect(needPassword).toBeVisible();
    await expect(f.email).toHaveAccessibleDescription(NEED_EMAIL);
    await expect(f.password).toHaveAccessibleDescription(NEED_PASSWORD);
    expect(await above(f.email, needEmail)).toBe(true);
    expect(await above(needEmail, f.passwordLabel)).toBe(true);
    expect(await above(f.password, needPassword)).toBe(true);
    await expect(f.email).toBeFocused();

    await page.waitForTimeout(500);
    expect(sent).toEqual([]);
    expect(path(page.url())).toBe('/dang-nhap');
  });

  test(`session · C20 · an email of only spaces is empty: "${NEED_EMAIL}" shows under it, nothing is sent, the email has focus`, async ({
    page,
  }) => {
    await page.goto('/dang-nhap');
    const f = form(page);
    const sent = signInRequests(page);
    await f.email.fill('    ');
    await f.password.fill(PASSWORD);
    await f.password.focus();
    await f.slot.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    const needEmail = f.slot.getByText(NEED_EMAIL, { exact: true });
    await expect(needEmail).toBeVisible();
    await expect(f.email).toHaveAccessibleDescription(NEED_EMAIL);
    expect(await above(f.email, needEmail)).toBe(true);
    await expect(f.slot.getByText(NEED_PASSWORD, { exact: true })).toHaveCount(0);
    await expect(f.email).toBeFocused();

    await page.waitForTimeout(500);
    expect(sent).toEqual([]);
  });

  test(`session · C20 · an empty password: "${NEED_PASSWORD}" shows under it, nothing is sent, the password has focus`, async ({ page }) => {
    await page.goto('/dang-nhap');
    const f = form(page);
    const sent = signInRequests(page);
    const email = uniqueEmail('c20-nopass');
    await f.email.fill(email);
    await f.slot.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    const needPassword = f.slot.getByText(NEED_PASSWORD, { exact: true });
    await expect(needPassword).toBeVisible();
    await expect(f.password).toHaveAccessibleDescription(NEED_PASSWORD);
    expect(await above(f.password, needPassword)).toBe(true);
    await expect(f.slot.getByText(NEED_EMAIL, { exact: true })).toHaveCount(0);
    await expect(f.password).toBeFocused();
    await expect(f.email).toHaveValue(email);

    await page.waitForTimeout(500);
    expect(sent).toEqual([]);
  });
});

test.describe('session · session ended', () => {
  test(`session · C21 · /dang-nhap?het-phien=1 shows "${ENDED}" as one line above the first field`, async ({ page }) => {
    await page.goto('/dang-nhap?het-phien=1');
    const f = form(page);
    const message = f.slot.getByText(ENDED, { exact: true });
    await expect(message).toBeVisible();
    await expect(message).toHaveCount(1);
    expect(await lineCount(message)).toBe(1);
    expect(await precedes(message, f.emailLabel)).toBe(true);
    expect(await above(message, f.emailLabel)).toBe(true);
  });

  test('session · C21 · /dang-nhap without it shows no message', async ({ page }) => {
    await page.goto('/dang-nhap');
    const f = form(page);
    await expect(f.email).toBeVisible();
    await expect(f.heading).toBeVisible();
    await expect(page.getByText(ENDED, { exact: true })).toHaveCount(0);
    await expect(page.getByText(WRONG, { exact: true })).toHaveCount(0);
    await expect(page.getByText(FAILED, { exact: true })).toHaveCount(0);
    await expect(f.slot.getByText(NEED_EMAIL, { exact: true })).toHaveCount(0);
    await expect(f.slot.getByText(NEED_PASSWORD, { exact: true })).toHaveCount(0);
  });

  test('session · C21 · the message stays while nothing is sent (empty fields) and goes once the form is sent', async ({ page }) => {
    const email = uniqueEmail('c21');
    await account(page, email);
    await page.goto('/dang-nhap?het-phien=1');
    const f = form(page);
    const message = f.slot.getByText(ENDED, { exact: true });
    await expect(message).toBeVisible();

    await f.slot.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(f.slot.getByText(NEED_EMAIL, { exact: true })).toBeVisible();
    await expect(message).toBeVisible();

    await f.email.fill(email);
    await f.password.fill('mat-khau-sai-1');
    await f.slot.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(f.slot.getByText(WRONG, { exact: true })).toBeVisible();
    await expect(page.getByText(ENDED, { exact: true })).toHaveCount(0);
  });

  test('session · C21 · from /dang-nhap?het-phien=1 the right password signs in to /', async ({ page }) => {
    const email = uniqueEmail('c21-ok');
    await account(page, email, [{ title: 'Gửi báo cáo tuần cho chị Lan' }]);
    await page.goto('/dang-nhap?het-phien=1');
    const f = form(page);
    await f.email.fill(email);
    await f.password.fill(PASSWORD);
    await f.slot.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect.poll(() => path(page.url())).toBe('/');
    await expect(page.getByText('Gửi báo cáo tuần cho chị Lan', { exact: true })).toBeVisible();
  });
});

test.describe('session · while signing in', () => {
  test(`session · C24 · while the answer is awaited the button is disabled and reads "${SIGNING_IN}"`, async ({ page }) => {
    const email = uniqueEmail('c24');
    await account(page, email, [{ title: 'Đặt lịch khám răng cho bé' }]);
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route('**/api/auth/sign-in', async (route) => {
      await held;
      await route.continue();
    });

    await page.goto('/dang-nhap');
    const f = form(page);
    await expect(f.submit).toHaveCount(1);
    await f.email.fill(email);
    await f.password.fill(PASSWORD);
    await f.submit.click();

    await expect(f.submit).toHaveText(SIGNING_IN);
    await expect(f.submit).toBeDisabled();
    await page.waitForTimeout(300);
    await expect(f.submit).toHaveText(SIGNING_IN);
    await expect(f.submit).toBeDisabled();

    release();
    await expect.poll(() => path(page.url())).toBe('/');
    await expect(page.getByText('Đặt lịch khám răng cho bé', { exact: true })).toBeVisible();
  });

  const failures = [
    { name: 'the server answers 500', how: 500 },
    { name: 'the server answers 503 with a page that is not JSON', how: 503 },
    { name: 'there is no answer (the connection fails)', how: 'abort' },
  ] as const;

  for (const { name, how } of failures) {
    test(`session · C24 · when ${name}, "${FAILED}" shows above the first field`, async ({ page }) => {
      await page.route('**/api/auth/sign-in', (route) => {
        if (how === 'abort') return route.abort('failed');
        if (how === 503) return route.fulfill({ status: 503, contentType: 'text/html', body: '<h1>Service Unavailable</h1>' });
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'server_error' }) });
      });
      await page.goto('/dang-nhap');
      const f = form(page);
      const email = uniqueEmail('c24-fail');
      await f.email.fill(email);
      await f.password.fill(PASSWORD);
      await f.slot.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

      const message = f.slot.getByText(FAILED, { exact: true });
      await expect(message).toBeVisible();
      await expect(message).toHaveCount(1);
      expect(await precedes(message, f.emailLabel)).toBe(true);
      expect(await above(message, f.emailLabel)).toBe(true);
      await expect(page.getByText(WRONG, { exact: true })).toHaveCount(0);
      expect(path(page.url())).toBe('/dang-nhap');

      // The try is over: the button is back.
      await expect(f.submit).toHaveText('Đăng nhập');
      await expect(f.submit).toBeEnabled();
    });
  }

  test(`session · C24 · when the server never answers, the button stays "${SIGNING_IN}" and then "${FAILED}" shows above the first field`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.route('**/api/auth/sign-in', () => {
      // never answered
    });
    await page.goto('/dang-nhap');
    const f = form(page);
    await expect(f.submit).toHaveCount(1);
    await f.email.fill(uniqueEmail('c24-hang'));
    await f.password.fill(PASSWORD);
    await f.submit.click();

    await expect(f.submit).toHaveText(SIGNING_IN);
    await expect(f.submit).toBeDisabled();

    const message = f.slot.getByText(FAILED, { exact: true });
    await expect(message).toBeVisible({ timeout: 25_000 });
    expect(await above(message, f.emailLabel)).toBe(true);
    await expect(f.submit).toHaveText('Đăng nhập');
    await expect(f.submit).toBeEnabled();
  });
});

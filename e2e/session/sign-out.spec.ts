// Signing out from the header-action slot on / (C22).
import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { DESKTOP, ENDED, form, path } from './helpers';

const SIGN_OUT = 'Đăng xuất';

async function sidOf(page: Page): Promise<string> {
  const sid = (await page.context().cookies()).find((c) => c.name === 'sid');
  expect(sid, 'the signed-in page has a sid cookie').toBeDefined();
  return `sid=${sid!.value}`;
}

function signOutButton(page: Page) {
  return page.locator('[data-slot="header-action"]').getByRole('button', { name: SIGN_OUT, exact: true });
}

/** On /dang-nhap with no message, and it stays there (the page holds no user). */
async function onSignInWithNoMessage(page: Page) {
  await expect.poll(() => path(page.url())).toBe('/dang-nhap');
  await expect(form(page).email).toBeVisible();
  await expect(page.getByText(ENDED, { exact: true })).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(path(page.url())).toBe('/dang-nhap');
  await expect(page.getByText(ENDED, { exact: true })).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(DESKTOP);
});

test.describe('session · sign out', () => {
  test(`session · C22 · on / the header-action slot shows a button "${SIGN_OUT}"`, async ({ page, signedIn }) => {
    void signedIn;
    await page.goto('/');
    await expect(signOutButton(page)).toBeVisible();
    await expect(signOutButton(page)).toHaveCount(1);
  });

  test(`session · C22 · pressing "${SIGN_OUT}" ends the session and goes to /dang-nhap with no message; / afterwards lands on /dang-nhap`, async ({
    page,
    signedIn,
    seedTasks,
    request,
  }) => {
    void signedIn;
    await seedTasks([{ title: 'Trả sách thư viện quận' }]);
    await page.goto('/');
    await expect(page.getByText('Trả sách thư viện quận', { exact: true })).toBeVisible();
    const oldCookie = await sidOf(page);

    await signOutButton(page).click();
    await onSignInWithNoMessage(page);
    await expect(page.getByText('Trả sách thư viện quận', { exact: true })).toHaveCount(0);

    // The server deleted that session: the old cookie gets 401.
    const me = await request.get('/api/me', { headers: { Cookie: oldCookie } });
    expect(me.status()).toBe(401);
    const tasks = await request.get('/api/tasks', { headers: { Cookie: oldCookie } });
    expect(tasks.status()).toBe(401);

    await page.goto('/');
    await expect.poll(() => path(page.url())).toBe('/dang-nhap');
    await expect(form(page).email).toBeVisible();
  });

  test(`session · C22 · when the session had already expired, "${SIGN_OUT}" still goes to /dang-nhap with no message`, async ({
    page,
    signedIn,
    request,
  }) => {
    void signedIn;
    await page.goto('/');
    await expect(signOutButton(page)).toBeVisible();
    const cookie = await sidOf(page);

    // The session ends on the server behind the page's back.
    const ended = await request.post('/api/auth/sign-out', { headers: { Cookie: cookie } });
    expect(ended.status()).toBe(204);
    expect((await request.get('/api/me', { headers: { Cookie: cookie } })).status()).toBe(401);

    await signOutButton(page).click();
    await onSignInWithNoMessage(page);

    await page.goto('/');
    await expect.poll(() => path(page.url())).toBe('/dang-nhap');
  });

  test(`session · C22 · when the server does not answer (the connection fails), "${SIGN_OUT}" still goes to /dang-nhap with no message and the page holds no user`, async ({
    page,
    signedIn,
    seedTasks,
  }) => {
    void signedIn;
    await seedTasks([{ title: 'Mua quà sinh nhật mẹ' }]);
    await page.route('**/api/auth/sign-out', (route) => route.abort('failed'));
    await page.goto('/');
    await expect(page.getByText('Mua quà sinh nhật mẹ', { exact: true })).toBeVisible();

    await signOutButton(page).click();
    await onSignInWithNoMessage(page);
    await expect(page.getByText('Mua quà sinh nhật mẹ', { exact: true })).toHaveCount(0);
  });

  test(`session · C22 · when the server never answers, "${SIGN_OUT}" still goes to /dang-nhap with no message and the page holds no user`, async ({
    page,
    signedIn,
  }) => {
    test.setTimeout(60_000);
    void signedIn;
    await page.route('**/api/auth/sign-out', () => {
      // never answered
    });
    await page.goto('/');
    await expect(signOutButton(page)).toBeVisible();

    await signOutButton(page).click();
    await expect.poll(() => path(page.url()), { timeout: 25_000 }).toBe('/dang-nhap');
    await onSignInWithNoMessage(page);
  });
});

import { test, expect } from '../support/fixtures';

const path = (url: string) => {
  const u = new URL(url);
  return u.pathname + u.search;
};

test.describe('shell · gate', () => {
  test('C4 · / without a user goes to /dang-nhap with no message', async ({ page }) => {
    await page.goto('/');
    await expect.poll(() => path(page.url())).toBe('/dang-nhap');
    await expect(page.locator('[data-slot="sign-in-form"]')).toBeAttached();
  });

  test('C4 · /dang-nhap and /dang-ky stay put without a user', async ({ page }) => {
    await page.goto('/dang-nhap');
    await expect(page.locator('[data-slot="sign-in-form"]')).toBeAttached();
    expect(path(page.url())).toBe('/dang-nhap');
    await page.goto('/dang-ky');
    await expect(page.locator('[data-slot="sign-up-form"]')).toBeAttached();
    expect(path(page.url())).toBe('/dang-ky');
  });

  test('C4 · /dang-nhap with a user goes to /', async ({ page, signedIn }) => {
    void signedIn;
    await page.goto('/dang-nhap');
    await expect.poll(() => path(page.url())).toBe('/');
    await expect(page.locator('[data-slot="input"]')).toBeAttached();
  });

  test('C4 · /dang-ky with a user goes to /', async ({ page, signedIn }) => {
    void signedIn;
    await page.goto('/dang-ky');
    await expect.poll(() => path(page.url())).toBe('/');
    await expect(page.locator('[data-slot="input"]')).toBeAttached();
  });

  test('C1 · a path no route knows goes to /', async ({ page, signedIn }) => {
    void signedIn;
    await page.goto('/khong-co-trang-nay');
    await expect.poll(() => path(page.url())).toBe('/');
    await expect(page.locator('[data-slot="input"]')).toBeAttached();
  });

  test('C1 · a path no route knows goes to /, then to /dang-nhap without a user', async ({ page }) => {
    await page.goto('/viec/khong-co');
    await expect.poll(() => path(page.url())).toBe('/dang-nhap');
  });

  test('C4 · a 401 for a request made while a user is in the session goes to /dang-nhap?het-phien=1', async ({ page, signedIn }) => {
    void signedIn;
    await page.route('**/api/tasks', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'unauthenticated' }) }),
    );
    await page.goto('/');
    await expect.poll(() => path(page.url())).toBe('/dang-nhap?het-phien=1');
    await expect(page.locator('[data-slot="sign-in-form"]')).toBeAttached();
  });

  test('C4 · someone returning after the 30 days (GET /api/me answers 401 at start) lands on /dang-nhap with no message', async ({
    page,
    signedIn,
  }) => {
    void signedIn;
    await page.route('**/api/me', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'unauthenticated' }) }),
    );
    await page.goto('/');
    await expect.poll(() => path(page.url())).toBe('/dang-nhap');
    await expect(page.locator('[data-slot="sign-in-form"]')).toBeAttached();
    await page.waitForTimeout(500);
    expect(path(page.url())).toBe('/dang-nhap');
  });

  test('C1 · only /api/* goes to the server: an unknown /api path answers 404 JSON, a page path answers the app', async ({ request }) => {
    const api = await request.get('/api/khong-co');
    expect(api.status()).toBe(404);
    expect(await api.json()).toEqual({ error: 'not_found' });
    const page = await request.get('/dang-nhap');
    expect(page.status()).toBe(200);
    expect(page.headers()['content-type']).toMatch(/text\/html/);
  });

  test('C3 · in e2e the server runs with NODE_ENV=test: POST /api/test/session answers', async ({ request }) => {
    const res = await request.post('/api/test/session', { data: { email: `gate-${Date.now()}@example.com` } });
    expect(res.status()).toBe(200);
    expect(res.headers()['set-cookie']).toMatch(/sid=/);
  });
});

import { test, expect } from '../support/fixtures';
import { DESKTOP, MOBILE, TZ, hcm, paintedBackground, precedes, resolveColor, row, style } from './helpers';

test.use({ timezoneId: TZ });

const slot = (page: import('@playwright/test').Page, name: string) => page.locator(`[data-slot="${name}"]`);
const HINT = 'Chọn một việc để xem và sửa.';
const EMPTY = 'Chưa có việc nào. Thêm việc đầu tiên ở ô phía trên.';

/** A 2px line in `ink` on the left of the element: a left border or an inset shadow. */
async function inkLeftLine(locator: import('@playwright/test').Locator, ink: string): Promise<boolean> {
  const s = await locator.evaluate((el) => {
    const c = getComputedStyle(el);
    return { bw: c.borderLeftWidth, bc: c.borderLeftColor, bs: c.borderLeftStyle, shadow: c.boxShadow };
  });
  const byBorder = s.bw === '2px' && s.bs !== 'none' && s.bc === ink;
  const byShadow = s.shadow.includes(ink) && /inset/.test(s.shadow) && /\b2px 0px 0px\b/.test(s.shadow);
  return byBorder || byShadow;
}

// Friday 27 November 2026, 10:20 in Hồ Chí Minh City.
const FRIDAY = new Date(hcm(2026, 11, 27, 10, 20));

test.describe('shell · list page frame', () => {
  test('C1 · at 1440 the list page draws the header (Việc, the email, header-action), the date, summary, filters, input, the list and the detail column in that order', async ({
    page,
    signedIn,
    seedTasks,
  }) => {
    await page.setViewportSize(DESKTOP);
    await seedTasks([{ title: 'Mua thuốc huyết áp cho bố' }, { title: 'Họp nhóm chốt kế hoạch quý 1' }]);
    await page.clock.install({ time: FRIDAY });
    await page.goto('/');

    const header = page.locator('header');
    await expect(header.getByText('Việc', { exact: true })).toBeVisible();
    const email = header.getByText(signedIn.email, { exact: true });
    await expect(email).toBeVisible();
    await expect(header.locator('[data-slot="header-action"]')).toBeAttached();
    expect(await precedes(email, header.locator('[data-slot="header-action"]'))).toBe(true);

    const title = page.getByRole('heading', { name: 'Thứ Sáu, 27 tháng 11', exact: true });
    await expect(title).toBeVisible();
    expect(await precedes(header, title)).toBe(true);

    for (const name of ['summary', 'filters', 'input']) await expect(slot(page, name)).toHaveCount(1);
    expect(await precedes(title, slot(page, 'summary'))).toBe(true);
    expect(await precedes(slot(page, 'summary'), slot(page, 'filters'))).toBe(true);
    expect(await precedes(slot(page, 'filters'), slot(page, 'input'))).toBe(true);
    const firstRow = row(page, 'Mua thuốc huyết áp cho bố');
    expect(await precedes(slot(page, 'input'), firstRow)).toBe(true);

    await expect(slot(page, 'item-lead')).toHaveCount(2);
    await expect(row(page, 'Họp nhóm chốt kế hoạch quý 1').locator('[data-slot="item-lead"]')).toHaveCount(1);
    await expect(firstRow.locator('[data-slot="item-lead"]')).toHaveCount(1);

    // the detail column sits to the right of the list, with its hint
    const hint = page.getByText(HINT, { exact: true });
    await expect(hint).toBeVisible();
    const t = (await title.boundingBox())!;
    const h = (await hint.boundingBox())!;
    expect(h.x).toBeGreaterThanOrEqual(t.x + t.width);
    expect(t.width).toBeLessThan(1100);
    await expect(slot(page, 'detail')).toHaveCount(0);
    await expect(slot(page, 'detail-actions')).toHaveCount(0);
  });

  test('C1 · at 390 the header keeps Việc and header-action but not the email; the date, slots and rows follow; no detail column', async ({
    page,
    signedIn,
    seedTasks,
  }) => {
    await page.setViewportSize(MOBILE);
    await seedTasks([{ title: 'Mua thuốc huyết áp cho bố' }]);
    await page.clock.install({ time: FRIDAY });
    await page.goto('/');

    const header = page.locator('header');
    await expect(header.getByText('Việc', { exact: true })).toBeVisible();
    await expect(header.locator('[data-slot="header-action"]')).toBeAttached();
    await expect(page.getByText(signedIn.email, { exact: true })).toBeHidden();

    const title = page.getByRole('heading', { name: 'Thứ Sáu, 27 tháng 11', exact: true });
    await expect(title).toBeVisible();
    for (const name of ['summary', 'filters', 'input']) await expect(slot(page, name)).toHaveCount(1);
    await expect(page.getByText('Mua thuốc huyết áp cho bố', { exact: true })).toBeVisible();
    await expect(slot(page, 'item-lead')).toHaveCount(1);
    await expect(page.getByText(HINT, { exact: true })).toBeHidden();
  });

  test('C1 · the email shows from 1100px wide and hides at 1099px', async ({ page, signedIn }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto('/');
    await expect(page.locator('[data-slot="input"]')).toBeAttached();
    await expect(page.getByText(signedIn.email, { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1099, height: 800 });
    await expect(page.getByText(signedIn.email, { exact: true })).toBeHidden();
  });

  test('C1 · the title is today\'s date with weekday, day and month without padding: "Chủ Nhật, 5 tháng 1"', async ({ page, signedIn }) => {
    void signedIn;
    await page.clock.install({ time: new Date(hcm(2025, 1, 5, 9, 0)) });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Chủ Nhật, 5 tháng 1', exact: true })).toBeVisible();
  });

  test('C1 · the title uses local time, not UTC', async ({ page, signedIn }) => {
    void signedIn;
    // 23:30 UTC on Friday 27 is 06:30 on Saturday 28 in Hồ Chí Minh City
    await page.clock.install({ time: new Date('2026-11-27T23:30:00.000Z') });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Thứ Bảy, 28 tháng 11', exact: true })).toBeVisible();
  });

  test('C1 · the title changes at midnight without a reload', async ({ page, signedIn }) => {
    void signedIn;
    await page.clock.install({ time: new Date(hcm(2026, 11, 27, 23, 59)) });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Thứ Sáu, 27 tháng 11', exact: true })).toBeVisible();
    await page.clock.fastForward('01:05');
    await expect(page.getByRole('heading', { name: 'Thứ Bảy, 28 tháng 11', exact: true })).toBeVisible();
  });
});

test.describe('shell · list rows', () => {
  test('C6 · a row is item-lead, then the due text from formatDue, then the title', async ({ page, seedTasks }) => {
    await page.setViewportSize(DESKTOP);
    await seedTasks([{ title: 'Đặt bàn sinh nhật vợ ở quán quen', dueAt: hcm(2026, 11, 28, 8, 0) }]);
    await page.clock.install({ time: FRIDAY });
    await page.goto('/');

    const r = row(page, 'Đặt bàn sinh nhật vợ ở quán quen');
    const lead = r.locator('[data-slot="item-lead"]');
    const due = r.getByText('Ngày mai · 08:00', { exact: true });
    const title = r.getByText('Đặt bàn sinh nhật vợ ở quán quen', { exact: true });
    await expect(due).toBeVisible();
    await expect(title).toBeVisible();
    expect(await precedes(lead, due)).toBe(true);
    expect(await precedes(due, title)).toBe(true);
  });

  test('C6 · the due text is 13px with tabular figures, in a 152px column before the title at 1440', async ({ page, seedTasks }) => {
    await page.setViewportSize(DESKTOP);
    await seedTasks([{ title: 'Đặt bàn sinh nhật vợ ở quán quen', dueAt: hcm(2026, 11, 28, 8, 0) }]);
    await page.clock.install({ time: FRIDAY });
    await page.goto('/');

    const r = row(page, 'Đặt bàn sinh nhật vợ ở quán quen');
    const due = r.getByText('Ngày mai · 08:00', { exact: true });
    const title = r.getByText('Đặt bàn sinh nhật vợ ở quán quen', { exact: true });
    expect(await style(due, 'font-size')).toBe('13px');
    expect(await style(due, 'font-variant-numeric')).toContain('tabular-nums');
    const d = (await due.boundingBox())!;
    const t = (await title.boundingBox())!;
    expect(Math.abs(d.y - t.y)).toBeLessThan(12); // same line
    expect(t.x - d.x).toBeGreaterThanOrEqual(152);
    expect(t.x - d.x).toBeLessThanOrEqual(152 + 32);
    expect(d.width).toBeLessThanOrEqual(152);
  });

  test('C6 · below 1100px the due text sits on a second line under the title', async ({ page, seedTasks }) => {
    await page.setViewportSize(MOBILE);
    await seedTasks([{ title: 'Đặt bàn sinh nhật vợ', dueAt: hcm(2026, 11, 28, 8, 0) }]);
    await page.clock.install({ time: FRIDAY });
    await page.goto('/');

    const r = row(page, 'Đặt bàn sinh nhật vợ');
    const due = r.getByText('Ngày mai · 08:00', { exact: true });
    const title = r.getByText('Đặt bàn sinh nhật vợ', { exact: true });
    const d = (await due.boundingBox())!;
    const t = (await title.boundingBox())!;
    expect(d.y).toBeGreaterThanOrEqual(t.y + t.height - 2);
    expect(Math.abs(d.x - t.x)).toBeLessThanOrEqual(4);
    expect(await style(due, 'font-size')).toBe('13px');
  });

  test('C6 · a done task\'s title is struck through in --muted', async ({ page, seedTasks }) => {
    await page.setViewportSize(DESKTOP);
    await seedTasks([{ title: 'Rửa xe', done: true }]);
    await page.goto('/');
    const title = row(page, 'Rửa xe').getByText('Rửa xe', { exact: true });
    await expect(title).toBeVisible();
    const struck = await title.evaluate((el) => {
      for (let n: Element | null = el, i = 0; n && i < 4; n = n.parentElement, i++) {
        if (getComputedStyle(n).textDecorationLine.includes('line-through')) return true;
      }
      return false;
    });
    expect(struck).toBe(true);
    expect(await style(title, 'color')).toBe(await resolveColor(page, 'var(--muted)'));
  });

  test('C6 · the list draws every task of the store', async ({ page, seedTasks }) => {
    await page.setViewportSize(DESKTOP);
    const titles = ['Gửi hợp đồng thuê nhà đã ký cho anh Tuấn', 'Nộp học phí học kỳ 2 cho bé Bin', 'Học xong bài 7 tiếng Nhật'];
    await seedTasks(titles.map((title) => ({ title })));
    await page.goto('/');
    for (const t of titles) await expect(page.getByText(t, { exact: true })).toBeVisible();
    await expect(slot(page, 'item-lead')).toHaveCount(3);
  });

  test('C6 · the list re-renders each minute: a due tomorrow becomes today after midnight', async ({ page, seedTasks }) => {
    await page.setViewportSize(DESKTOP);
    await seedTasks([{ title: 'Mua thuốc huyết áp cho bố', dueAt: hcm(2026, 11, 28, 17, 0) }]);
    await page.clock.install({ time: new Date(hcm(2026, 11, 27, 23, 59)) });
    await page.goto('/');
    await expect(page.getByText('Ngày mai · 17:00', { exact: true })).toBeVisible();
    await page.clock.fastForward('01:05');
    await expect(page.getByText('Hôm nay · 17:00', { exact: true })).toBeVisible();
  });
});

test.describe('shell · selection', () => {
  test('C7 · at 1440 clicking a title shows detail and detail-actions in the right column; the row gets the --paper fill and a 2px --ink line on its left', async ({
    page,
    seedTasks,
  }) => {
    await page.setViewportSize(DESKTOP);
    await seedTasks([{ title: 'Gửi hợp đồng thuê nhà' }, { title: 'Nộp học phí học kỳ 2' }]);
    await page.goto('/');
    await page.getByText('Gửi hợp đồng thuê nhà', { exact: true }).click();

    await expect(slot(page, 'detail')).toHaveCount(1);
    await expect(slot(page, 'detail-actions')).toHaveCount(1);
    expect(await precedes(slot(page, 'detail'), slot(page, 'detail-actions'))).toBe(true);
    await expect(page.getByText(HINT, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '← Danh sách' })).toBeHidden();

    // the list stays beside it
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(page.getByText('Nộp học phí học kỳ 2', { exact: true })).toBeVisible();
    const hb = (await heading.boundingBox())!;
    const ab = await slot(page, 'detail-actions').boundingBox();
    expect(ab).not.toBeNull();
    expect(ab!.x).toBeGreaterThanOrEqual(hb.x + hb.width);

    const selected = row(page, 'Gửi hợp đồng thuê nhà');
    const paper = await resolveColor(page, 'var(--paper)');
    const ink = await resolveColor(page, 'var(--ink)');
    expect(await paintedBackground(selected)).toBe(paper);
    expect(await inkLeftLine(selected, ink)).toBe(true);

    const other = row(page, 'Nộp học phí học kỳ 2');
    expect(await paintedBackground(other)).not.toBe(paper);
    expect(await inkLeftLine(other, ink)).toBe(false);
  });

  test('C7 · pressing Enter on a title selects the task', async ({ page, seedTasks }) => {
    await page.setViewportSize(DESKTOP);
    await seedTasks([{ title: 'Họp nhóm chốt kế hoạch quý 1' }]);
    await page.goto('/');
    await page.getByText('Họp nhóm chốt kế hoạch quý 1', { exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(slot(page, 'detail')).toHaveCount(1);
    await expect(slot(page, 'detail-actions')).toHaveCount(1);
  });

  test('C7 · choosing another task moves the selection without asking', async ({ page, seedTasks }) => {
    await page.setViewportSize(DESKTOP);
    await seedTasks([{ title: 'Gửi hợp đồng thuê nhà' }, { title: 'Nộp học phí học kỳ 2' }]);
    let dialogs = 0;
    page.on('dialog', (d) => {
      dialogs += 1;
      void d.dismiss();
    });
    await page.goto('/');
    const paper = await resolveColor(page, 'var(--paper)');
    await page.getByText('Gửi hợp đồng thuê nhà', { exact: true }).click();
    await expect(slot(page, 'detail')).toHaveCount(1);
    await page.getByText('Nộp học phí học kỳ 2', { exact: true }).click();
    await expect(slot(page, 'detail')).toHaveCount(1);
    await expect.poll(() => paintedBackground(row(page, 'Nộp học phí học kỳ 2'))).toBe(paper);
    const ink = await resolveColor(page, 'var(--ink)');
    expect(await inkLeftLine(row(page, 'Gửi hợp đồng thuê nhà'), ink)).toBe(false);
    expect(await inkLeftLine(row(page, 'Nộp học phí học kỳ 2'), ink)).toBe(true);
    expect(dialogs).toBe(0);
  });

  test('C7 · at 390 a selected task shows alone with "← Danh sách"; the main column is hidden but its slots stay mounted; the button shows the list again', async ({
    page,
    seedTasks,
  }) => {
    await page.setViewportSize(MOBILE);
    await seedTasks([{ title: 'Gửi hợp đồng thuê nhà' }, { title: 'Nộp học phí học kỳ 2' }]);
    await page.goto('/');
    await page.getByText('Gửi hợp đồng thuê nhà', { exact: true }).click();

    const back = page.getByRole('button', { name: '← Danh sách' });
    await expect(back).toBeVisible();
    await expect(slot(page, 'detail')).toHaveCount(1);
    await expect(slot(page, 'detail-actions')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toBeHidden();
    await expect(page.getByText('Nộp học phí học kỳ 2', { exact: true })).toBeHidden();
    for (const name of ['summary', 'filters', 'input']) await expect(slot(page, name)).toHaveCount(1);
    await expect(slot(page, 'item-lead')).toHaveCount(2);

    await back.click();
    await expect(slot(page, 'detail')).toHaveCount(0);
    await expect(slot(page, 'detail-actions')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Nộp học phí học kỳ 2', { exact: true })).toBeVisible();
    await expect(back).toBeHidden();
  });

  test("C7 · at 390 the browser's Back clears the selection and shows the list", async ({ page, seedTasks }) => {
    await page.setViewportSize(MOBILE);
    await seedTasks([{ title: 'Gửi hợp đồng thuê nhà' }]);
    await page.goto('/');
    await page.getByText('Gửi hợp đồng thuê nhà', { exact: true }).click();
    await expect(page.getByRole('button', { name: '← Danh sách' })).toBeVisible();
    await page.goBack();
    await expect(slot(page, 'detail')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Gửi hợp đồng thuê nhà', { exact: true })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
  });
});

test.describe('shell · list states', () => {
  test('C7 · with no tasks the list says the empty text, the right column is not shown and the list takes the width', async ({
    page,
    signedIn,
  }) => {
    void signedIn;
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await expect(page.getByText(EMPTY, { exact: true })).toBeVisible();
    await expect(page.getByText(HINT, { exact: true })).toHaveCount(0);
    const hb = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    expect(hb.width).toBeGreaterThan(1200);
    expect(await precedes(slot(page, 'input'), page.getByText(EMPTY, { exact: true }))).toBe(true);
  });

  test('C7 · at 390 with no tasks the list says the empty text', async ({ page, signedIn }) => {
    void signedIn;
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await expect(page.getByText(EMPTY, { exact: true })).toBeVisible();
  });

  test('C7 · while the session is pending the list page shows its frame and "Đang tải…"', async ({ page, signedIn }) => {
    void signedIn;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route('**/api/me', async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto('/');
    await expect(page.getByText('Đang tải…', { exact: true })).toBeVisible();
    await expect(page.locator('header').getByText('Việc', { exact: true })).toBeVisible();
    await expect(page.getByText(EMPTY, { exact: true })).toHaveCount(0);
    await expect(slot(page, 'item-lead')).toHaveCount(0);
    release();
    await expect(page.getByText(EMPTY, { exact: true })).toBeVisible();
    await expect(page.getByText('Đang tải…', { exact: true })).toHaveCount(0);
  });

  test('C7 · while the first load is pending the list page shows its frame and "Đang tải…"', async ({ page, seedTasks }) => {
    await seedTasks([{ title: 'Mua thuốc huyết áp cho bố' }]);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route('**/api/tasks', async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto('/');
    await expect(page.getByText('Đang tải…', { exact: true })).toBeVisible();
    await expect(page.getByText('Mua thuốc huyết áp cho bố', { exact: true })).toHaveCount(0);
    release();
    await expect(page.getByText('Mua thuốc huyết áp cho bố', { exact: true })).toBeVisible();
    await expect(page.getByText('Đang tải…', { exact: true })).toHaveCount(0);
  });

  test('C7 · when the load fails the slots still mount and the list says "Không tải được danh sách." with "Thử lại", which loads again', async ({
    page,
    seedTasks,
  }) => {
    await seedTasks([{ title: 'Mua thuốc huyết áp cho bố' }]);
    await page.route('**/api/tasks', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) }),
    );
    await page.goto('/');
    await expect(page.getByText('Không tải được danh sách.', { exact: true })).toBeVisible();
    for (const name of ['summary', 'filters', 'input']) await expect(slot(page, name)).toHaveCount(1);
    await expect(page.getByText('Đang tải…', { exact: true })).toHaveCount(0);
    await page.unroute('**/api/tasks');
    await page.getByRole('button', { name: 'Thử lại' }).click();
    await expect(page.getByText('Mua thuốc huyết áp cho bố', { exact: true })).toBeVisible();
    await expect(page.getByText('Không tải được danh sách.', { exact: true })).toHaveCount(0);
  });
});

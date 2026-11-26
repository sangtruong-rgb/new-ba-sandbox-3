// @vitest-environment jsdom
// The list's defaults, before any setOrder / setTone / setFilter call. Its own file,
// so the list module starts fresh: newest created first, every row 'normal', every task shown.
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { setNow } from '../shared/time';
import { byWholeText, fakeServer, feature, json, local, precedes, renderApp, stubWidth, task } from './__tests__/harness';

afterEach(() => {
  cleanup();
  setNow(null);
  vi.unstubAllGlobals();
});

describe('App · list defaults', () => {
  test('C6 · by default the list shows every task, newest created first, every row normal', async () => {
    const server = fakeServer();
    stubWidth(1440);
    setNow(() => new Date(2026, 10, 27, 10, 20));
    const old = task('o', { title: 'Rửa xe', done: true, createdAt: '2026-11-20T03:00:00.000Z' });
    const overdue = task('l', { title: 'Mua thuốc huyết áp cho bố', dueAt: local(2026, 11, 26, 17, 0), createdAt: '2026-11-25T03:00:00.000Z' });
    const fresh = task('f', { title: 'Họp nhóm chốt kế hoạch quý 1', createdAt: '2026-11-27T02:00:00.000Z' });
    server.me = () => json(200, { id: 'u1', email: 'an@example.com' });
    server.tasks = () => json(200, [old, overdue, fresh]);
    renderApp([feature('add', [{ slot: 'input', Component: () => <span>Ô nhập giả</span> }])], '/');

    const fTitle = await screen.findByText(fresh.title, { exact: true });
    const lTitle = screen.getByText(overdue.title, { exact: true });
    const oTitle = screen.getByText(old.title, { exact: true });
    expect(precedes(fTitle, lTitle)).toBe(true);
    expect(precedes(lTitle, oTitle)).toBe(true);
    expect(screen.getByText(byWholeText('Hôm qua · 17:00'))).toBeTruthy();
    expect(screen.queryByText(/Trễ/)).toBeNull();
  });
});

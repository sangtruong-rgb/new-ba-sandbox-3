// @vitest-environment jsdom
// The filter feature, mounted from its index.ts in the real app with fetch stubbed:
// the tabs and their counts (C42), what the list shows (C43) and the empty texts (C44).
// The counts change through taskStore.upsert and remove, as every feature changes them.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import * as filterFeature from './index';
import { setFilter } from '../../../../shared/list';
import { taskStore } from '../../../../shared/tasks/store';
import type { Task } from '../../../../shared/tasks/types';
import { fakeServer, json, renderApp, slotEl, stubWidth, task, type Feature } from '../../../../app/__tests__/harness';

const USER = { id: 'u1', email: 'an@example.com' };
const OPEN_EMPTY = 'Không còn việc nào chưa xong.';
const DONE_EMPTY = 'Tick một việc ở Chưa xong, nó sẽ hiện ở đây.';
const LIST_EMPTY = 'Chưa có việc nào. Thêm việc đầu tiên ở ô phía trên.';

// Three not done, two done: the three counts differ (5, 3, 2).
const A = task('a', { title: 'Gửi hợp đồng thuê nhà', createdAt: '2026-11-27T03:00:00.000Z' });
const B = task('b', { title: 'Nộp học phí học kỳ 2', createdAt: '2026-11-26T03:00:00.000Z' });
const C = task('c', { title: 'Rửa xe', done: true, createdAt: '2026-11-25T03:00:00.000Z' });
const D = task('d', { title: 'Học bài 7 tiếng Nhật', createdAt: '2026-11-24T03:00:00.000Z' });
const E = task('e', { title: 'Đổi bình nước', done: true, createdAt: '2026-11-23T03:00:00.000Z' });
const ALL = [A, B, C, D, E];

const feature = { ...filterFeature, page: 'list' } as Feature;

let server: ReturnType<typeof fakeServer>;

beforeEach(() => {
  server = fakeServer();
  stubWidth(1440);
  taskStore.clear();
  setFilter({ id: 'all', test: () => true, emptyText: 'Không có việc nào ở đây.' });
});

afterEach(() => {
  cleanup();
  taskStore.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Opens the list page with these tasks and waits for the list to be drawn. */
async function open(tasks: Task[]) {
  server.me = () => json(200, USER);
  server.tasks = () => json(200, tasks);
  const view = renderApp([feature]);
  await waitFor(() => expect(slotEl(view.container, 'filters')).not.toBeNull());
  const filters = () => slotEl(view.container, 'filters') as HTMLElement;
  return { ...view, filters };
}

type View = Awaited<ReturnType<typeof open>>;

const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
/** The tabs' texts, with the space between label and count not mattering. */
const tabs = (view: View) =>
  within(view.filters())
    .queryAllByRole('button')
    .map((b) => text(b).replace(/\s*(\d+)$/, ' $1'));
const pressed = (view: View) =>
  within(view.filters())
    .queryAllByRole('button')
    .map((b) => b.getAttribute('aria-pressed'));
const tab = (view: View, label: 'Tất cả' | 'Chưa xong' | 'Đã xong') =>
  within(view.filters()).getByRole('button', { name: new RegExp(`^${label}\\s*\\d+$`) });
const choose = (view: View, label: 'Tất cả' | 'Chưa xong' | 'Đã xong') => fireEvent.click(tab(view, label));

/** The titles of the rows the list shows, in the list's order. */
const rows = (view: View) =>
  Array.from(view.container.querySelectorAll('[data-slot="item-lead"]')).map((lead) =>
    text(lead.parentElement!.querySelector('button')!),
  );

const change = (fn: () => void) => act(() => fn());

describe('list/filter · tabs', () => {
  test('list/filter · C42 · the filters slot has three tabs, "Tất cả", "Chưa xong", "Đã xong", each followed by its count', async () => {
    const view = await open(ALL);
    await waitFor(() => expect(tabs(view)).toEqual(['Tất cả 5', 'Chưa xong 3', 'Đã xong 2']));
  });

  test('list/filter · C42 · with no task the slot shows nothing; the tabs come with the first task and go with the last', async () => {
    const view = await open([]);
    await screen.findByText(LIST_EMPTY, { exact: true });
    expect(text(view.filters())).toBe('');
    expect(within(view.filters()).queryAllByRole('button')).toHaveLength(0);

    change(() => taskStore.upsert(A));
    expect(tabs(view)).toEqual(['Tất cả 1', 'Chưa xong 1', 'Đã xong 0']);

    change(() => taskStore.remove(A.id));
    expect(text(view.filters())).toBe('');
    expect(within(view.filters()).queryAllByRole('button')).toHaveLength(0);
  });

  test('list/filter · C42 · "Tất cả" is selected at first; aria-pressed follows the chosen tab', async () => {
    const view = await open(ALL);
    await waitFor(() => expect(pressed(view)).toEqual(['true', 'false', 'false']));
    choose(view, 'Chưa xong');
    expect(pressed(view)).toEqual(['false', 'true', 'false']);
    choose(view, 'Đã xong');
    expect(pressed(view)).toEqual(['false', 'false', 'true']);
    choose(view, 'Tất cả');
    expect(pressed(view)).toEqual(['true', 'false', 'false']);
  });

  test('list/filter · C42 · mounting sets "Tất cả" with setFilter, replacing the filter that was set before', async () => {
    setFilter({ id: 'none', test: () => false, emptyText: 'Bộ lọc cũ' });
    const view = await open(ALL);
    await waitFor(() => expect(pressed(view)).toEqual(['true', 'false', 'false']));
    expect(rows(view)).toEqual([A, B, C, D, E].map((t) => t.title));
    expect(screen.queryByText('Bộ lọc cũ')).toBeNull();
  });

  test('list/filter · C42 · opening the list page again selects "Tất cả" and shows every task', async () => {
    const first = await open(ALL);
    await waitFor(() => expect(tabs(first)).toHaveLength(3));
    choose(first, 'Đã xong');
    expect(rows(first)).toEqual([C.title, E.title]);
    first.unmount();

    const again = await open(ALL);
    await waitFor(() => expect(pressed(again)).toEqual(['true', 'false', 'false']));
    expect(rows(again)).toEqual(ALL.map((t) => t.title));
  });
});

describe('list/filter · choosing', () => {
  test('list/filter · C43 · "Chưa xong" shows only tasks not done, "Đã xong" only done tasks, "Tất cả" every task', async () => {
    const view = await open(ALL);
    await waitFor(() => expect(tabs(view)).toHaveLength(3));

    choose(view, 'Chưa xong');
    expect(rows(view)).toEqual([A.title, B.title, D.title]);
    choose(view, 'Đã xong');
    expect(rows(view)).toEqual([C.title, E.title]);
    choose(view, 'Tất cả');
    expect(rows(view)).toEqual(ALL.map((t) => t.title));
    // choosing changes what is shown, not the counts
    expect(tabs(view)).toEqual(['Tất cả 5', 'Chưa xong 3', 'Đã xong 2']);
  });

  test('list/filter · C43 · the counts change at once when a task is added, marked done, marked not done or deleted', async () => {
    const view = await open(ALL);
    await waitFor(() => expect(tabs(view)).toEqual(['Tất cả 5', 'Chưa xong 3', 'Đã xong 2']));

    change(() => taskStore.upsert(task('f', { title: 'Mua sữa', createdAt: '2026-11-27T04:00:00.000Z' })));
    expect(tabs(view)).toEqual(['Tất cả 6', 'Chưa xong 4', 'Đã xong 2']);

    change(() => taskStore.upsert({ ...A, done: true }));
    expect(tabs(view)).toEqual(['Tất cả 6', 'Chưa xong 3', 'Đã xong 3']);

    change(() => taskStore.upsert({ ...C, done: false }));
    expect(tabs(view)).toEqual(['Tất cả 6', 'Chưa xong 4', 'Đã xong 2']);

    change(() => taskStore.remove(E.id));
    expect(tabs(view)).toEqual(['Tất cả 5', 'Chưa xong 4', 'Đã xong 1']);

    change(() => taskStore.remove(B.id));
    expect(tabs(view)).toEqual(['Tất cả 4', 'Chưa xong 3', 'Đã xong 1']);
  });

  test('list/filter · C43 · with a tab chosen, the rows follow each change and the tab stays chosen', async () => {
    const view = await open(ALL);
    await waitFor(() => expect(tabs(view)).toHaveLength(3));
    choose(view, 'Chưa xong');

    change(() => taskStore.upsert({ ...A, done: true }));
    expect(rows(view)).toEqual([B.title, D.title]);
    change(() => taskStore.upsert(task('f', { title: 'Mua sữa', createdAt: '2026-11-27T04:00:00.000Z' })));
    expect(rows(view)).toEqual(['Mua sữa', B.title, D.title]);
    expect(pressed(view)).toEqual(['false', 'true', 'false']);

    choose(view, 'Đã xong');
    expect(rows(view)).toEqual([A.title, C.title, E.title]);
    change(() => taskStore.upsert({ ...C, done: false }));
    expect(rows(view)).toEqual([A.title, E.title]);
    change(() => taskStore.remove(E.id));
    expect(rows(view)).toEqual([A.title]);
    expect(pressed(view)).toEqual(['false', 'false', 'true']);
  });
});

describe('list/filter · empty texts', () => {
  test('list/filter · C44 · "Chưa xong" with every task done says "Không còn việc nào chưa xong."', async () => {
    const view = await open([C, E]);
    await waitFor(() => expect(tabs(view)).toHaveLength(3));
    choose(view, 'Chưa xong');
    expect(screen.getByText(OPEN_EMPTY, { exact: true })).toBeTruthy();
    expect(screen.queryByText(DONE_EMPTY)).toBeNull();
    expect(rows(view)).toEqual([]);
  });

  test('list/filter · C44 · "Đã xong" with no done task says "Tick một việc ở Chưa xong, nó sẽ hiện ở đây."', async () => {
    const view = await open([A, B]);
    await waitFor(() => expect(tabs(view)).toHaveLength(3));
    choose(view, 'Đã xong');
    expect(screen.getByText(DONE_EMPTY, { exact: true })).toBeTruthy();
    expect(screen.queryByText(OPEN_EMPTY)).toBeNull();
    expect(rows(view)).toEqual([]);
  });

  test('list/filter · C44 · the text appears when the last task leaves the chosen tab, and goes when one returns', async () => {
    const view = await open([A, C]);
    await waitFor(() => expect(tabs(view)).toHaveLength(3));

    choose(view, 'Chưa xong');
    expect(screen.queryByText(OPEN_EMPTY)).toBeNull();
    change(() => taskStore.upsert({ ...A, done: true }));
    expect(screen.getByText(OPEN_EMPTY, { exact: true })).toBeTruthy();
    change(() => taskStore.upsert(A));
    expect(screen.queryByText(OPEN_EMPTY)).toBeNull();
    expect(rows(view)).toEqual([A.title]);

    choose(view, 'Đã xong');
    expect(screen.queryByText(DONE_EMPTY)).toBeNull();
    change(() => taskStore.remove(C.id));
    expect(screen.getByText(DONE_EMPTY, { exact: true })).toBeTruthy();
  });
});

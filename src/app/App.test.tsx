// @vitest-environment jsdom
// <App registry={createRegistry(fakes)} initialPath> with fetch stubbed: the frame,
// the gate and session (C1, C4), the registry's slots and boundaries (C5), the list (C6)
// and the selection and list states (C7).
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSession } from './session';
import { api } from '../shared/api';
import { setFilter, setOrder, setTone } from '../shared/list';
import { setNow } from '../shared/time';
import { taskStore } from '../shared/tasks/store';
import type { Task } from '../shared/tasks/types';
import {
  byWholeText,
  captureConsole,
  deferred,
  fakeServer,
  feature,
  json,
  local,
  precedes,
  pressEnter,
  renderApp,
  slotEl,
  slotEls,
  stubWidth,
  task,
  type Feature,
} from './__tests__/harness';

const USER = { id: 'u1', email: 'an@example.com' };
const HINT = 'Chọn một việc để xem và sửa.';
const EMPTY = 'Chưa có việc nào. Thêm việc đầu tiên ở ô phía trên.';
const LOADING = 'Đang tải…';
const LOAD_FAILED = 'Không tải được danh sách.';

let server: ReturnType<typeof fakeServer>;

// ---- fake features -------------------------------------------------------

function Where({ name }: { name: string }) {
  const loc = useLocation();
  return <output data-testid={`where-${name}`}>{loc.pathname + loc.search}</output>;
}

function HeaderAction() {
  const { user, status, clear } = useSession();
  return (
    <span>
      <Where name="list" />
      <output data-testid="session">{`${status}:${user?.email ?? 'none'}`}</output>
      <button type="button" onClick={() => clear()}>
        Thoát
      </button>
      <button
        type="button"
        onClick={() => {
          api('GET', '/api/tasks').catch(() => {});
        }}
      >
        Tải lại
      </button>
    </span>
  );
}

function SignInForm() {
  const { refresh, user } = useSession();
  return (
    <div>
      <Where name="sign-in" />
      <output data-testid="sign-in-user">{user?.email ?? 'none'}</output>
      <button
        type="button"
        onClick={() => {
          server.me = () => json(200, USER);
          void refresh();
        }}
      >
        Vào
      </button>
    </div>
  );
}

function SignUpForm() {
  return <Where name="sign-up" />;
}

function Input() {
  return <span>Ô nhập giả</span>;
}

function ItemLead({ task: t, showMessage }: { task: Task; showMessage(text: string | null): void }) {
  return (
    <span>
      <button type="button" onClick={() => showMessage(`Không xong được: ${t.title}`)}>
        {`báo-${t.id}`}
      </button>
      <button type="button" onClick={() => showMessage(null)}>
        {`tắt-${t.id}`}
      </button>
    </span>
  );
}

function Detail({ task: t, close }: { task: Task; close(): void }) {
  const [draft, setDraft] = useState(t.title);
  return (
    <div>
      <h2>{`chi-tiết:${t.title}`}</h2>
      <input aria-label="Tên việc nháp" value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button type="button" onClick={close}>
        Đóng chi tiết
      </button>
    </div>
  );
}

function DetailActions({ task: t, close, showMessage }: { task: Task; close(): void; showMessage(text: string | null): void }) {
  return (
    <span>
      <button type="button" onClick={() => showMessage(`Không lưu được: ${t.title}`)}>
        Báo lỗi
      </button>
      <button type="button" onClick={close}>
        Đóng từ hành động
      </button>
    </span>
  );
}

const base = (): Feature[] => [
  feature('header', [{ slot: 'header-action', Component: HeaderAction }]),
  feature('form', [
    { slot: 'sign-in-form', Component: SignInForm },
    { slot: 'sign-up-form', Component: SignUpForm },
  ]),
  feature('add', [{ slot: 'input', Component: Input }]),
  feature('lead', [{ slot: 'item-lead', Component: ItemLead }]),
  feature('edit', [
    { slot: 'detail', Component: Detail },
    { slot: 'detail-actions', Component: DetailActions },
  ]),
];

const where = async (name: string) => (await screen.findByTestId(`where-${name}`)).textContent;
const title = (text: string) => screen.getByText(text, { exact: true });

async function signedInWith(tasks: Task[], features: Feature[] = base(), path = '/') {
  server.me = () => json(200, USER);
  server.tasks = () => json(200, tasks);
  const view = renderApp(features, path);
  await screen.findByText('Ô nhập giả');
  return view;
}

// ---- set-up ---------------------------------------------------------------

const newestFirst = (a: Task, b: Task) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? -1 : 1);

beforeEach(() => {
  server = fakeServer();
  stubWidth(1440);
  taskStore.clear();
  setNow(() => new Date(2026, 10, 27, 10, 20));
  setOrder(newestFirst);
  setTone(() => 'normal');
  setFilter({ id: 'all', test: () => true, emptyText: 'Không có việc nào ở đây.' });
});

afterEach(() => {
  cleanup();
  setNow(null);
  taskStore.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const A = task('a', { title: 'Gửi hợp đồng thuê nhà', createdAt: '2026-11-27T03:00:00.000Z' });
const B = task('b', { title: 'Nộp học phí học kỳ 2', createdAt: '2026-11-26T03:00:00.000Z' });
const C = task('c', { title: 'Rửa xe', done: true, createdAt: '2026-11-25T03:00:00.000Z' });

// ---- C1: frame -------------------------------------------------------------

describe('App · frame', () => {
  test('C1 · / with a user draws the header (Việc, the email, header-action), the date title, summary, filters, input, then a row with item-lead per task', async () => {
    const { container } = await signedInWith([A, B]);
    const header = container.querySelector('header')!;
    expect(header).not.toBeNull();
    expect(within(header).getByText('Việc', { exact: true })).toBeTruthy();
    const email = within(header).getByText(USER.email, { exact: true });
    const action = slotEl(header, 'header-action')!;
    expect(action).not.toBeNull();
    expect(precedes(email, action)).toBe(true);

    const heading = screen.getByRole('heading', { name: 'Thứ Sáu, 27 tháng 11' });
    expect(precedes(header, heading)).toBe(true);
    const [summary, filters, input] = ['summary', 'filters', 'input'].map((n) => slotEl(container, n)!);
    for (const el of [summary, filters, input]) expect(el).not.toBeNull();
    expect(precedes(heading, summary)).toBe(true);
    expect(precedes(summary, filters)).toBe(true);
    expect(precedes(filters, input)).toBe(true);
    expect(precedes(input, title(A.title))).toBe(true);
    expect(slotEls(container, 'item-lead')).toHaveLength(2);
    expect(slotEls(container, 'detail')).toHaveLength(0);
    expect(slotEls(container, 'detail-actions')).toHaveLength(0);
  });

  test('C1 · the title is the local date with no padding: "Chủ Nhật, 5 tháng 1"', async () => {
    setNow(() => new Date(2025, 0, 5, 9, 0));
    await signedInWith([]);
    expect(screen.getByRole('heading', { name: 'Chủ Nhật, 5 tháng 1' })).toBeTruthy();
  });

  test('C1 · /dang-nhap draws the brand panel and the sign-in-form slot, /dang-ky the sign-up-form slot', async () => {
    const first = renderApp(base(), '/dang-nhap');
    expect(await where('sign-in')).toBe('/dang-nhap');
    expect(slotEls(first.container, 'sign-in-form')).toHaveLength(1);
    expect(screen.getByText('Việc', { exact: true })).toBeTruthy();
    first.unmount();

    const second = renderApp(base(), '/dang-ky');
    expect(await where('sign-up')).toBe('/dang-ky');
    expect(slotEls(second.container, 'sign-up-form')).toHaveLength(1);
    expect(screen.getByText('Việc', { exact: true })).toBeTruthy();
  });

  test('C1 · a path no route knows goes to /', async () => {
    server.me = () => json(200, USER);
    renderApp(base(), '/khong-co-trang-nay');
    expect(await where('list')).toBe('/');
  });
});

// ---- C4: gate and session ------------------------------------------------------

describe('App · gate and session', () => {
  test('C4 · / without a user goes to /dang-nhap with no message', async () => {
    renderApp(base(), '/');
    await waitFor(async () => expect(await where('sign-in')).toBe('/dang-nhap'));
    expect(screen.queryByText('Ô nhập giả')).toBeNull();
  });

  test('C4 · someone returning after the 30 days (GET /api/me answers 401 at start) lands on /dang-nhap with no message', async () => {
    server.me = () => json(401, { error: 'unauthenticated' });
    renderApp(base(), '/');
    await waitFor(async () => expect(await where('sign-in')).toBe('/dang-nhap'));
    await new Promise((r) => setTimeout(r, 50));
    expect(await where('sign-in')).toBe('/dang-nhap');
    expect(server.count('GET /api/tasks')).toBe(0);
  });

  test('C4 · /dang-nhap with a user goes to /', async () => {
    server.me = () => json(200, USER);
    renderApp(base(), '/dang-nhap');
    expect(await where('list')).toBe('/');
  });

  test('C4 · /dang-ky with a user goes to /', async () => {
    server.me = () => json(200, USER);
    renderApp(base(), '/dang-ky');
    expect(await where('list')).toBe('/');
  });

  test('C4 · the session is loaded once from GET /api/me and, with a user, taskStore.load() fills the store', async () => {
    await signedInWith([A, B]);
    expect(screen.getByTestId('session').textContent).toBe(`ready:${USER.email}`);
    expect(server.count('GET /api/me')).toBe(1);
    expect(server.count('GET /api/tasks')).toBe(1);
    expect(taskStore.all().map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  test('C4 · refresh() after a sign-in loads the user and the tasks, and the gate goes to /', async () => {
    server.tasks = () => json(200, [A]);
    renderApp(base(), '/dang-nhap');
    expect(await where('sign-in')).toBe('/dang-nhap');
    expect(server.count('GET /api/tasks')).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Vào' }));
    expect(await where('list')).toBe('/');
    expect(await screen.findByText(A.title, { exact: true })).toBeTruthy();
    expect(server.count('GET /api/tasks')).toBe(1);
  });

  test('C4 · clear() empties the session, taskStore and the selection; the gate then goes to /dang-nhap with no message', async () => {
    await signedInWith([A, B]);
    fireEvent.click(title(A.title));
    expect(await screen.findByText(`chi-tiết:${A.title}`)).toBeTruthy();
    server.me = () => json(401, { error: 'unauthenticated' });
    fireEvent.click(screen.getByRole('button', { name: 'Thoát' }));
    await waitFor(async () => expect(await where('sign-in')).toBe('/dang-nhap'));
    expect(screen.getByTestId('sign-in-user').textContent).toBe('none');
    expect(taskStore.all()).toEqual([]);

    // signing in again: the old selection is gone
    fireEvent.click(screen.getByRole('button', { name: 'Vào' }));
    expect(await where('list')).toBe('/');
    expect(await screen.findByText(A.title, { exact: true })).toBeTruthy();
    expect(screen.queryByText(`chi-tiết:${A.title}`)).toBeNull();
    expect(document.querySelectorAll('[data-slot="detail"]')).toHaveLength(0);
  });

  test('C4 · a 401 for a request made while a user is in the session goes to /dang-nhap?het-phien=1', async () => {
    await signedInWith([A]);
    server.tasks = () => json(401, { error: 'unauthenticated' });
    server.me = () => json(401, { error: 'unauthenticated' });
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    await waitFor(async () => expect(await where('sign-in')).toBe('/dang-nhap?het-phien=1'));
    expect(screen.getByTestId('sign-in-user').textContent).toBe('none');
  });
});

// ---- C5: registry, slots and boundaries --------------------------------------------

describe('App · features in slots', () => {
  test('C5 · features are rendered in their slots, ordered by order then id', async () => {
    const piece = (text: string) => () => <span>{text}</span>;
    const features = [
      ...base(),
      feature('zeta', [{ slot: 'filters', order: 1, Component: piece('Mảnh-zeta') }]),
      feature('beta', [{ slot: 'filters', order: 1, Component: piece('Mảnh-beta') }]),
      feature('omega', [{ slot: 'filters', order: 0, Component: piece('Mảnh-omega') }]),
    ];
    const { container } = await signedInWith([A], features);
    const filters = slotEl(container, 'filters')!;
    const omega = within(filters as HTMLElement).getByText('Mảnh-omega');
    const beta = within(filters as HTMLElement).getByText('Mảnh-beta');
    const zeta = within(filters as HTMLElement).getByText('Mảnh-zeta');
    expect(precedes(omega, beta)).toBe(true);
    expect(precedes(beta, zeta)).toBe(true);
  });

  test('C5 · a feature that throws shows nothing in its slot, is logged starting with [list/<feature>], and the rest of the page keeps working', async () => {
    const lines = captureConsole();
    const Boom = () => {
      throw new Error('hỏng rồi');
    };
    const features = [
      ...base(),
      feature('boom', [{ slot: 'summary', Component: Boom }]),
      feature('boom2', [{ slot: 'filters', order: 0, Component: Boom }]),
      feature('ok', [{ slot: 'filters', order: 1, Component: () => <span>Tab giả</span> }]),
    ];
    const { container } = await signedInWith([A, B], features);

    expect(slotEl(container, 'summary')!.textContent).toBe('');
    expect(within(slotEl(container, 'filters') as HTMLElement).getByText('Tab giả')).toBeTruthy();
    expect(title(A.title)).toBeTruthy();
    expect(title(B.title)).toBeTruthy();
    expect(screen.queryByText(/hỏng rồi/)).toBeNull();

    await waitFor(() => {
      expect(lines.some((l) => l.startsWith('[list/boom]') && l.includes('hỏng rồi'))).toBe(true);
      expect(lines.some((l) => l.startsWith('[list/boom2]') && l.includes('hỏng rồi'))).toBe(true);
    });

    // the page still works: selecting a task opens it
    fireEvent.click(title(B.title));
    expect(await screen.findByText(`chi-tiết:${B.title}`)).toBeTruthy();
  });

  test('C5 · a feature that throws in one row leaves the other rows and their item-lead working', async () => {
    captureConsole();
    const Picky = ({ task: t }: { task: Task }) => {
      if (t.id === 'a') throw new Error('hàng hỏng');
      return <span>{`dẫn-${t.id}`}</span>;
    };
    const features = [...base().filter((f) => f.id !== 'lead'), feature('picky', [{ slot: 'item-lead', Component: Picky }])];
    await signedInWith([A, B], features);
    expect(title(A.title)).toBeTruthy();
    expect(title(B.title)).toBeTruthy();
    expect(screen.getByText('dẫn-b')).toBeTruthy();
  });

  test('C5 · a feature in a sign-in page slot is rendered there', async () => {
    renderApp(base(), '/dang-nhap');
    expect(await where('sign-in')).toBe('/dang-nhap');
    const slot = document.querySelector('[data-slot="sign-in-form"]')!;
    expect(within(slot as HTMLElement).getByRole('button', { name: 'Vào' })).toBeTruthy();
  });
});

// ---- C6: the list ----------------------------------------------------------------

describe('App · the list', () => {
  test('C6 · the list draws the tasks that pass the filter, in the set order', async () => {
    setOrder((a, b) => a.title.localeCompare(b.title, 'vi'));
    setFilter({ id: 'open', test: (t) => !t.done, emptyText: 'Không còn việc nào.' });
    await signedInWith([A, B, C]);
    expect(precedes(title(A.title), title(B.title))).toBe(true);
    expect(screen.queryByText(C.title, { exact: true })).toBeNull();
  });

  test('C6 · each set call re-renders the list', async () => {
    await signedInWith([A, B, C]);
    expect(precedes(title(A.title), title(B.title))).toBe(true);
    act(() => setOrder((a, b) => (a.createdAt < b.createdAt ? -1 : 1)));
    expect(precedes(title(C.title), title(B.title))).toBe(true);
    expect(precedes(title(B.title), title(A.title))).toBe(true);

    act(() => setFilter({ id: 'done', test: (t) => t.done, emptyText: 'Chưa có việc nào đã xong.' }));
    expect(screen.queryByText(A.title, { exact: true })).toBeNull();
    expect(title(C.title)).toBeTruthy();

    const due = task('d', { title: 'Đặt bàn sinh nhật', dueAt: local(2026, 11, 26, 17, 0), done: true });
    act(() => taskStore.upsert(due));
    expect(screen.getByText(byWholeText('Hôm qua · 17:00'))).toBeTruthy();
    act(() => setTone((t) => (t.dueAt ? 'late' : 'normal')));
    expect(screen.getByText(byWholeText('Trễ · Hôm qua · 17:00'))).toBeTruthy();
  });

  test('C6 · the list re-renders on store changes', async () => {
    await signedInWith([A]);
    act(() => taskStore.upsert(task('n', { title: 'Học bài 7 tiếng Nhật', createdAt: '2026-11-27T04:00:00.000Z' })));
    expect(precedes(title('Học bài 7 tiếng Nhật'), title(A.title))).toBe(true);
    act(() => taskStore.upsert({ ...A, title: 'Gửi hợp đồng đã ký' }));
    expect(title('Gửi hợp đồng đã ký')).toBeTruthy();
    act(() => taskStore.remove('n'));
    expect(screen.queryByText('Học bài 7 tiếng Nhật', { exact: true })).toBeNull();
  });

  test('C6 · a row is item-lead, then the due text from formatDue, then the title', async () => {
    const t = task('d', { title: 'Đặt bàn sinh nhật vợ', dueAt: local(2026, 11, 28, 8, 0) });
    const { container } = await signedInWith([t]);
    const lead = slotEl(container, 'item-lead')!;
    const due = screen.getByText(byWholeText('Ngày mai · 08:00'));
    expect(within(lead as HTMLElement).getByRole('button', { name: 'báo-d' })).toBeTruthy();
    expect(precedes(lead, due)).toBe(true);
    expect(precedes(due, title(t.title))).toBe(true);
  });

  test('C6 · item-lead gets its task; a row without a due date has no due text', async () => {
    await signedInWith([A, B]);
    expect(screen.getByRole('button', { name: 'báo-a' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'báo-b' })).toBeTruthy();
    expect(screen.queryByText(/ · \d\d:\d\d$/)).toBeNull();
  });

  test('C6 · when the tone is late the due text starts with "Trễ · "; a normal row has no "Trễ"', async () => {
    setTone((t, now) => (!t.done && t.dueAt !== null && new Date(t.dueAt) <= now ? 'late' : 'normal'));
    const late = task('l', { title: 'Mua thuốc huyết áp cho bố', dueAt: local(2026, 11, 26, 17, 0) });
    const soon = task('s', { title: 'Họp nhóm', dueAt: local(2026, 11, 27, 15, 0), createdAt: '2026-11-26T00:00:00.000Z' });
    await signedInWith([late, soon]);
    expect(screen.getByText(byWholeText('Trễ · Hôm qua · 17:00'))).toBeTruthy();
    expect(screen.getByText(byWholeText('Hôm nay · 15:00'))).toBeTruthy();
    expect(screen.queryAllByText(/Trễ/)).toHaveLength(1);
  });

  test('C6 · the message a row\'s item-lead sets shows under that row, and null takes it away', async () => {
    await signedInWith([A, B]);
    fireEvent.click(screen.getByRole('button', { name: 'báo-a' }));
    const msg = await screen.findByText(`Không xong được: ${A.title}`);
    expect(precedes(title(A.title), msg)).toBe(true);
    expect(precedes(msg, title(B.title))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'tắt-a' }));
    await waitFor(() => expect(screen.queryByText(`Không xong được: ${A.title}`)).toBeNull());
  });
});

describe('App · the list each minute', () => {
  test('C6 · the list re-renders each minute: the tone and the due text follow the clock', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date(2026, 10, 27, 10, 20, 30));
    setNow(null);
    setTone((t, now) => (t.dueAt !== null && new Date(t.dueAt) <= now ? 'late' : 'normal'));
    server.me = () => json(200, USER);
    server.tasks = () => json(200, [task('m', { title: 'Gọi điện cho mẹ', dueAt: local(2026, 11, 27, 10, 21) })]);
    renderApp(base(), '/');
    for (let i = 0; i < 20 && !screen.queryByText('Gọi điện cho mẹ'); i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });
    }
    expect(screen.getByText(byWholeText('Hôm nay · 10:21'))).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(screen.getByText(byWholeText('Trễ · Hôm nay · 10:21'))).toBeTruthy();
  });
});

// ---- C7: selection and list states ------------------------------------------------

describe('App · selection', () => {
  test('C7 · with tasks and nothing selected the right column says the hint', async () => {
    await signedInWith([A, B]);
    expect(screen.getByText(HINT, { exact: true })).toBeTruthy();
  });

  test('C7 · clicking a title selects the task: detail then detail-actions get it, the hint goes', async () => {
    const { container } = await signedInWith([A, B]);
    fireEvent.click(title(A.title));
    expect(await screen.findByText(`chi-tiết:${A.title}`)).toBeTruthy();
    const detail = slotEls(container, 'detail');
    const actions = slotEls(container, 'detail-actions');
    expect(detail).toHaveLength(1);
    expect(actions).toHaveLength(1);
    expect(precedes(detail[0], actions[0])).toBe(true);
    expect(within(actions[0] as HTMLElement).getByRole('button', { name: 'Báo lỗi' })).toBeTruthy();
    expect(screen.queryByText(HINT, { exact: true })).toBeNull();
    // the list keeps its rows
    expect(title(B.title)).toBeTruthy();
  });

  test('C7 · pressing Enter on a title selects the task', async () => {
    await signedInWith([A, B]);
    await act(() => pressEnter(title(B.title)));
    expect(await screen.findByText(`chi-tiết:${B.title}`)).toBeTruthy();
  });

  test('C7 · close() from detail or detail-actions clears the selection', async () => {
    const { container } = await signedInWith([A]);
    fireEvent.click(title(A.title));
    fireEvent.click(await screen.findByRole('button', { name: 'Đóng chi tiết' }));
    await waitFor(() => expect(slotEls(container, 'detail')).toHaveLength(0));
    expect(slotEls(container, 'detail-actions')).toHaveLength(0);
    expect(screen.getByText(HINT, { exact: true })).toBeTruthy();

    fireEvent.click(title(A.title));
    fireEvent.click(await screen.findByRole('button', { name: 'Đóng từ hành động' }));
    await waitFor(() => expect(slotEls(container, 'detail')).toHaveLength(0));
  });

  test('C7 · the message detail-actions sets shows under the row of actions', async () => {
    const { container } = await signedInWith([A]);
    fireEvent.click(title(A.title));
    fireEvent.click(await screen.findByRole('button', { name: 'Báo lỗi' }));
    const msg = await screen.findByText(`Không lưu được: ${A.title}`);
    const actions = slotEl(container, 'detail-actions')!;
    expect(actions.contains(msg)).toBe(false);
    expect(precedes(actions, msg)).toBe(true);
  });

  test('C7 · choosing another task mounts detail again for it, dropping unsaved edits without asking', async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    await signedInWith([A, B]);
    fireEvent.click(title(A.title));
    const draft = (await screen.findByLabelText('Tên việc nháp')) as HTMLInputElement;
    fireEvent.change(draft, { target: { value: 'Bản nháp chưa lưu' } });
    expect(draft.value).toBe('Bản nháp chưa lưu');

    fireEvent.click(title(B.title));
    expect(await screen.findByText(`chi-tiết:${B.title}`)).toBeTruthy();
    expect((screen.getByLabelText('Tên việc nháp') as HTMLInputElement).value).toBe(B.title);
    expect(screen.queryByText(`chi-tiết:${A.title}`)).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });

  test('C7 · a change to the open task arrives in detail as a new task prop', async () => {
    await signedInWith([A]);
    fireEvent.click(title(A.title));
    await screen.findByText(`chi-tiết:${A.title}`);
    act(() => taskStore.upsert({ ...A, title: 'Gửi hợp đồng đã ký' }));
    expect(await screen.findByText('chi-tiết:Gửi hợp đồng đã ký')).toBeTruthy();
  });

  test('C7 · the selection clears when its task leaves the store', async () => {
    const { container } = await signedInWith([A, B]);
    fireEvent.click(title(A.title));
    await screen.findByText(`chi-tiết:${A.title}`);
    act(() => taskStore.remove('a'));
    await waitFor(() => expect(slotEls(container, 'detail')).toHaveLength(0));
    expect(slotEls(container, 'detail-actions')).toHaveLength(0);
  });

  test('C7 · the selection stays when its task stops passing the filter', async () => {
    const { container } = await signedInWith([A, B]);
    fireEvent.click(title(A.title));
    await screen.findByText(`chi-tiết:${A.title}`);
    act(() => setFilter({ id: 'other', test: (t) => t.id !== 'a', emptyText: 'Không có.' }));
    expect(screen.queryByText(A.title, { exact: true })).toBeNull();
    expect(screen.getByText(`chi-tiết:${A.title}`)).toBeTruthy();
    expect(slotEls(container, 'detail-actions')).toHaveLength(1);
  });

  test('C7 · narrower than 1100px a selected task shows with "← Danh sách"; the main column\'s slots stay mounted; the button shows the list again', async () => {
    stubWidth(390);
    const { container } = await signedInWith([A, B]);
    fireEvent.click(title(A.title));
    await screen.findByText(`chi-tiết:${A.title}`);
    const back = screen.getByRole('button', { name: '← Danh sách', hidden: true });
    for (const n of ['header-action', 'summary', 'filters', 'input']) expect(slotEls(container, n), n).toHaveLength(1);
    expect(slotEls(container, 'item-lead')).toHaveLength(2);
    expect(screen.getByText('Ô nhập giả')).toBeTruthy();

    fireEvent.click(back);
    await waitFor(() => expect(slotEls(container, 'detail')).toHaveLength(0));
    expect(slotEls(container, 'detail-actions')).toHaveLength(0);
    expect(title(B.title)).toBeTruthy();
  });
});

describe('App · list states', () => {
  test('C7 · with no tasks the list says the empty text and the right column is not shown', async () => {
    const { container } = await signedInWith([]);
    expect(screen.getByText(EMPTY, { exact: true })).toBeTruthy();
    expect(screen.queryByText(HINT, { exact: true })).toBeNull();
    expect(slotEls(container, 'item-lead')).toHaveLength(0);
    expect(precedes(slotEl(container, 'input')!, screen.getByText(EMPTY, { exact: true }))).toBe(true);
  });

  test("C7 · with tasks but none passing the filter the list says the filter's emptyText", async () => {
    setFilter({ id: 'done', test: (t) => t.done, emptyText: 'Chưa có việc nào đã xong.' });
    await signedInWith([A, B]);
    expect(screen.getByText('Chưa có việc nào đã xong.', { exact: true })).toBeTruthy();
    expect(screen.queryByText(EMPTY, { exact: true })).toBeNull();
    expect(screen.queryByText(A.title, { exact: true })).toBeNull();
  });

  test('C7 · while the session is pending the list page shows only its frame and "Đang tải…"', async () => {
    const me = deferred<Response>();
    server.me = () => me.promise;
    server.tasks = () => json(200, [A]);
    const { container } = renderApp(base(), '/');
    expect(await screen.findByText(LOADING, { exact: true })).toBeTruthy();
    expect(within(container.querySelector('header')!).getByText('Việc', { exact: true })).toBeTruthy();
    expect(screen.queryByText('Ô nhập giả')).toBeNull();
    expect(screen.queryByTestId('where-list')).toBeNull();
    expect(screen.queryByText(A.title, { exact: true })).toBeNull();
    expect(screen.queryByText(EMPTY, { exact: true })).toBeNull();

    await act(async () => me.resolve(json(200, USER)));
    expect(await screen.findByText(A.title, { exact: true })).toBeTruthy();
    expect(screen.getByText('Ô nhập giả')).toBeTruthy();
    expect(screen.queryByText(LOADING, { exact: true })).toBeNull();
  });

  test('C7 · while the first load is pending the list page shows only its frame and "Đang tải…"', async () => {
    const tasks = deferred<Response>();
    server.me = () => json(200, USER);
    server.tasks = () => tasks.promise;
    renderApp(base(), '/');
    expect(await screen.findByText(LOADING, { exact: true })).toBeTruthy();
    await waitFor(() => expect(server.count('GET /api/tasks')).toBe(1));
    expect(screen.queryByText('Ô nhập giả')).toBeNull();
    expect(screen.queryByText(EMPTY, { exact: true })).toBeNull();

    await act(async () => tasks.resolve(json(200, [A])));
    expect(await screen.findByText(A.title, { exact: true })).toBeTruthy();
    expect(screen.getByText('Ô nhập giả')).toBeTruthy();
    expect(screen.queryByText(LOADING, { exact: true })).toBeNull();
  });

  test('C7 · when the load fails the slots still mount and the list says "Không tải được danh sách." with "Thử lại", which loads again', async () => {
    server.me = () => json(200, USER);
    server.tasks = () => json(500, { error: 'boom' });
    const { container } = renderApp(base(), '/');
    expect(await screen.findByText(LOAD_FAILED, { exact: true })).toBeTruthy();
    expect(screen.getByText('Ô nhập giả')).toBeTruthy();
    for (const n of ['header-action', 'summary', 'filters', 'input']) expect(slotEls(container, n), n).toHaveLength(1);
    expect(screen.queryByText(LOADING, { exact: true })).toBeNull();
    expect(screen.queryByText(EMPTY, { exact: true })).toBeNull();

    server.tasks = () => json(200, [A]);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText(A.title, { exact: true })).toBeTruthy();
    expect(screen.queryByText(LOAD_FAILED, { exact: true })).toBeNull();
    expect(server.count('GET /api/tasks')).toBe(2);
  });
});

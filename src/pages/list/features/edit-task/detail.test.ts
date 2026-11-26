// @vitest-environment jsdom
// The edit form in the detail slot, on the real list page with fetch stubbed:
// the late line and the clock, changes from elsewhere (C46).
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { fakeServer, json, local, precedes, renderApp, slotEl, stubWidth, task, type Feature } from '../../../../app/__tests__/harness';
import { setTone } from '../../../../shared/list';
import { setNow } from '../../../../shared/time';
import { taskStore } from '../../../../shared/tasks/store';
import type { Task } from '../../../../shared/tasks/types';
import * as editTask from './index';

const USER = { id: 'u1', email: 'an@example.com' };

const A = task('a', {
  title: 'Gửi hợp đồng thuê nhà',
  dueAt: local(2026, 11, 27, 10, 21),
  createdAt: local(2026, 11, 20, 9, 12),
});

const lateWhenPast = (t: Task, now: Date) =>
  t.dueAt !== null && new Date(t.dueAt).getTime() <= now.getTime() ? ('late' as const) : ('normal' as const);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 10, 27, 10, 20, 5));
  setNow(null);
  stubWidth(1440);
  taskStore.clear();
  setTone(() => 'normal');
});

afterEach(() => {
  cleanup();
  taskStore.clear();
  setTone(() => 'normal');
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function open(t: Task) {
  const server = fakeServer();
  server.me = () => json(200, USER);
  server.tasks = () => json(200, [t]);
  const view = renderApp([editTask as unknown as Feature]);
  fireEvent.click(await screen.findByRole('button', { name: t.title }));
  const detail = () => slotEl(view.container, 'detail') as HTMLElement;
  await within(detail()).findByRole('heading', { name: 'Sửa việc' });
  const field = (label: string) => within(detail()).getByLabelText(label, { exact: true }) as HTMLInputElement;
  const save = () => within(detail()).getByRole('button', { name: 'Lưu' }) as HTMLButtonElement;
  return { server, detail, field, save };
}

const lateLine = (detail: HTMLElement) => within(detail).queryByText(/^Trễ · /);

describe('list/edit-task · detail', () => {
  test('list/edit-task · C46 · "Trễ · " and the due text show under the due fields, before "Tạo lúc", when toneOf says late', async () => {
    setTone(() => 'late');
    const { detail, field } = await open(A);
    const line = within(detail()).getByText('Trễ · Hôm nay · 10:21');
    const created = within(detail()).getByText('Tạo lúc 20/11 · 09:12');
    expect(precedes(field('Giờ'), line)).toBe(true);
    expect(precedes(line, created)).toBe(true);
  });

  test('list/edit-task · C46 · no late line when toneOf says normal, even for a past due', async () => {
    const { detail } = await open({ ...A, dueAt: local(2026, 11, 26, 16, 30) });
    expect(within(detail()).getByText('Tạo lúc 20/11 · 09:12')).toBeTruthy();
    expect(lateLine(detail())).toBeNull();
  });

  test('list/edit-task · C46 · the late line follows the clock: it appears when the minute of the due comes', async () => {
    setTone(lateWhenPast);
    const { detail, field } = await open(A);
    expect(lateLine(detail())).toBeNull();
    fireEvent.change(field('Tên việc'), { target: { value: 'Đang sửa dở' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(within(detail()).getByText('Trễ · Hôm nay · 10:21')).toBeTruthy();
    expect(field('Tên việc').value).toBe('Đang sửa dở');
  });

  test('list/edit-task · C46 · when the open task is marked done elsewhere, unsaved edits stay', async () => {
    const { field, save } = await open(A);
    fireEvent.change(field('Tên việc'), { target: { value: 'Đang sửa dở' } });
    fireEvent.change(field('Ngày hạn'), { target: { value: '01/12/2026' } });
    fireEvent.change(field('Giờ'), { target: { value: '08:00' } });

    act(() => taskStore.upsert({ ...A, done: true }));

    expect(field('Tên việc').value).toBe('Đang sửa dở');
    expect(field('Ngày hạn').value).toBe('01/12/2026');
    expect(field('Giờ').value).toBe('08:00');
    expect(save().disabled).toBe(false);
  });
});

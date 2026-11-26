// @vitest-environment jsdom
// The due-order feature, loaded as the app loads it (its index.ts calls setOrder and
// setTone) and drawn by <App> with fetch stubbed. The clock is fixed with setNow;
// where a test needs the minute to change, setNow follows Vitest's fake system time.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import * as dueOrder from './index';
import { toneOf } from '../../../../shared/list';
import { setNow } from '../../../../shared/time';
import { taskStore } from '../../../../shared/tasks/store';
import type { Task } from '../../../../shared/tasks/types';
import { fakeServer, json, local, renderApp, slotEl, slotEls, task, type Feature } from '../../../../app/__tests__/harness';

const USER = { id: 'u1', email: 'an@example.com' };
const EMPTY = 'Chưa có việc nào. Thêm việc đầu tiên ở ô phía trên.';

let server: ReturnType<typeof fakeServer>;

beforeEach(() => {
  server = fakeServer();
  server.me = () => json(200, USER);
  fixClock(at(10, 20));
});

afterEach(() => {
  cleanup();
  taskStore.clear();
  setNow(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Friday 27 November 2026 at h:mi, local time. */
function at(h: number, mi: number, s = 0): Date {
  return new Date(2026, 10, 27, h, mi, s);
}

function fixClock(d: Date) {
  setNow(() => new Date(d.getTime()));
}

/** A clock that moves with tick(): call before open(). */
function runningClock(start: Date) {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(start);
  setNow(() => new Date());
}

async function tick(ms = 60_000) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setImmediate(r));
  });
}

async function open(tasks: Task[]) {
  server.tasks = () => json(200, tasks);
  const feature = { ...dueOrder, page: 'list' } as unknown as Feature;
  const { container } = renderApp([feature]);
  const loaded = () =>
    tasks.length ? slotEls(container, 'item-lead').length === tasks.length : container.textContent!.includes(EMPTY);
  for (let i = 0; i < 200 && !loaded(); i++) await flush();
  expect(loaded(), 'the list loaded').toBe(true);
  return container;
}

const rows = (c: HTMLElement) => slotEls(c, 'item-lead').map((lead) => lead.parentElement!);
const titles = (c: HTMLElement) => rows(c).map((r) => r.querySelector('button')!.textContent);

/** The due text of the row with this title. */
function dueText(c: HTMLElement, title: string): string {
  const row = rows(c).find((r) => r.querySelector('button')!.textContent === title)!;
  return row.querySelector('[data-slot="item-lead"]')!.nextElementSibling!.textContent!;
}

function summary(c: HTMLElement): Element {
  const el = slotEl(c, 'summary');
  expect(el, 'the summary slot').not.toBeNull();
  return el!;
}

const t = (id: string, over: Partial<Task> = {}) => task(id, { title: id, ...over });
const due = (day: number, h: number, mi = 0) => local(2026, 11, day, h, mi);
const made = (day: number, h = 9) => local(2026, 11, day, h, 0);

// ---- C37: order ------------------------------------------------------------

describe('due-order · order', () => {
  const MIXED = [
    t('done-old', { done: true, createdAt: made(10), dueAt: due(28, 9) }),
    t('nodue-old', { createdAt: made(11) }),
    t('due-tomorrow', { createdAt: made(25), dueAt: due(28, 11) }),
    t('done-new', { done: true, createdAt: made(24), dueAt: due(20, 9) }),
    t('due-yesterday', { createdAt: made(12), dueAt: due(26, 16, 30) }),
    t('nodue-new', { createdAt: made(26) }),
    t('done-nodue', { done: true, createdAt: made(15) }),
    t('due-today', { createdAt: made(13), dueAt: due(27, 17) }),
  ];
  const EXPECTED = ['due-yesterday', 'due-today', 'due-tomorrow', 'nodue-new', 'nodue-old', 'done-new', 'done-nodue', 'done-old'];

  test('list/due-order · C37 · not done with a due date (earliest first), then not done without one (newest first), then done (newest first)', async () => {
    const c = await open(MIXED);
    expect(titles(c)).toEqual(EXPECTED);
  });

  test('list/due-order · C37 · the order does not depend on the order the tasks arrive in', async () => {
    const c = await open([...MIXED].reverse());
    expect(titles(c)).toEqual(EXPECTED);
  });

  test('list/due-order · C37 · equal due dates go to the newest created, then to the smaller id', async () => {
    const same = due(28, 9);
    const c = await open([
      t('d', { createdAt: made(20), dueAt: same }),
      t('c', { createdAt: made(22), dueAt: same }),
      t('b', { createdAt: made(20), dueAt: same }),
      t('a', { createdAt: made(19), dueAt: same }),
    ]);
    expect(titles(c)).toEqual(['c', 'b', 'd', 'a']);
  });

  test('list/due-order · C37 · without a due date, and among done tasks, equal creation times go to the smaller id', async () => {
    const c = await open([
      t('y', { createdAt: made(20) }),
      t('n', { createdAt: made(20), done: true, dueAt: due(21, 9) }),
      t('x', { createdAt: made(20) }),
      t('m', { createdAt: made(20), done: true, dueAt: due(29, 9) }),
    ]);
    expect(titles(c)).toEqual(['x', 'y', 'm', 'n']);
  });

  test('list/due-order · C37 · the order follows a change to the list', async () => {
    const first = t('first', { createdAt: made(20), dueAt: due(28, 9) });
    const second = t('second', { createdAt: made(21), dueAt: due(29, 9) });
    const c = await open([second, first]);
    expect(titles(c)).toEqual(['first', 'second']);

    act(() => taskStore.upsert({ ...first, done: true }));
    expect(titles(c)).toEqual(['second', 'first']);
  });
});

// ---- C38 / C40: tone -------------------------------------------------------

describe('due-order · tone', () => {
  test('list/due-order · C38 C40 · a task due at 10:05 is normal at 10:04, late at 10:05 and after', () => {
    const x = t('x', { dueAt: due(27, 10, 5) });
    fixClock(at(10, 4));
    expect(toneOf(x)).toBe('normal');
    fixClock(at(10, 4, 59));
    expect(toneOf(x)).toBe('normal');
    fixClock(at(10, 5));
    expect(toneOf(x)).toBe('late');
    fixClock(at(10, 6));
    expect(toneOf(x)).toBe('late');
  });

  test('list/due-order · C38 C40 · now is cut to the minute: a due of 10:05:30 is not late during 10:05', () => {
    const x = t('x', { dueAt: at(10, 5, 30).toISOString() });
    fixClock(at(10, 5, 45));
    expect(toneOf(x)).toBe('normal');
    fixClock(at(10, 6));
    expect(toneOf(x)).toBe('late');
  });

  test('list/due-order · C38 C40 · a done task is never late, and a task without a due date is not late', () => {
    const past = due(26, 8);
    expect(toneOf(t('open', { dueAt: past }))).toBe('late');
    expect(toneOf(t('done', { dueAt: past, done: true }))).toBe('normal');
    expect(toneOf(t('done-now', { dueAt: due(27, 10, 20), done: true }))).toBe('normal');
    expect(toneOf(t('nodue'))).toBe('normal');
  });

  test('list/due-order · C38 · only the late rows have "Trễ · " before their due text', async () => {
    const c = await open([
      t('late', { dueAt: due(27, 8) }),
      t('later', { dueAt: due(27, 17) }),
      t('finished', { dueAt: due(27, 7), done: true }),
    ]);
    expect(dueText(c, 'late')).toBe('Trễ · Hôm nay · 08:00');
    expect(dueText(c, 'later')).toBe('Hôm nay · 17:00');
    expect(dueText(c, 'finished')).toBe('Hôm nay · 07:00');
  });

  test('list/due-order · C38 C40 · a row due at 10:05 turns late when the minute changes from 10:04, without a reload', async () => {
    runningClock(at(10, 4));
    const c = await open([t('x', { dueAt: due(27, 10, 5) })]);
    expect(dueText(c, 'x')).toBe('Hôm nay · 10:05');
    const loads = server.count('GET /api/tasks');

    await tick();
    expect(dueText(c, 'x')).toBe('Trễ · Hôm nay · 10:05');
    expect(server.count('GET /api/tasks')).toBe(loads);
  });
});

// ---- C39 / C40: summary ----------------------------------------------------

describe('due-order · summary', () => {
  const LATE_1 = t('late-yesterday', { dueAt: due(26, 16, 30) });
  const LATE_2 = t('late-now', { dueAt: due(27, 10, 20) });
  const TODAY_1 = t('today-next-minute', { dueAt: due(27, 10, 21) });
  const TODAY_2 = t('today-last-minute', { dueAt: due(27, 23, 59) });
  const OTHERS = [
    t('midnight', { dueAt: due(28, 0, 0) }),
    t('tomorrow', { dueAt: due(28, 11) }),
    t('nodue'),
    t('done-late', { dueAt: due(26, 9), done: true }),
    t('done-today', { dueAt: due(27, 18), done: true }),
  ];

  test('list/due-order · C39 · the feature puts one component in the summary slot', () => {
    expect(dueOrder.slots.map((s) => s.slot)).toEqual(['summary']);
  });

  test('list/due-order · C39 C40 · "2 việc trễ hạn · 2 việc hôm nay": late up to now, today from the next minute to 23:59, done and other days left out', async () => {
    const c = await open([LATE_1, TODAY_1, ...OTHERS, LATE_2, TODAY_2]);
    expect(summary(c).textContent).toBe('2 việc trễ hạn · 2 việc hôm nay');
  });

  test('list/due-order · C39 · with no task due later today only the late part shows, with no separator', async () => {
    const c = await open([LATE_1, ...OTHERS]);
    expect(summary(c).textContent).toBe('1 việc trễ hạn');
  });

  test('list/due-order · C39 · with no late task only the today part shows, with no separator', async () => {
    const c = await open([TODAY_1, TODAY_2, ...OTHERS]);
    expect(summary(c).textContent).toBe('2 việc hôm nay');
  });

  test('list/due-order · C39 · it follows the list, and with neither part the line is empty', async () => {
    const c = await open([LATE_1, TODAY_2, ...OTHERS]);
    expect(summary(c).textContent).toBe('1 việc trễ hạn · 1 việc hôm nay');

    act(() => taskStore.upsert(LATE_2));
    expect(summary(c).textContent).toBe('2 việc trễ hạn · 1 việc hôm nay');

    act(() => taskStore.remove(TODAY_2.id));
    expect(summary(c).textContent).toBe('2 việc trễ hạn');

    act(() => taskStore.upsert({ ...LATE_1, done: true }));
    act(() => taskStore.remove(LATE_2.id));
    expect(summary(c).textContent).toBe('');
    expect(summary(c).matches(':empty'), 'nothing is left in the line').toBe(true);
  });

  test('list/due-order · C39 C40 · it updates when the minute changes: a task due at 10:05 moves from today to late', async () => {
    runningClock(at(10, 4));
    const c = await open([t('x', { dueAt: due(27, 10, 5) })]);
    expect(summary(c).textContent).toBe('1 việc hôm nay');

    await tick();
    expect(summary(c).textContent).toBe('1 việc trễ hạn');
  });

  test('list/due-order · C40 · at local midnight a task due the next day counts as today, without a reload', async () => {
    runningClock(at(23, 59));
    const c = await open([t('late', { dueAt: due(27, 8) }), t('next-day', { dueAt: due(28, 9) })]);
    expect(summary(c).textContent).toBe('1 việc trễ hạn');
    const loads = server.count('GET /api/tasks');

    await tick();
    expect(summary(c).textContent).toBe('1 việc trễ hạn · 1 việc hôm nay');
    expect(server.count('GET /api/tasks')).toBe(loads);
  });
});

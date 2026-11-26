// Test harness for rendering <App> with fake features (ticket #2, C1 C4 C5 C6 C7).
// Not production code: it stubs fetch and matchMedia, and builds fake features
// shaped like a feature's index.ts.
import { vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { ComponentType } from 'react';
import { App } from '../App';
import { createRegistry } from '../registry';
import type { Task } from '../../shared/tasks/types';

export type Feature = Parameters<typeof createRegistry>[0][number];

export type FakeSlot = { slot: string; order?: number; Component: ComponentType<never> };

export function feature(id: string, slots: FakeSlot[], over: Partial<Record<'routes' | 'storageKeys' | 'shortcuts', string[]>> = {}): Feature {
  return {
    id,
    slots: slots.map((s) => ({ order: 0, ...s })),
    routes: [],
    storageKeys: [],
    shortcuts: [],
    ...over,
  } as unknown as Feature;
}

export function renderApp(features: Feature[], initialPath = '/') {
  return render(<App registry={createRegistry(features)} initialPath={initialPath} />);
}

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export type Reply = () => Response | Promise<Response>;

/** A fake server behind fetch: /api/me and GET /api/tasks answer what the test says. */
export function fakeServer() {
  const server = {
    calls: [] as string[],
    me: (() => json(401, { error: 'unauthenticated' })) as Reply,
    tasks: (() => json(200, [])) as Reply,
    other: (() => json(404, { error: 'not_found' })) as Reply,
    count(call: string) {
      return server.calls.filter((c) => c === call).length;
    },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const path = new URL(url, 'http://localhost').pathname;
      server.calls.push(`${method} ${path}`);
      if (path === '/api/me' && method === 'GET') return Promise.resolve(server.me());
      if (path === '/api/tasks' && method === 'GET') return Promise.resolve(server.tasks());
      return Promise.resolve(server.other());
    }),
  );
  return server;
}

export function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** matchMedia for a window `width` px wide; min-width / max-width queries answer by it. */
export function stubWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      let matches = true;
      const min = /min-width:\s*(\d+)px/.exec(query);
      const max = /max-width:\s*(\d+)px/.exec(query);
      if (min) matches = matches && width >= Number(min[1]);
      if (max) matches = matches && width <= Number(max[1]);
      if (!min && !max) matches = false;
      return {
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      };
    }),
  );
}

export const task = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  title: `Việc ${id}`,
  done: false,
  dueAt: null,
  createdAt: '2026-11-27T03:00:00.000Z',
  ...over,
});

/** Local wall-clock time as an ISO UTC string. */
export const local = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).toISOString();

/** Does `a` come before `b` in the document? */
export const precedes = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

/** The element of the document whose whole text is exactly `text` (the innermost one). */
export function byWholeText(text: string) {
  return (_content: string, el: Element | null) =>
    !!el && el.textContent === text && Array.from(el.children).every((c) => c.textContent !== text);
}

export function captureConsole() {
  const lines: string[] = [];
  for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      lines.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(' '));
    });
  }
  return lines;
}

export const slotEl = (container: ParentNode, name: string) => container.querySelector(`[data-slot="${name}"]`);
export const slotEls = (container: ParentNode, name: string) => Array.from(container.querySelectorAll(`[data-slot="${name}"]`));

/**
 * Press Enter on an element as a browser does: focus the nearest focusable element,
 * keydown, then (for a native button or link, when keydown was not prevented) the
 * click the browser fires, then keyup.
 */
export async function pressEnter(el: HTMLElement) {
  const target = (el.closest('button, a[href], [tabindex], input, [role="button"], [role="link"]') as HTMLElement | null) ?? el;
  target.focus();
  if (document.activeElement !== target) throw new Error('the title cannot take the focus');
  const proceed = fireEvent.keyDown(target, { key: 'Enter', code: 'Enter', keyCode: 13 });
  if (proceed && (target.tagName === 'BUTTON' || (target.tagName === 'A' && target.hasAttribute('href')))) fireEvent.click(target);
  fireEvent.keyUp(target, { key: 'Enter', code: 'Enter', keyCode: 13 });
}

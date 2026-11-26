// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createLogger } from './log';

afterEach(() => {
  vi.restoreAllMocks();
});

function captureConsole() {
  const lines: string[] = [];
  for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      lines.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
    });
  }
  return lines;
}

describe('src/app/log', () => {
  test('C5 · createLogger(prefix).info writes a line carrying the prefix and the arguments', () => {
    const lines = captureConsole();
    createLogger('[list/add]').info('đã thêm', 3);
    expect(lines).toHaveLength(1);
    // The prefix may be given with or without its brackets; the line starts with it.
    expect(lines[0]).toMatch(/^\[list\/add\]|^\[\[list\/add\]\]/);
    expect(lines[0]).toContain('đã thêm');
    expect(lines[0]).toContain('3');
  });

  test('C5 · createLogger(prefix).error writes through console.error with the prefix first', () => {
    const lines = captureConsole();
    createLogger('[list/add]').error(new Error('hỏng'));
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(lines[0]).toMatch(/^\[list\/add\]|^\[\[list\/add\]\]/);
    expect(lines[0]).toContain('hỏng');
  });
});

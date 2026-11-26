// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { now, setNow, useNow } from './time';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
});

afterEach(() => {
  cleanup();
  setNow(null);
  vi.useRealTimers();
});

describe('time', () => {
  test('C6 · now() is the real clock cut to the whole minute', () => {
    vi.setSystemTime(new Date(2026, 10, 27, 10, 20, 45, 512));
    expect(now()).toBeInstanceOf(Date);
    expect(now().getTime()).toBe(new Date(2026, 10, 27, 10, 20, 0, 0).getTime());
  });

  test('C6 · setNow replaces the clock and setNow(null) puts the real one back', () => {
    vi.setSystemTime(new Date(2026, 10, 27, 10, 20, 0));
    setNow(() => new Date(2025, 0, 5, 8, 0));
    expect(now().getTime()).toBe(new Date(2025, 0, 5, 8, 0).getTime());
    setNow(null);
    expect(now().getTime()).toBe(new Date(2026, 10, 27, 10, 20).getTime());
  });

  test('C6 · useNow() gives now() and changes at the start of every minute', () => {
    vi.setSystemTime(new Date(2026, 10, 27, 10, 20, 30));
    const { result } = renderHook(() => useNow());
    expect(result.current.getTime()).toBe(new Date(2026, 10, 27, 10, 20).getTime());

    act(() => {
      vi.advanceTimersByTime(29_000); // 10:20:59
    });
    expect(result.current.getTime()).toBe(new Date(2026, 10, 27, 10, 20).getTime());

    act(() => {
      vi.advanceTimersByTime(1_500); // 10:21:00.5
    });
    expect(result.current.getTime()).toBe(new Date(2026, 10, 27, 10, 21).getTime());

    act(() => {
      vi.advanceTimersByTime(60_000); // 10:22:00.5
    });
    expect(result.current.getTime()).toBe(new Date(2026, 10, 27, 10, 22).getTime());
  });

  test('C6 · useNow() crosses midnight to the new day', () => {
    vi.setSystemTime(new Date(2026, 10, 27, 23, 59, 10));
    const { result } = renderHook(() => useNow());
    expect(result.current.getDate()).toBe(27);
    act(() => {
      vi.advanceTimersByTime(51_000);
    });
    expect(result.current.getTime()).toBe(new Date(2026, 10, 28, 0, 0).getTime());
  });
});

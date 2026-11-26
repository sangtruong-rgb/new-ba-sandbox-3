// The one clock of the client, cut to the whole minute.
import { useEffect, useState } from 'react';

let clock: (() => Date) | null = null;

export function now(): Date {
  const d = new Date((clock ? clock() : new Date()).getTime());
  d.setSeconds(0, 0);
  return d;
}

/** Replaces the clock (tests); null puts the real clock back. */
export function setNow(fn: (() => Date) | null): void {
  clock = fn;
}

/** now(), changing at the start of every minute. */
export function useNow(): Date {
  const [value, setValue] = useState(now);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setValue(now());
        schedule();
      }, 60_000 - (Date.now() % 60_000));
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return value;
}

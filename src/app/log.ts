// The only logger. A feature's lines start with [<page>/<feature>] ([<feature>] for src/features).

export function createLogger(prefix: string): { info(...args: unknown[]): void; error(...args: unknown[]): void } {
  const tag = prefix.startsWith('[') ? prefix : `[${prefix}]`;
  return {
    info: (...args: unknown[]) => console.info(tag, ...args),
    error: (...args: unknown[]) => console.error(tag, ...args),
  };
}

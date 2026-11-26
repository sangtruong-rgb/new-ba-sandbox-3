// @vitest-environment node
// Checks of the repository set-up of ticket #2: scripts, configs, lint rules,
// global CSS and CLAUDE.md. They live under src/ so that `npm test` runs them.
import { afterEach, describe, expect, test, vi } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { loadConfigFromFile } from 'vite';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const pkg = () => JSON.parse(read('package.json')) as { scripts?: Record<string, string> };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function ignored(path: string): boolean {
  const r = spawnSync('git', ['check-ignore', '--no-index', '-q', path], { cwd: root });
  return r.status === 0;
}

describe('package scripts', () => {
  test('C9 · package.json has the scripts dev, test, e2e, lint and typecheck', () => {
    const scripts = pkg().scripts ?? {};
    for (const s of ['dev', 'test', 'e2e', 'lint', 'typecheck']) expect(scripts[s], s).toBeTruthy();
  });

  test('C9 · npm test runs Vitest once (no watch) and npm run e2e runs the Playwright CLI', () => {
    const scripts = pkg().scripts ?? {};
    expect(scripts.test).toMatch(/vitest/);
    expect(scripts.test).toMatch(/\brun\b|--run\b/);
    expect(scripts.e2e).toMatch(/playwright test/);
  });

  test('C9 · npm test collects every Vitest test under server/ and src/, and nothing from e2e/', () => {
    const out = execFileSync('npx', ['vitest', 'list', '--filesOnly', '--json'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, CI: '1' },
      maxBuffer: 16 * 1024 * 1024,
    });
    const start = out.indexOf('[');
    const listed = (JSON.parse(out.slice(start)) as Array<string | { file: string }>).map((x) =>
      relative(root, typeof x === 'string' ? x : x.file).split('\\').join('/'),
    );
    const onDisk = [...walk(join(root, 'server')), ...walk(join(root, 'src'))]
      .map((p) => relative(root, p).split('\\').join('/'))
      .filter((p) => /\.test\.tsx?$/.test(p));
    expect(onDisk.length).toBeGreaterThan(0);
    for (const f of onDisk) expect(listed, f).toContain(f);
    for (const f of listed) expect(f.startsWith('server/') || f.startsWith('src/'), f).toBe(true);
  }, 120_000);
});

describe('vite.config.ts', () => {
  async function serverConfig() {
    const loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' }, join(root, 'vite.config.ts'), root);
    expect(loaded).not.toBeNull();
    return loaded!.config.server ?? {};
  }

  test('C1 · the dev server listens on PORT, strictly, on every interface', async () => {
    vi.stubEnv('PORT', '63999');
    const server = await serverConfig();
    expect(Number(server.port)).toBe(63999);
    expect(server.strictPort).toBe(true);
    expect([true, '0.0.0.0', '::']).toContain(server.host);
  });

  test('C1 · the dev server port is 5173 when PORT is unset', async () => {
    vi.stubEnv('PORT', undefined as unknown as string);
    delete process.env.PORT;
    const server = await serverConfig();
    expect(Number(server.port)).toBe(5173);
    expect(server.strictPort).toBe(true);
  });
});

describe('playwright.config.ts', () => {
  async function config() {
    const mod = (await import(/* @vite-ignore */ join(root, 'playwright.config.ts'))) as { default: any };
    return mod.default;
  }

  test('C9 · e2e starts its own npm run dev with NODE_ENV=test, a new DATABASE_PATH, never reusing a server, and opens BASE_URL', async () => {
    vi.stubEnv('PORT', '63998');
    vi.stubEnv('BASE_URL', 'http://localhost:63998');
    const c = await config();
    const servers = Array.isArray(c.webServer) ? c.webServer : [c.webServer];
    expect(servers).toHaveLength(1);
    const ws = servers[0];
    expect(ws.command).toMatch(/npm run dev/);
    expect(ws.reuseExistingServer).toBe(false);
    expect(ws.env?.NODE_ENV).toBe('test');
    expect(typeof ws.env?.DATABASE_PATH).toBe('string');
    expect(resolve(root, ws.env.DATABASE_PATH)).not.toBe(resolve(root, 'data/todo.sqlite'));
    const where = String(ws.url ?? ws.port ?? '');
    expect(where).toContain('63998');
    expect(c.use?.baseURL).toBe('http://localhost:63998');
  });

  test('C9 · e2e runs with the JSON reporter', async () => {
    const c = await config();
    const reporters = (Array.isArray(c.reporter) ? c.reporter : [c.reporter])
      .flat()
      .filter((r: unknown) => typeof r === 'string');
    const inScript = /--reporter[= ](\S*,)?json\b/.test(pkg().scripts?.e2e ?? '');
    expect(inScript || reporters.includes('json')).toBe(true);
  });

  test('C9 · .gitignore excludes node_modules/, data/, the e2e database files, test-results/ and playwright-report/', async () => {
    expect(ignored('node_modules/x/index.js')).toBe(true);
    expect(ignored('data/todo.sqlite')).toBe(true);
    expect(ignored('test-results/run/trace.zip')).toBe(true);
    expect(ignored('playwright-report/index.html')).toBe(true);
    const c = await config();
    const ws = Array.isArray(c.webServer) ? c.webServer[0] : c.webServer;
    const db = relative(root, resolve(root, ws.env.DATABASE_PATH));
    if (!db.startsWith('..')) expect(ignored(db)).toBe(true);
    expect(ignored('src/app/registry.ts')).toBe(false);
  });
});

describe('lint and typecheck', () => {
  test('C10 · npm run lint passes', () => {
    const r = spawnSync('npm', ['run', 'lint'], { cwd: root, encoding: 'utf8' });
    expect(r.status, r.stdout + r.stderr).toBe(0);
  }, 180_000);

  test('C10 · npm run typecheck passes', () => {
    const r = spawnSync('npm', ['run', 'typecheck'], { cwd: root, encoding: 'utf8' });
    expect(r.status, r.stdout + r.stderr).toBe(0);
  }, 180_000);

  const eslint = new ESLint({ cwd: root });
  async function lint(filePath: string, code: string) {
    const [result] = await eslint.lintText(code, { filePath: join(root, filePath) });
    return {
      restricted: result.messages.filter((m) => m.ruleId === 'no-restricted-imports'),
      fatal: result.messages.filter((m) => m.fatal),
    };
  }
  const denied = async (filePath: string, code: string) => {
    const r = await lint(filePath, code);
    expect(r.restricted.length, `${filePath}: ${code}`).toBeGreaterThan(0);
  };
  const allowed = async (filePath: string, code: string) => {
    const r = await lint(filePath, code);
    expect(r.fatal, `${filePath}: ${code}`).toEqual([]);
    expect(r.restricted, `${filePath}: ${code}`).toEqual([]);
  };

  test('C10 · lint fails when a feature imports another feature', async () => {
    await denied('src/pages/list/features/add/index.ts', "export { x } from '../done/index';\n");
    await denied('src/pages/list/features/add/Add.tsx', "import { x } from '../done/Done';\nexport const y = x;\n");
    await denied('src/pages/list/features/add/index.ts', "export { x } from '../../../sign-in/features/form/index';\n");
    await denied('src/features/theme/index.ts', "export { x } from '../shortcuts/index';\n");
  }, 60_000);

  test("C10 · lint fails when a page imports another page's feature", async () => {
    await denied('src/pages/list/page.tsx', "export { x } from '../sign-in/features/form/index';\n");
    await denied('src/pages/sign-up/page.tsx', "export { x } from '../list/features/add/index';\n");
  }, 60_000);

  test('C10 · lint fails when a file outside server/ imports from server/, except a feature server.ts or *.test.ts', async () => {
    await denied('src/shared/api.ts', "export type { Task } from '../../server/types';\n");
    await denied('src/app/session.ts', "export { createApp } from '../../server/app';\n");
    await denied('src/pages/list/features/add/index.ts', "export type { Task } from '../../../../../server/types';\n");
    await denied('src/pages/list/page.tsx', "export { tasks } from '../../../server/tasks/store';\n");
    await denied('e2e/shell/x.spec.ts', "export { createApp } from '../../server/app';\n");
  }, 60_000);

  test("C10 · lint allows server/ files, a feature's own files, its server.ts and its *.test.ts importing server/testing.ts", async () => {
    await allowed('server/app.ts', "export { tasks } from './tasks/store';\n");
    await allowed('src/pages/list/features/add/index.ts', "export { x } from './Add';\n");
    await allowed('src/pages/list/features/add/server.ts', "export type { ServerFeature } from '../../../../../server/types';\n");
    await allowed('src/features/theme/server.ts', "export type { ServerFeature } from '../../../server/types';\n");
    await allowed('src/pages/list/features/add/add.test.ts', "export { testApp } from '../../../../../server/testing';\n");
    await allowed('src/pages/list/page.tsx', "export { x } from '../../shared/list';\n");
  }, 60_000);
});

describe('global CSS', () => {
  test('C10 · the only global CSS is under src/app/styles/; every other stylesheet is a CSS module', () => {
    const css = walk(join(root, 'src'))
      .map((p) => relative(root, p).split('\\').join('/'))
      .filter((p) => p.endsWith('.css'));
    expect(css).toContain('src/app/styles/tokens.css');
    for (const p of css) {
      if (!p.endsWith('.module.css')) expect(p.startsWith('src/app/styles/'), p).toBe(true);
    }
  });

  test('C10 · src/app/styles/tokens.css defines every colour token for light and dark', () => {
    const tokens = read('src/app/styles/tokens.css');
    for (const name of ['--bg', '--paper', '--ink', '--muted', '--accent', '--accent-ink', '--late', '--line', '--brand', '--brand-ink']) {
      const defs = tokens.match(new RegExp(`${name}\\s*:`, 'g')) ?? [];
      expect(defs.length, name).toBeGreaterThanOrEqual(2);
    }
    expect(tokens).toMatch(/prefers-color-scheme\s*:\s*dark/);
    expect(tokens).toMatch(/color-scheme\s*:/);
    expect(tokens).toMatch(/accent-color\s*:/);
  });
});

describe('CLAUDE.md', () => {
  test('C11 · CLAUDE.md is under 60 lines', () => {
    const lines = read('CLAUDE.md').split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    expect(lines.length).toBeLessThan(60);
  });

  test('C11 · CLAUDE.md states the stack, the check commands, the layout, the import rule, the test naming and the map line', () => {
    const md = read('CLAUDE.md');
    for (const word of ['Hono', 'SQLite', 'React', 'Vite', 'Vitest', 'Playwright']) expect(md, word).toContain(word);
    for (const cmd of ['npm test', 'npm run e2e', 'npm run lint', 'npm run typecheck']) expect(md, cmd).toContain(cmd);
    for (const path of ['server/', 'server.ts', 'index.ts', 'src/pages/', 'src/features/', 'src/shared/', 'src/app/']) expect(md, path).toContain(path);
    expect(md).toMatch(/import/i);
    expect(md).toContain('<page>/<feature> · C<n> · …');
    expect(md).toContain(
      'The repository map is `docs/ARCHITECTURE.md`, generated by the factory; do not edit it by hand.',
    );
  });
});

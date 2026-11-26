// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { createRegistry } from './registry';

type Fake = Parameters<typeof createRegistry>[0][number];

const fake = (id: string, over: Partial<Fake> = {}): Fake =>
  ({ id, slots: [], routes: [], storageKeys: [], shortcuts: [], ...over }) as Fake;

describe('src/app/registry', () => {
  test('C5 · createRegistry accepts features with empty slots and distinct declarations', () => {
    expect(() =>
      createRegistry([
        fake('list/add', { storageKeys: ['viec.add.draft'], shortcuts: ['n'] }),
        fake('list/filter', { storageKeys: ['viec.filter'], shortcuts: ['f'] }),
        fake('sign-in/form'),
      ]),
    ).not.toThrow();
  });

  test('C5 · a route declared twice throws an error naming both features', () => {
    const make = () =>
      createRegistry([fake('list/archive', { routes: ['/luu-tru'] }), fake('list/history', { routes: ['/lich-su', '/luu-tru'] })]);
    expect(make).toThrow(/list\/archive/);
    expect(make).toThrow(/list\/history/);
  });

  test('C5 · a storage key declared twice throws an error naming both features', () => {
    const make = () =>
      createRegistry([fake('list/filter', { storageKeys: ['viec.filter'] }), fake('list/order', { storageKeys: ['viec.filter'] })]);
    expect(make).toThrow(/list\/filter/);
    expect(make).toThrow(/list\/order/);
  });

  test('C5 · a shortcut declared twice throws an error naming both features', () => {
    const make = () => createRegistry([fake('list/add', { shortcuts: ['n'] }), fake('list/search', { shortcuts: ['/', 'n'] })]);
    expect(make).toThrow(/list\/add/);
    expect(make).toThrow(/list\/search/);
  });
});

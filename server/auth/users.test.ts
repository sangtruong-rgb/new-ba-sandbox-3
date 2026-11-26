// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { createApp } from '../app';
import { EmailTakenError, users } from './users';
import { captureDeps } from '../__tests__/probe';

function setup() {
  const probe = captureDeps();
  createApp({ databasePath: ':memory:', features: [probe.feature] });
  return { store: users(probe.deps().db), db: probe.db() };
}

describe('server/auth/users', () => {
  test('C2 · create returns a User { id, email } with the email trimmed and lower-cased', () => {
    const { store } = setup();
    const user = store.create(' An@Example.com ', 'mat-khau-dai');
    expect(Object.keys(user).sort()).toEqual(['email', 'id']);
    expect(user.email).toBe('an@example.com');
    expect(typeof user.id).toBe('string');
    expect(user.id.length).toBeGreaterThan(0);
  });

  test('C2 · " An@Example.com " and "an@example.com" are one account: the second create throws EmailTakenError', () => {
    const { store } = setup();
    store.create(' An@Example.com ', 'mat-khau-dai');
    expect(() => store.create('an@example.com', 'mat-khau-khac')).toThrow(EmailTakenError);
  });

  test('C2 · verify finds the account whatever the case and spaces of the email, with the right password', () => {
    const { store } = setup();
    const user = store.create('an@example.com', 'mat-khau-dai');
    expect(store.verify(' AN@example.COM ', 'mat-khau-dai')).toEqual(user);
    expect(store.verify('an@example.com', 'mat-khau-dai')).toEqual(user);
  });

  test('C2 · verify answers null for a wrong password or an unknown email', () => {
    const { store } = setup();
    store.create('an@example.com', 'mat-khau-dai');
    expect(store.verify('an@example.com', 'mat-khau-sai')).toBeNull();
    expect(store.verify('an@example.com', 'MAT-KHAU-DAI')).toBeNull();
    expect(store.verify('khong-co@example.com', 'mat-khau-dai')).toBeNull();
  });

  test('C2 · byId gives the User { id, email } or null', () => {
    const { store } = setup();
    const user = store.create('an@example.com', 'mat-khau-dai');
    expect(store.byId(user.id)).toEqual({ id: user.id, email: 'an@example.com' });
    expect(store.byId('khong-co')).toBeNull();
  });

  test('C2 · passwords are stored as salted hashes, never in clear', () => {
    const { store, db } = setup();
    const a = store.create('an@example.com', 'cung-mot-mat-khau');
    const b = store.create('binh@example.com', 'cung-mot-mat-khau');
    const rows = db.prepare('SELECT * FROM users').all() as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      for (const value of Object.values(row)) {
        const text = Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
        expect(text).not.toContain('cung-mot-mat-khau');
      }
    }
    // Same password, different salt: every stored secret (a long value that is
    // neither the id nor the email) differs between the two accounts.
    const secrets = (row: Record<string, unknown>) =>
      Object.entries(row)
        .filter(([, v]) => v !== a.id && v !== b.id && v !== a.email && v !== b.email)
        .map(([k, v]) => [k, Buffer.isBuffer(v) ? v.toString('hex') : String(v)] as const)
        .filter(([, v]) => v.length >= 40);
    const rowA = rows.find((r) => Object.values(r).includes(a.id))!;
    const rowB = rows.find((r) => Object.values(r).includes(b.id))!;
    const sa = secrets(rowA);
    const sb = new Map(secrets(rowB));
    expect(sa.length).toBeGreaterThan(0);
    for (const [k, v] of sa) expect(sb.get(k)).not.toBe(v);
  });
});

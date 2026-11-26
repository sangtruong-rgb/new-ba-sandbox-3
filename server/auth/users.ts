// UserStore: accounts with salted scrypt password hashes. Emails are normalised here only.
import type Database from 'better-sqlite3';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { User, UserStoreApi } from '../types';

export class EmailTakenError extends Error {
  constructor(email: string) {
    super(`Email already has an account: ${email}`);
    this.name = 'EmailTakenError';
  }
}

const KEY_LENGTH = 64;
const normalise = (email: string) => email.trim().toLowerCase();
const hash = (password: string, salt: string) => scryptSync(password, salt, KEY_LENGTH).toString('hex');

type Row = { id: string; email: string; password_salt: string; password_hash: string };

export function users(db: Database.Database): UserStoreApi {
  const byEmail = db.prepare<[string], Row>('SELECT id, email, password_salt, password_hash FROM users WHERE email = ?');
  const byId = db.prepare<[string], { id: string; email: string }>('SELECT id, email FROM users WHERE id = ?');
  const insert = db.prepare(
    'INSERT INTO users (id, email, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
  );

  return {
    create(email: string, password: string): User {
      const normal = normalise(email);
      if (byEmail.get(normal)) throw new EmailTakenError(normal);
      const id = randomUUID();
      const salt = randomBytes(16).toString('hex');
      try {
        insert.run(id, normal, salt, hash(password, salt), new Date().toISOString());
      } catch (e) {
        if (e instanceof Error && /UNIQUE/.test(e.message)) throw new EmailTakenError(normal);
        throw e;
      }
      return { id, email: normal };
    },
    verify(email: string, password: string): User | null {
      const row = byEmail.get(normalise(email));
      if (!row) return null;
      const expected = Buffer.from(row.password_hash, 'hex');
      const actual = Buffer.from(hash(password, row.password_salt), 'hex');
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
      return { id: row.id, email: row.email };
    },
    byId(id: string): User | null {
      const row = byId.get(id);
      return row ? { id: row.id, email: row.email } : null;
    },
  };
}

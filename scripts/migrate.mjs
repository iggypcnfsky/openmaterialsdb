// Applies migrations/*.sql in order, once each (tracked in schema_migrations).
import fs from 'node:fs';
import path from 'node:path';
import { makePool } from './db.mjs';

const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'migrations');
const pool = makePool();
const c = await pool.connect();
try {
  await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const done = new Set((await c.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    await c.query('BEGIN');
    await c.query(fs.readFileSync(path.join(dir, f), 'utf8'));
    await c.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
    await c.query('COMMIT');
    console.log('applied', f);
  }
  console.log('migrations up to date');
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  throw e;
} finally {
  c.release();
  await pool.end();
}

import { Pool } from 'pg';

declare global {
  var __omdbPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!globalThis.__omdbPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    const local = /localhost|127\.0\.0\.1/.test(url) || /sslmode=disable/.test(url);
    globalThis.__omdbPool = new Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, max: 5 });
  }
  return globalThis.__omdbPool;
}

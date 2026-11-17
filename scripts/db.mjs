import pg from 'pg';
export function makePool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const local = /localhost|127\.0\.0\.1/.test(url);
  return new pg.Pool({ connectionString: url, ssl: local || /sslmode=disable/.test(url) ? false : { rejectUnauthorized: false }, max: 3 });
}

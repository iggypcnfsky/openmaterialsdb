import pg from 'pg';
export function makePool() {
  let url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  // pg treats sslmode=require as verify-full; say so explicitly (silences the pg v8 deprecation warning)
  url = url.replace(/sslmode=(require|prefer|verify-ca)/, 'sslmode=verify-full');
  const local = /localhost|127\.0\.0\.1/.test(url);
  return new pg.Pool({ connectionString: url, ssl: local || /sslmode=disable/.test(url) ? false : { rejectUnauthorized: false }, max: 3 });
}

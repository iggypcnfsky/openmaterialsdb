import { getPool } from './db';
import type { Material, MaterialSummary, Source } from './types';

const SUMMARY_SQL = `
  SELECT id, slug, name, category, confidence, base_color_hex, density_min, density_max,
         (appearance->'openpbr'->'base_metalness'->>'value')::float AS metalness,
         (appearance->'openpbr'->'specular_roughness'->>'value')::float AS roughness,
         (appearance->'openpbr'->'transmission_weight'->>'value')::float AS transmission,
         (SELECT count(*) FROM jsonb_each(engineering) e WHERE jsonb_typeof(e.value)='object' AND (e.value ? 'value' OR e.value ? 'min' OR e.value ? 'max'))::int
           + (SELECT count(*) FROM jsonb_each(appearance->'openpbr'))::int
           + jsonb_array_length(cost) AS n_values
  FROM materials`;

export type ListParams = { q?: string | null; category?: string | null; sourced?: boolean; limit?: number; offset?: number };

export async function listMaterials(p: ListParams = {}): Promise<{ total: number; items: MaterialSummary[] }> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (p.q) {
    for (const term of p.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6)) {
      args.push(`%${term}%`);
      where.push(`search_text LIKE $${args.length}`);
    }
  }
  if (p.category) {
    args.push(p.category);
    where.push(`lower(category) = lower($${args.length})`);
  }
  if (p.sourced) where.push(`confidence <> 'unverified'`);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(p.limit ?? 500, 1), 500);
  const offset = Math.max(p.offset ?? 0, 0);
  const pool = getPool();
  const [rows, count] = await Promise.all([
    pool.query(`${SUMMARY_SQL} ${w} ORDER BY (confidence = 'unverified'), n_values DESC, name LIMIT ${limit} OFFSET ${offset}`, args),
    pool.query(`SELECT count(*)::int AS n FROM materials ${w}`, args),
  ]);
  return { total: count.rows[0].n, items: rows.rows };
}

export async function getMaterial(slugOrId: string): Promise<Material | null> {
  const r = await getPool().query(
    `SELECT id, slug, name, name_source, category, subcategory, marine_use, appearance, engineering, cost, sheet_indicative, metadata, confidence
     FROM materials WHERE slug = $1 OR lower(id) = lower($1) LIMIT 1`, [slugOrId]);
  return r.rows[0] ?? null;
}

export async function getMaterials(slugs: string[]): Promise<Material[]> {
  if (!slugs.length) return [];
  const r = await getPool().query(
    `SELECT id, slug, name, name_source, category, subcategory, marine_use, appearance, engineering, cost, sheet_indicative, metadata, confidence
     FROM materials WHERE slug = ANY($1)`, [slugs]);
  return slugs.map((s) => r.rows.find((m: Material) => m.slug === s)).filter(Boolean) as Material[];
}

export async function listCategories(): Promise<{ category: string; n: number }[]> {
  const r = await getPool().query(`SELECT category, count(*)::int AS n FROM materials GROUP BY 1 ORDER BY 2 DESC, 1`);
  return r.rows;
}

export async function listSources(): Promise<Source[]> {
  const r = await getPool().query(`SELECT id, label, url, type, license, to_char(accessed,'YYYY-MM-DD') AS accessed FROM sources ORDER BY type, label`);
  return r.rows;
}

export async function stats() {
  const r = await getPool().query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE confidence <> 'unverified')::int AS sourced FROM materials`);
  return r.rows[0] as { total: number; sourced: number };
}

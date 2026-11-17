// Loads data/materials/*.json + data/sources.json into Postgres (idempotent upsert; removes rows no longer in data/).
import fs from 'node:fs';
import path from 'node:path';
import { makePool } from './db.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sources = JSON.parse(fs.readFileSync(path.join(root, 'data/sources.json'), 'utf8'));
const files = fs.readdirSync(path.join(root, 'data/materials')).filter((f) => f.endsWith('.json')).sort();
const mats = files.map((f) => JSON.parse(fs.readFileSync(path.join(root, 'data/materials', f), 'utf8')));

const pool = makePool();
const c = await pool.connect();
try {
  await c.query('BEGIN');
  const allSources = [...sources];
  for (const m of mats) for (const s of m.metadata.sources) if (!allSources.find((x) => x.id === s.id)) allSources.push(s);
  for (const s of allSources) {
    await c.query(
      `INSERT INTO sources (id,label,url,type,license,accessed) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET label=EXCLUDED.label,url=EXCLUDED.url,type=EXCLUDED.type,license=EXCLUDED.license,accessed=EXCLUDED.accessed`,
      [s.id, s.label, s.url, s.type, s.license ?? null, s.accessed ?? null]);
  }
  for (const m of mats) {
    const d = m.engineering?.density;
    const dmin = d ? (d.min ?? d.value ?? null) : null;
    const dmax = d ? (d.max ?? d.value ?? null) : null;
    await c.query(
      `INSERT INTO materials (id,slug,name,name_source,category,subcategory,marine_use,appearance,engineering,cost,sheet_indicative,metadata,confidence,base_color_hex,density_min,density_max,search_text,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now())
       ON CONFLICT (id) DO UPDATE SET slug=EXCLUDED.slug,name=EXCLUDED.name,name_source=EXCLUDED.name_source,category=EXCLUDED.category,
         subcategory=EXCLUDED.subcategory,marine_use=EXCLUDED.marine_use,appearance=EXCLUDED.appearance,engineering=EXCLUDED.engineering,
         cost=EXCLUDED.cost,sheet_indicative=EXCLUDED.sheet_indicative,metadata=EXCLUDED.metadata,confidence=EXCLUDED.confidence,
         base_color_hex=EXCLUDED.base_color_hex,density_min=EXCLUDED.density_min,density_max=EXCLUDED.density_max,search_text=EXCLUDED.search_text,updated_at=now()`,
      [m.id, m.slug, m.name, m.name_source, m.category, m.subcategory, m.marine_use, m.appearance, m.engineering, JSON.stringify(m.cost),
       m.sheet_indicative, m.metadata, m.metadata.confidence, m.appearance?.openpbr?.base_color?.hex ?? null, dmin, dmax,
       [m.id, m.name, m.name_source, m.category, ...(m.marine_use || []), ...(m.metadata.tags || [])].join(' ').toLowerCase()]);
    await c.query('DELETE FROM material_sources WHERE material_id=$1', [m.id]);
    for (const s of m.metadata.sources) await c.query('INSERT INTO material_sources VALUES ($1,$2) ON CONFLICT DO NOTHING', [m.id, s.id]);
  }
  await c.query('DELETE FROM materials WHERE NOT (id = ANY($1))', [mats.map((m) => m.id)]);
  await c.query('COMMIT');
  console.log(`seeded ${mats.length} materials, ${allSources.length} sources`);
} catch (e) {
  await c.query('ROLLBACK');
  throw e;
} finally {
  c.release();
  await pool.end();
}

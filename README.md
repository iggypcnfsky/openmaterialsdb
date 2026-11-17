# Open Materials Database

An open database of **marine and yacht materials** that joins three worlds that usually live apart:

1. **Appearance**: OpenPBR parameters (base colour in linear and sRGB, metalness, roughness, IOR, specular colour / F82 tint, transmission), ready for MaterialX, with slots for PBR maps.
2. **Engineering**: density, Young's modulus, Poisson's ratio, tensile and yield strength, elongation, hardness, thermal expansion and conductivity, max service temperature, and durability or corrosion notes.
3. **Cost**: indicative, dated supplier prices with currency, region, VAT basis, range and confidence level.

**Data integrity rule:** every numeric value carries a `source` id that resolves to a URL in `metadata.sources`. If a value can't be sourced it stays `null`. Where sources disagree, or a value spans tempers or grades, we store a `min`/`max` range. The numbers in the planning sheet have no citations, so they are kept separately under `sheet_indicative` and marked *unverified*.

- Data: **CC0-1.0** (see `data/LICENSE.md`) · Code: **MIT**
- Stack: Next.js 16 (App Router, TypeScript) · Postgres (plain SQL migrations, `pg`) · deployable to Railway with Neon

## Dataset

```
data/
  materials/MAT-xxx-<slug>.json   # one file per material: the source of truth
  sources.json                    # source registry (id, label, url, type, licence, accessed)
  raw/                            # sheet export + Physically Based API snapshot (provenance)
scripts/import/                   # importer that produced data/materials from the raw inputs
```

Record shape (follows the *Model danych* tab of the project sheet):

```jsonc
{
  "id": "MAT-023", "slug": "stainless-steel-316l", "name": "Stainless steel 316L", "category": "Metal",
  "appearance": { "openpbr": { "base_color": { "linear": [0.669,0.639,0.598], "hex": "#d6d1cb", "source": "pb-stainless-steel" }, "base_metalness": {"value":1,"source":"…"} },
                  "pbr_maps": { "basecolor": null, "normal": null, … }, "materialx_file": null },
  "engineering": { "density": { "value": 7900, "unit": "kg/m³", "source": "mif-…" },
                   "tensile_strength": { "min": 530, "max": 1160, "unit": "MPa", "source": "mif-…", "note": "annealed → cold-worked" } },
  "cost": [ { "min": 17.65, "max": 30.70, "unit": "EUR/kg", "currency": "EUR", "region": "EU", "date": "2026-11-17", "source": "ec-…", "confidence": "medium" } ],
  "sheet_indicative": { "density_kg_m3": { "value": 8000 }, "cost": { "min": 5.5, "max": 9.5 }, "confidence": "high" },
  "metadata": { "tags": ["marine","metal"], "sources": [ … ], "confidence": "medium", "last_updated": "2026-11-17" }
}
```

Coverage report: `node scripts/stats.mjs`.

## API (public, read-only, CORS `*`)

| Endpoint | Description |
|---|---|
| `GET /api/materials` | List. Query: `q` (text), `category` (e.g. `Metal`), `sourced=true` (hide sheet-only entries), `limit` (≤500), `offset` |
| `GET /api/materials/{slug or id}` | Full record |
| `GET /api/sources` | Source registry |
| `GET /api/health` | DB check + counts |

## Local development

```bash
cp .env.example .env.local           # set DATABASE_URL
npm install
npm run db:migrate && npm run db:seed
npm run dev                          # http://localhost:3000
npm run build && npm start           # production build
BASE_URL=http://localhost:3000 npm run screenshots   # headless Chrome screenshots → screenshots/
```

Any Postgres 14+ works. To change data, edit `data/materials/*.json` (always add a source) and re-run `npm run db:seed`. The seed is an idempotent upsert and removes rows whose files were deleted.

## Deploy (Railway + Neon)

1. **Neon**: create a project (region `aws-eu-central-1`) and copy the **pooled** connection string (`…-pooler…/neondb?sslmode=require`).
2. **Migrate and seed** (from any machine): `DATABASE_URL='<neon pooled url>' node scripts/migrate.mjs && DATABASE_URL='<…>' node scripts/seed.mjs`.
3. **Railway**: new project → deploy from this GitHub repo. `railway.json` selects the `Dockerfile` and the `/api/health` health check.
   Set the service variable `DATABASE_URL` to the Neon pooled string. The container runs migrations on start, re-seeds from `data/` (disable with `SEED_ON_START=false`), then starts the Next.js standalone server on `$PORT`.
4. Generate a public Railway domain under Settings → Networking.

## Roadmap

MCP server (search and apply materials in Blender/Rhino) · MaterialX `.mtlx` export per material · PBR map links (Poly Haven / ambientCG, CC0) · more sourced composite laminate data (layup-specific) · more dated EU price points · contribution guidelines.

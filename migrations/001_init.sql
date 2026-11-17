-- Open Materials Database – initial schema
-- Mirrors the 'Model danych' tab: appearance / engineering / cost / metadata kept as separate documents,
-- with a few scalar columns extracted for filtering and sorting.

CREATE TABLE IF NOT EXISTS sources (
  id          text PRIMARY KEY,
  label       text NOT NULL,
  url         text NOT NULL,
  type        text NOT NULL,            -- appearance | engineering | cost | project
  license     text,
  accessed    date
);

CREATE TABLE IF NOT EXISTS materials (
  id               text PRIMARY KEY,     -- MAT-001
  slug             text NOT NULL UNIQUE,
  name             text NOT NULL,
  name_source      text,                 -- original (Polish) name from the project sheet
  category         text NOT NULL,
  subcategory      text,
  marine_use       text[] NOT NULL DEFAULT '{}',
  appearance       jsonb NOT NULL DEFAULT '{}'::jsonb,  -- openpbr params, pbr_maps, materialx_file
  engineering      jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {property: {value|min|max, unit, source, note}}
  cost             jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{value,min,max,unit,currency,region,date,source,confidence}]
  sheet_indicative jsonb,                                -- verbatim, unverified numbers from the project sheet
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- tags, sources, confidence, last_updated
  confidence       text NOT NULL DEFAULT 'unverified',
  base_color_hex   text,
  density_min      double precision,
  density_max      double precision,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  search_text      text NOT NULL DEFAULT ''   -- lowercased name/source name/category/uses/tags, filled by seed
);

CREATE INDEX IF NOT EXISTS materials_category_idx ON materials (category);

CREATE TABLE IF NOT EXISTS material_sources (
  material_id text NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  source_id   text NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  PRIMARY KEY (material_id, source_id)
);

export type Quantity = { value?: number; min?: number; max?: number; unit?: string; source?: string; note?: string };
export type ColorValue = { linear: number[]; srgb?: number[]; hex?: string; source: string; note?: string };
export type OpenPBR = {
  base_color?: ColorValue;
  base_metalness?: Quantity;
  specular_roughness?: Quantity;
  specular_ior?: Quantity;
  specular_color?: ColorValue;
  transmission_weight?: Quantity;
  subsurface_weight?: Quantity;
  complex_ior?: { value: number[]; source: string; note?: string };
};
export type Appearance = {
  openpbr: OpenPBR;
  pbr_maps?: Record<string, string | null>;
  materialx_file?: string | null;
  reference_render?: string | null;
  pb_name?: string;
  proxy_note?: string;
  upstream_sources?: string[];
};
export type Cost = {
  value?: number; min?: number; max?: number; unit: string; currency: string; region?: string; date: string;
  source: string; confidence: string; note?: string; vat?: string; basis?: string;
};
export type Source = { id: string; label: string; url: string; type: string; license?: string | null; accessed?: string | null };
export type Note = { text: string; source: string };
export type SheetIndicative = {
  row: number;
  density_kg_m3: Quantity | { raw: string } | null;
  young_modulus_gpa: Quantity | { raw: string } | null;
  cost: Quantity | { raw: string } | null;
  cost_unit: string | null;
  confidence: string | null;
  notes: string | null;
} | null;
export type Material = {
  id: string;
  slug: string;
  name: string;
  name_source: string | null;
  category: string;
  subcategory: string | null;
  marine_use: string[];
  appearance: Appearance;
  engineering: Record<string, Quantity | Note | string | null>;
  cost: Cost[];
  sheet_indicative: SheetIndicative;
  metadata: { tags: string[]; sources: Source[]; confidence: string; last_updated: string; origin: string };
  confidence: string;
};
export type MaterialSummary = Pick<Material, 'id' | 'slug' | 'name' | 'category' | 'confidence'> & {
  base_color_hex: string | null;
  metalness: number | null;
  roughness: number | null;
  transmission: number | null;
  density_min: number | null;
  density_max: number | null;
  n_values: number;
};

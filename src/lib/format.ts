import type { Quantity } from './types';

const nf = new Intl.NumberFormat('en-GB', { maximumSignificantDigits: 4 });
export function fmtNum(n: number) {
  return nf.format(n);
}
export function fmtQty(q: Quantity | null | undefined): string | null {
  if (!q) return null;
  const u = q.unit ? ` ${q.unit}` : '';
  if (q.value !== undefined && q.value !== null) return `${fmtNum(q.value)}${u}`;
  if (q.min !== undefined && q.max !== undefined) return `${fmtNum(q.min)}–${fmtNum(q.max)}${u}`;
  if (q.min !== undefined) return `≥ ${fmtNum(q.min)}${u}`;
  if (q.max !== undefined) return `≤ ${fmtNum(q.max)}${u}`;
  return null;
}
export const ENGINEERING_LABELS: Record<string, string> = {
  density: 'Density',
  young_modulus: "Young's modulus",
  poisson_ratio: "Poisson's ratio",
  tensile_strength: 'Tensile strength (UTS)',
  yield_strength: 'Yield strength',
  compressive_strength: 'Compressive strength',
  compressive_modulus: 'Compressive modulus',
  flexural_strength: 'Flexural strength (MOR)',
  shear_strength: 'Shear strength',
  shear_modulus: 'Shear modulus',
  tensile_modulus_core: 'Tensile modulus',
  elongation_at_break: 'Elongation at break',
  hardness_brinell: 'Hardness (Brinell)',
  hardness_janka: 'Hardness (Janka)',
  thermal_expansion: 'Thermal expansion',
  thermal_conductivity: 'Thermal conductivity',
  max_service_temp: 'Max. temperature (mechanical)',
  softening_temp: 'Softening point',
  water_absorption: 'Water absorption (saturation)',
};
export const OPENPBR_LABELS: Record<string, string> = {
  base_color: 'base_color',
  base_metalness: 'base_metalness',
  specular_roughness: 'specular_roughness',
  specular_ior: 'specular_ior',
  specular_color: 'specular_color',
  transmission_weight: 'transmission_weight',
  subsurface_weight: 'subsurface_weight',
  complex_ior: 'complex IOR (n, k)',
};
export function isQty(v: unknown): v is Quantity {
  return !!v && typeof v === 'object' && ('value' in v || 'min' in v || 'max' in v);
}

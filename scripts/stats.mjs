// Coverage report: how many tracked fields are sourced vs null across data/materials.
import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'data/materials');
const PBR = ['base_color', 'base_metalness', 'specular_roughness', 'specular_ior', 'transmission_weight', 'subsurface_weight'];
const ENG = ['density', 'young_modulus', 'poisson_ratio', 'tensile_strength', 'yield_strength', 'elongation_at_break', 'hardness_brinell', 'thermal_expansion', 'thermal_conductivity', 'max_service_temp', 'water_absorption'];
let filled = 0, nul = 0, extra = 0, costs = 0, withCost = 0, all = 0, sourcedMats = 0;
const per = { pbr: [0, 0], eng: [0, 0], cost: [0, 0] };
for (const f of fs.readdirSync(dir)) {
  const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  all++;
  if (m.metadata.confidence !== 'unverified') sourcedMats++;
  const p = m.appearance.openpbr || {};
  for (const k of PBR) p[k] ? (per.pbr[0]++, filled++) : (per.pbr[1]++, nul++);
  for (const k of ENG) m.engineering[k] ? (per.eng[0]++, filled++) : (per.eng[1]++, nul++);
  extra += Object.keys(p).filter((k) => !PBR.includes(k)).length;
  extra += Object.entries(m.engineering).filter(([k, v]) => !ENG.includes(k) && v && typeof v === 'object' && ('value' in v || 'min' in v || 'max' in v)).length;
  m.cost.length ? (per.cost[0]++, filled++, withCost++) : (per.cost[1]++, nul++);
  costs += m.cost.length;
}
console.log(JSON.stringify({ materials: all, materials_with_sourced_data: sourcedMats, tracked_fields: filled + nul, sourced: filled, null: nul,
  by_group: { appearance_6_fields: { sourced: per.pbr[0], null: per.pbr[1] }, engineering_11_fields: { sourced: per.eng[0], null: per.eng[1] }, cost: { materials_with_price: per.cost[0], without: per.cost[1], price_records: costs } },
  extra_sourced_fields_outside_tracked_set: extra }, null, 2));

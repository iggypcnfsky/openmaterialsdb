import Link from 'next/link';
import { getMaterials, listMaterials } from '@/lib/materials';
import { Sphere } from '@/components/Sphere';
import { ENGINEERING_LABELS, fmtNum, fmtQty, isQty } from '@/lib/format';
import type { Quantity } from '@/lib/types';

export const dynamic = 'force-dynamic';

type SP = Promise<{ m?: string | string[] }>;

export default async function Compare({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const picked = (Array.isArray(sp.m) ? sp.m : sp.m ? [sp.m] : []).flatMap((s) => s.split(',')).filter(Boolean).slice(0, 4);
  const [mats, all] = await Promise.all([getMaterials(picked), listMaterials({ sourced: true })]);
  const keys = Object.keys(ENGINEERING_LABELS).filter((k) => mats.some((m) => isQty(m.engineering[k])));
  return (
    <section>
      <h1>Compare</h1>
      <form className="compare-form" action="/compare" method="get">
        {[0, 1, 2, 3].map((i) => (
          <select key={i} name="m" defaultValue={picked[i] ?? ''} aria-label={`Material ${i + 1}`}>
            <option value="">— choose —</option>
            {all.items.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
          </select>
        ))}
        <button type="submit">Compare</button>
      </form>
      {mats.length > 0 ? (
        <div className="panel">
          <table className="compare">
            <thead>
              <tr>
                <th />
                {mats.map((m) => (
                  <th key={m.slug}>
                    <Sphere hex={m.appearance.openpbr.base_color?.hex} metalness={m.appearance.openpbr.base_metalness?.value} roughness={m.appearance.openpbr.specular_roughness?.value} transmission={m.appearance.openpbr.transmission_weight?.value} size={72} />
                    <Link href={`/materials/${m.slug}`}>{m.name}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k}>
                  <td>{ENGINEERING_LABELS[k]}</td>
                  {mats.map((m) => <td key={m.slug}>{fmtQty(m.engineering[k] as Quantity) ?? <span className="muted">—</span>}</td>)}
                </tr>
              ))}
              <tr>
                <td>Cost</td>
                {mats.map((m) => (
                  <td key={m.slug}>
                    {m.cost.length ? m.cost.map((c, i) => <div key={i}>{c.min != null && c.max != null ? `${fmtNum(c.min)}–${fmtNum(c.max)}` : `from ${fmtNum(c.min ?? c.value ?? 0)}`} {c.unit} <span className="muted small">({c.date})</span></div>) : <span className="muted">—</span>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="muted small">Values come from different sources and test conditions; open each material for the source and notes.</p>
        </div>
      ) : <p className="muted">Pick up to four materials to compare side by side.</p>}
    </section>
  );
}

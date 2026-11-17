import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getMaterial } from '@/lib/materials';
import { Sphere } from '@/components/Sphere';
import { ENGINEERING_LABELS, OPENPBR_LABELS, fmtNum, fmtQty, isQty } from '@/lib/format';
import type { ColorValue, Note, Quantity, Source } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const m = await getMaterial((await params).slug);
  return { title: m ? `${m.name} – Open Materials Database` : 'Not found' };
}

function SourceLink({ id, sources }: { id?: string; sources: Source[] }) {
  if (!id) return <span className="muted">—</span>;
  const s = sources.find((x) => x.id === id);
  if (!s) return <span className="muted">{id}</span>;
  return <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a>;
}

function colorCell(c: ColorValue) {
  return (
    <span className="colorcell">
      {c.hex && <span className="swatch" style={{ background: c.hex }} />}
      <code>linear [{c.linear.map((x) => x.toFixed(3)).join(', ')}]</code>
      {c.hex && <code>sRGB {c.hex}</code>}
    </span>
  );
}

export default async function MaterialPage({ params }: { params: Params }) {
  const m = await getMaterial((await params).slug);
  if (!m) notFound();
  const pbr = m.appearance?.openpbr ?? {};
  const sources = m.metadata.sources;
  const order = Object.keys(ENGINEERING_LABELS);
  const eng = (Object.entries(m.engineering).filter(([, v]) => isQty(v)) as [string, Quantity][]).sort(
    ([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99),
  );
  const notes = (['durability_note', 'corrosion_note'] as const).map((k) => m.engineering[k] as Note | undefined).filter(Boolean) as Note[];
  const engNotes = typeof m.engineering.notes === 'string' ? m.engineering.notes : null;
  const sheet = m.sheet_indicative;
  const pbrRows = Object.entries(pbr);
  return (
    <article className="detail">
      <Link href="/" className="back">← All materials</Link>
      <header className="detail__head">
        <Sphere hex={pbr.base_color?.hex} metalness={pbr.base_metalness?.value} roughness={pbr.specular_roughness?.value} transmission={pbr.transmission_weight?.value} size={180} label={m.name} />
        <div>
          <div className="eyebrow">{m.id} · {m.category}</div>
          <h1>{m.name}</h1>
          {m.name_source && m.name_source !== m.name && <p className="muted">Sheet name: {m.name_source}</p>}
          <div className="detail__badges">
            <span className={`badge badge--${m.confidence}`}>confidence: {m.confidence}</span>
            <span className="muted">updated {m.metadata.last_updated}</span>
            <Link href={`/compare?m=${m.slug}`}>Compare →</Link>
            <Link href={`/api/materials/${m.slug}`} prefetch={false}>JSON</Link>
          </div>
          {m.marine_use.length > 0 && <p className="uses"><strong>Marine use</strong> <span className="muted">(from project sheet)</span>: {m.marine_use.join(', ')}</p>}
        </div>
      </header>

      <section className="panel">
        <h2>Appearance <span className="muted small">OpenPBR parameters</span></h2>
        {pbrRows.length ? (
          <table>
            <thead><tr><th>Parameter</th><th>Value</th><th>Source</th></tr></thead>
            <tbody>
              {pbrRows.map(([k, v]) => (
                <tr key={k}>
                  <td><code>{OPENPBR_LABELS[k] ?? k}</code></td>
                  <td>
                    {'linear' in (v as object) ? colorCell(v as ColorValue)
                      : k === 'complex_ior' ? <code>{(v as { value: number[] }).value.map((x) => x.toFixed(3)).join(', ')}</code>
                      : fmtQty(v as Quantity)}
                    {(v as Quantity).note && <div className="note">{(v as Quantity).note}</div>}
                  </td>
                  <td><SourceLink id={(v as Quantity).source} sources={sources} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">No sourced appearance values yet.</p>}
        {m.appearance.proxy_note && <p className="note">Note: {m.appearance.proxy_note}</p>}
        <p className="muted small">PBR maps: {Object.values(m.appearance.pbr_maps ?? {}).some(Boolean) ? 'available' : 'none linked yet'} · MaterialX: {m.appearance.materialx_file ?? 'not yet available'}</p>
      </section>

      <section className="panel">
        <h2>Engineering</h2>
        {eng.length ? (
          <table>
            <thead><tr><th>Property</th><th>Value</th><th>Source</th></tr></thead>
            <tbody>
              {eng.map(([k, v]) => (
                <tr key={k}>
                  <td>{ENGINEERING_LABELS[k] ?? k}</td>
                  <td>{fmtQty(v)}{v.note && <div className="note">{v.note}</div>}</td>
                  <td><SourceLink id={v.source} sources={sources} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">No sourced engineering values yet.</p>}
        {engNotes && <p className="note">{engNotes}</p>}
        {notes.map((n, i) => <p key={i} className="note">{n.text} — <SourceLink id={n.source} sources={sources} /></p>)}
      </section>

      <section className="panel">
        <h2>Cost <span className="muted small">indicative, dated</span></h2>
        {m.cost.length ? (
          <table>
            <thead><tr><th>Price</th><th>Region</th><th>Date</th><th>Confidence</th><th>Source</th></tr></thead>
            <tbody>
              {m.cost.map((c, i) => (
                <tr key={i}>
                  <td>
                    {c.min != null && c.max != null ? `${fmtNum(c.min)}–${fmtNum(c.max)}` : c.min != null ? `from ${fmtNum(c.min)}` : c.value != null ? fmtNum(c.value) : '—'} {c.unit}
                    {c.vat && <span className="muted small"> ({c.vat})</span>}
                    {c.note && <div className="note">{c.note}</div>}
                  </td>
                  <td>{c.region}</td>
                  <td>{c.date}</td>
                  <td><span className={`badge badge--${c.confidence}`}>{c.confidence}</span></td>
                  <td><SourceLink id={c.source} sources={sources} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">No sourced price yet.</p>}
      </section>

      {sheet && (
        <section className="panel panel--muted">
          <h2>Project sheet values <span className="badge badge--unverified">unverified</span></h2>
          <p className="muted small">Indicative numbers from the project planning sheet (row {sheet.row}). They have no cited source, so they are shown for reference only and are not used as data.</p>
          <ul className="sheet">
            <li>Density: {sheet.density_kg_m3 ? (fmtQty({ ...(sheet.density_kg_m3 as Quantity), unit: 'kg/m³' }) ?? (sheet.density_kg_m3 as { raw: string }).raw) : '—'}</li>
            <li>Young&apos;s modulus: {sheet.young_modulus_gpa ? (fmtQty({ ...(sheet.young_modulus_gpa as Quantity), unit: 'GPa' }) ?? (sheet.young_modulus_gpa as { raw: string }).raw) : '—'}</li>
            <li>Cost: {sheet.cost ? (fmtQty({ ...(sheet.cost as Quantity), unit: sheet.cost_unit ?? '' }) ?? (sheet.cost as { raw: string }).raw) : '—'}</li>
            <li>Sheet confidence: {sheet.confidence ?? '—'}{sheet.notes ? ` · ${sheet.notes}` : ''}</li>
          </ul>
        </section>
      )}

      <section className="panel">
        <h2>Sources</h2>
        <ol className="sources">
          {sources.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a>
              <span className="muted small"> · {s.type}{s.license ? ` · ${s.license}` : ''}{s.accessed ? ` · accessed ${s.accessed}` : ''}</span>
            </li>
          ))}
        </ol>
        {m.appearance.upstream_sources && m.appearance.upstream_sources.length > 0 && (
          <p className="muted small">Upstream references cited by Physically Based: {m.appearance.upstream_sources.map((u, i) => <span key={u}>{i ? ', ' : ''}<a href={u} target="_blank" rel="noreferrer">{new URL(u).hostname}</a></span>)}</p>
        )}
      </section>
    </article>
  );
}

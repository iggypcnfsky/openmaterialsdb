import Link from 'next/link';
import { listCategories, listMaterials } from '@/lib/materials';
import { Sphere } from '@/components/Sphere';
import { fmtNum } from '@/lib/format';

export const dynamic = 'force-dynamic';

type SP = Promise<{ q?: string; category?: string; all?: string }>;

export default async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const category = sp.category ?? '';
  const showAll = sp.all === '1';
  const [{ total, items }, cats] = await Promise.all([
    listMaterials({ q, category, sourced: !showAll }),
    listCategories(),
  ]);
  const qs = (o: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(category ? { category } : {}), ...(showAll ? { all: '1' } : {}), ...o });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    const s = p.toString();
    return s ? `/?${s}` : '/';
  };
  return (
    <>
      <section className="hero">
        <h1>Marine &amp; yacht materials, <span className="accent">sourced</span>.</h1>
        <p className="muted">
          Appearance (OpenPBR), engineering properties and indicative costs in one open dataset. Every number links to its source; anything we could not source is left empty.
        </p>
        <form className="search" action="/" method="get">
          <input name="q" defaultValue={q} placeholder="Search materials, e.g. 316L, teak, epoxy…" aria-label="Search materials" />
          {category && <input type="hidden" name="category" value={category} />}
          {showAll && <input type="hidden" name="all" value="1" />}
          <button type="submit">Search</button>
        </form>
        <div className="chips">
          <Link className={`chip${!category ? ' chip--on' : ''}`} href={qs({ category: '' })}>All</Link>
          {cats.map((c) => (
            <Link key={c.category} className={`chip${category === c.category ? ' chip--on' : ''}`} href={qs({ category: c.category })}>
              {c.category}
            </Link>
          ))}
        </div>
        <div className="toolbar muted">
          <span>{total} material{total === 1 ? '' : 's'}{showAll ? '' : ' with sourced data'}</span>
          <Link href={qs({ all: showAll ? '' : '1' })}>{showAll ? 'Hide unverified sheet-only entries' : 'Include unverified sheet-only entries'}</Link>
        </div>
      </section>
      <section className="grid">
        {items.map((m) => (
          <Link key={m.id} href={`/materials/${m.slug}`} className="card">
            <div className="card__preview">
              <Sphere hex={m.base_color_hex} metalness={m.metalness} roughness={m.roughness} transmission={m.transmission} size={112} label={m.name} />
            </div>
            <div className="card__body">
              <div className="card__title">{m.name}</div>
              <div className="card__meta">
                <span>{m.category}</span>
                {m.density_min != null && (
                  <span>{m.density_min === m.density_max ? fmtNum(m.density_min) : `${fmtNum(m.density_min)}–${fmtNum(m.density_max!)}`} kg/m³</span>
                )}
              </div>
              <div className="card__foot">
                <span className={`badge badge--${m.confidence}`}>{m.confidence}</span>
                <span className="muted">{m.n_values} sourced values</span>
              </div>
            </div>
          </Link>
        ))}
        {!items.length && <p className="muted">No materials match. Try another search or include unverified entries.</p>}
      </section>
    </>
  );
}

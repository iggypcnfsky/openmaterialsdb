import { listSources, stats } from '@/lib/materials';

export const dynamic = 'force-dynamic';

export default async function About() {
  const [sources, s] = await Promise.all([listSources(), stats()]);
  return (
    <section className="prose">
      <h1>About &amp; sources</h1>
      <p>
        The Open Materials Database combines physically based appearance (OpenPBR / MaterialX-ready parameters), engineering properties and
        indicative, dated costs for marine and yacht materials. It currently lists <strong>{s.total}</strong> materials from the project sheet, of which
        <strong> {s.sourced}</strong> carry at least one sourced value.
      </p>
      <h2>Data rules</h2>
      <ul>
        <li>Every numeric value carries a source id that resolves to a URL below. Values without a source are left empty.</li>
        <li>Where sources give a span (tempers, grades, conditions) we store a min/max range instead of a single number.</li>
        <li>Composite values always carry a layup note: they depend strongly on fibre, orientation, fibre volume and process.</li>
        <li>Costs are indicative retail listings with currency, region, date and a confidence level; they go stale quickly.</li>
        <li>Numbers from the planning sheet without a citation are shown separately as <em>unverified</em> and are never used as data.</li>
      </ul>
      <h2>API</h2>
      <ul>
        <li><code>GET /api/materials?q=steel&amp;category=Metal&amp;sourced=true&amp;limit=50&amp;offset=0</code></li>
        <li><code>GET /api/materials/&#123;slug or id&#125;</code></li>
        <li><code>GET /api/sources</code> · <code>GET /api/health</code></li>
      </ul>
      <h2>Licence</h2>
      <p>Data: CC0-1.0 (third-party sources keep their own terms; facts are cited, pages are not copied). Code: MIT.</p>
      <h2>Sources ({sources.length})</h2>
      <ol className="sources">
        {sources.map((x) => (
          <li key={x.id}><a href={x.url} target="_blank" rel="noreferrer">{x.label}</a> <span className="muted small">· {x.type}{x.license ? ` · ${x.license}` : ''}{x.accessed ? ` · accessed ${x.accessed}` : ''}</span></li>
        ))}
      </ol>
    </section>
  );
}

import type { NextRequest } from 'next/server';
import { listMaterials } from '@/lib/materials';

export const dynamic = 'force-dynamic';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' };

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const { total, items } = await listMaterials({
    q: sp.get('q') ?? sp.get('query'),
    category: sp.get('category'),
    sourced: sp.get('sourced') === 'true' || sp.get('sourced') === '1',
    limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
    offset: sp.get('offset') ? Number(sp.get('offset')) : undefined,
  });
  const base = req.nextUrl.origin;
  return Response.json(
    {
      total,
      count: items.length,
      license: { data: 'CC0-1.0', code: 'MIT' },
      items: items.map((m) => ({ ...m, url: `${base}/api/materials/${m.slug}` })),
    },
    { headers: CORS },
  );
}
